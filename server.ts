import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Safe client initialization
  let genAI: any = null;
  function getAIClient() {
    if (!genAI) {
      const apiKey = process.env.MY_SOMMELIER_KEY;
      if (!apiKey || apiKey === "AI Studio Free Tier") {
        throw new Error("MY_SOMMELIER_KEY is missing or invalid in server environment.");
      }
      genAI = new GoogleGenAI({ apiKey });
    }
    return genAI;
  }

  // AI Sommelier API
  app.post("/api/sommelier", async (req, res) => {
    try {
      const { userQuery, history } = req.body;
      const client = getAIClient();
      
      // 1. Intent Analysis (Small prompt to get keywords/filters)
      const analyzerModel = client.getGenerativeModel({ model: "models/gemini-1.5-flash" });
      const analysisResult = await analyzerModel.generateContent(`
        ユーザーの要望から、ワイン検索用のキーワード（色、タイプ、料理、予算、雰囲気など）を3つ程度抽出してください。
        JSON形式で返してください。例: {"keywords": ["赤ワイン", "フルボディ", "牛肉"]}
        要望: ${userQuery}
      `);
      
      let keywords = [];
      try {
        const text = analysisResult.response.text();
        const jsonMatch = text.match(/\{.*\}/s);
        if (jsonMatch) {
          keywords = JSON.parse(jsonMatch[0]).keywords;
        }
      } catch (e) {
        console.warn("Intent analysis failed, falling back to full context.");
      }

      // 2. Fetch/Filter Wines (In a real app, this would be a Vector DB query)
      // Here we simulate RAG by filtering the MASTER_WINES from the request if provided, 
      // or using a server-side copy (we'll fetch from Firestore in future steps).
      const { wineContext: clientWineContext } = req.body;
      
      // For now, we still use the context passed from client but we could scale this.
      // In a production app, we would search the Database here.

      const systemInstruction = `あなたはピーロート・ジャパンの最高級AIソムリエです。
お客様の要望に最も合うワインを、提供可能リストの中から3本厳選してください。

【出力の鉄則】
1. 挨拶は極力短く（例：『お客様、素晴らしいセレクションをご案内いたします。』）、即座に提案に入ってください。
2. 必ず update_ui ツールを呼び出して、メッセージとボタン、またはワイン提案（wineIds）を返してください。
3. 提案がない場合でも、代替案や質問内容を変える提案をボタンで示してください。

【提供可能リスト】
${clientWineContext}`;

      const model = client.getGenerativeModel({ 
        model: "models/gemini-3-flash-preview",
        systemInstruction,
        tools: [{
          functionDeclarations: [{
            name: "update_ui",
            description: "UIの表示内容（メッセージ、ボタン、ワイン提案）を更新します。",
            parameters: {
              type: Type.OBJECT,
              properties: {
                message: { type: Type.STRING, description: "ユーザーへの返答テキスト。" },
                buttons: { type: Type.ARRAY, items: { type: Type.STRING }, description: "次に押すべきボタンのラベル。" },
                wineIds: { type: Type.ARRAY, items: { type: Type.STRING }, description: "提案するワインのIDリスト。" }
              },
              required: ["message"]
            }
          }]
        }],
        toolConfig: { functionCallingConfig: { mode: "ANY", allowedFunctionNames: ["update_ui"] } }
      });

      const geminiHistory = history?.map((h: any) => ({
        role: h.role === 'ai' ? 'model' : 'user',
        parts: [{ text: h.content }]
      })) || [];

      const result = await model.generateContent({
        contents: [...geminiHistory, { role: "user", parts: [{ text: userQuery }] }]
      });

      const calls = result.response.functionCalls();
      if (calls && calls.length > 0) {
        return res.json(calls[0].args);
      }
      
      res.json({ 
        message: result.response.text() || "在庫を確認しました。最適な一本をご案内します。", 
        buttons: ["最初から探す"] 
      });

    } catch (error: any) {
      console.error("Server API Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Staff Talk AI
  app.post("/api/staff-talk", async (req, res) => {
    try {
      const { wine } = req.body;
      const client = getAIClient();
      const model = client.getGenerativeModel({ model: "models/gemini-3-flash-preview" });
      const prompt = `スタッフ向けの30秒セールストークを作成してください。
ワイン: ${wine.name_jp}
特徴: ${wine.ai_explanation}
ペアリング: ${wine.pairing}
150文字以内で簡潔に。`;
      const result = await model.generateContent(prompt);
      res.json({ text: result.response.text() });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Social Post AI
  app.post("/api/social-post", async (req, res) => {
    try {
      const { wine } = req.body;
      const client = getAIClient();
      const model = client.getGenerativeModel({ model: "models/gemini-3-flash-preview" });
      const prompt = `Instagram投稿用のキャプションを作成してください。
ワイン: ${wine.name_jp}
ハッシュタグを5つ含めて。150文字以内。`;
      const result = await model.generateContent(prompt);
      res.json({ text: result.response.text() });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Vite Integration
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
