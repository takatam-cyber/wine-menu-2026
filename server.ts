import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import { rateLimit } from "express-rate-limit";
import admin from "firebase-admin";

dotenv.config();

// Firebase Admin for Custom Claims and Server-side DB access
try {
  admin.initializeApp();
} catch (e) {
  console.warn("Firebase Admin already initialized or failed:", e);
}
const dbAdmin = admin.firestore();

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  message: { error: "リクエスト制限を超えました。15分後に再度お試しください。" },
  standardHeaders: true,
  legacyHeaders: false,
});

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());
  app.use("/api/", limiter);

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

  // AI Sommelier API (Server-side RAG)
  app.post("/api/sommelier", async (req, res) => {
    try {
      const { userQuery, history } = req.body;
      const client = getAIClient();
      
      // 1. Intent Analysis
      const analyzerModel = client.getGenerativeModel({ model: "models/gemini-1.5-flash" });
      const analysisResult = await analyzerModel.generateContent(`
        ユーザーの要望から検索ワード(色,タイプ,料理等)を3つ抽出してJSONで返してください。
        例: {"keywords": ["赤", "フルボディ", "肉"]}
        要望: ${userQuery}
      `);
      
      let keywords: string[] = [];
      try {
        const text = analysisResult.response.text();
        const jsonMatch = text.match(/\{.*\}/s);
        if (jsonMatch) keywords = JSON.parse(jsonMatch[0]).keywords || [];
      } catch (e) {}

      // 2. Server-side Retrieval (RAG)
      // Fetching from 'winesMaster' collection
      const wineSnap = await dbAdmin.collection("winesMaster").limit(100).get();
      const allWines = wineSnap.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));
      
      // Keywords filter (Simplified RAG)
      const filteredWines = keywords.length > 0 
        ? allWines.filter(w => keywords.some(k => JSON.stringify(w).toLowerCase().includes(k.toLowerCase())))
        : allWines.slice(0, 15);

      const wineContext = filteredWines
        .slice(0, 15)
        .map(w => `[ID:${w.id}] ${w.name_jp} | 合う:${w.pairing} | ¥${Number(w.price_bottle).toLocaleString()}`)
        .join("\n");

      const systemInstruction = `あなたはピーロート・ジャパンの高級AIソムリエです。
以下のリストから最も合うワインを3本選び、update_uiツールを使用して提案してください。

【出力の鉄則】
1. 挨拶は短く。
2. 必ず update_ui を使用。
3. リスト外の提案は禁止。

【提供可能リスト】
${wineContext}`;

      const model = client.getGenerativeModel({ 
        model: "models/gemini-3-flash-preview",
        systemInstruction,
        tools: [{
          functionDeclarations: [{
            name: "update_ui",
            description: "UIの表示内容を更新します。",
            parameters: {
              type: Type.OBJECT,
              properties: {
                message: { type: Type.STRING },
                buttons: { type: Type.ARRAY, items: { type: Type.STRING } },
                wineIds: { type: Type.ARRAY, items: { type: Type.STRING } }
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
      if (calls && calls.length > 0) return res.json(calls[0].args);
      
      res.json({ message: result.response.text(), buttons: ["最初から探す"] });
    } catch (error: any) {
      console.error("Sommelier Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Admin: Set Custom Role
  app.post("/api/admin/set-role", async (req, res) => {
    try {
      const { uid, role } = req.body;
      await admin.auth().setCustomUserClaims(uid, { role });
      await dbAdmin.collection("users").doc(uid).set({ role }, { merge: true });
      res.json({ success: true, message: `Role ${role} set successfully.` });
    } catch (error: any) {
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
