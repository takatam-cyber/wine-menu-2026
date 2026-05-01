import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { GoogleGenAI, SchemaType } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // AI Client Initialization (Server-side only)
  let genAI: any = null;
  function getAIClient() {
    if (!genAI) {
      const apiKey = process.env.MY_SOMMELIER_KEY;
      if (!apiKey || apiKey === "AI Studio Free Tier") {
        throw new Error("MY_SOMMELIER_KEY is not set correctly in environment.");
      }
      genAI = new GoogleGenAI(apiKey);
    }
    return genAI;
  }

  // API Routes
  app.post("/api/sommelier", async (req, res) => {
    try {
      const { userQuery, wineContext, history } = req.body;
      const client = getAIClient();
      
      // Function Calling Definition
      const model = client.getGenerativeModel({
        model: "gemini-3-flash-preview",
        systemInstruction: `あなたはピーロート・ジャパンの高級AIソムリエです。
3ターン以内に最高のワインを提案してください。

【出力の鉄則】
1. 挨拶や前置きは極力短くし、ユーザーが次に選ぶべきアクションを明確にします。
2. 構造化データとして回答を返すための専用ツール（update_ui）を必ず使用してください。
3. 提案時は最大3本までに絞ってください。`,
        tools: [
          {
            functionDeclarations: [
              {
                name: "update_ui",
                description: "AIの回答内容、選択肢ボタン、提案ワインリストをUIに反映します。",
                parameters: {
                  type: SchemaType.OBJECT,
                  properties: {
                    message: {
                      type: SchemaType.STRING,
                      description: "ユーザーへ表示するテキストメッセージ（Markdown可）。"
                    },
                    buttons: {
                      type: SchemaType.ARRAY,
                      items: { type: SchemaType.STRING },
                      description: "ユーザーが次に選ぶべき選択肢のラベル。例: ['赤ワイン希望', '白ワイン希望']"
                    },
                    wineIds: {
                      type: SchemaType.ARRAY,
                      items: { type: SchemaType.STRING },
                      description: "提案するワインの商品IDリスト。例: ['9309980', '9308883']"
                    }
                  },
                  required: ["message"]
                }
              }
            ]
          }
        ],
        toolConfig: {
          functionCallingConfig: {
            mode: "ANY", // ツール呼び出しを強制
            allowedFunctionNames: ["update_ui"]
          }
        }
      });

      const chat = model.startChat({
        history: history?.map((h: any) => ({
          role: h.role === 'ai' ? 'model' : 'user',
          parts: [{ text: h.content }]
        })) || []
      });

      const fullPrompt = `【提供可能リスト】\n${wineContext}\n\nお客様：${userQuery}`;
      const result = await chat.sendMessage(fullPrompt);
      
      const call = result.response.functionCalls()?.[0];
      if (call && call.name === "update_ui") {
        res.json(call.args);
      } else {
        res.json({ message: result.response.text() || "ソムリエが在庫を確認中です。少々お待ちください。" });
      }
    } catch (error: any) {
      console.error("Server API Error:", error);
      res.status(500).json({ error: error.message || "AIの呼び出し中にエラーが発生しました。" });
    }
  });

  app.post("/api/staff-talk", async (req, res) => {
    try {
      const { wine } = req.body;
      const client = getAIClient();
      const model = client.getGenerativeModel({ model: "gemini-3-flash-preview" });
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

  app.post("/api/social-post", async (req, res) => {
    try {
      const { wine } = req.body;
      const client = getAIClient();
      const model = client.getGenerativeModel({ model: "gemini-3-flash-preview" });
      const prompt = `Instagram投稿用のキャプションを作成してください。
ワイン: ${wine.name_jp}
ハッシュタグを5つ含めて。150文字以内。`;
      const result = await model.generateContent(prompt);
      res.json({ text: result.response.text() });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Vite middleware for development
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
