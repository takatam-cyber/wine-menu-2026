import express, { Request, Response, NextFunction } from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import { rateLimit } from "express-rate-limit";
import admin from "firebase-admin";

dotenv.config();

// Firebase Admin initialization
try {
  admin.initializeApp();
} catch (e) {
  console.warn("Firebase Admin already initialized or failed:", e);
}
const dbAdmin = admin.firestore();

// Authentication Middleware
const authenticateUser = async (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized: Missing token" });
  }

  const idToken = authHeader.split("Bearer ")[1];
  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    (req as any).user = decodedToken;
    next();
  } catch (error) {
    console.error("Auth Error:", error);
    res.status(401).json({ error: "Unauthorized: Invalid token" });
  }
};

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
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

  // AI Sommelier API (Server-side RAG with real Inventory)
  app.post("/api/sommelier", authenticateUser, async (req, res) => {
    try {
      const { userQuery, history, storeId } = req.body;
      if (!storeId) return res.status(400).json({ error: "storeId is required" });

      const client = getAIClient();
      
      // 1. Fetch Store Inventory (Real-time Inventory Link)
      // We list up to 30 active items (Firestore IN query limit)
      const inventorySnap = await dbAdmin
        .collection("stores")
        .doc(storeId)
        .collection("inventory")
        .where("isActive", "==", true)
        .limit(30)
        .get();

      const inventoryIds = inventorySnap.docs.map(doc => doc.id);
      
      if (inventoryIds.length === 0) {
        return res.json({ 
          message: "申し訳ありません。現在、この店舗には提案可能な在庫がございません。", 
          buttons: ["最初から探す"] 
        });
      }

      // 2. Fetch Detailed Wine Data for available IDs
      // This is the "Verification" step to ensure we only use data from winesMaster
      const winesSnap = await dbAdmin
        .collection("winesMaster")
        .where(admin.firestore.FieldPath.documentId(), "in", inventoryIds)
        .get();

      const availableWines = winesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));

      // 3. Keyword Extraction for local filtering (since Firestore doesn't support full-text search)
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

      // 4. Inventory Filtering based on keywords
      const filteredWines = keywords.length > 0 
        ? availableWines.filter(w => keywords.some(k => JSON.stringify(w).toLowerCase().includes(k.toLowerCase())))
        : availableWines;

      // Ensure we don't send too much data and stay within the inventory limit
      const contextWines = filteredWines.slice(0, 15);

      const wineContext = contextWines
        .map(w => `[ID:${w.id}] ${w.name_jp} | 合う料理:${w.pairing} | 価格:¥${Number(w.price_bottle).toLocaleString()}`)
        .join("\n");

      const systemInstruction = `あなたはピーロート・ジャパンの高級AIソムリエです。
以下の実在庫リストから、ユーザーの要望に最も合うワインを3本選び、[SELECT:商品ID] を使用して提案してください。

【出力の鉄則】
1. 挨拶や自己紹介は一切不要。
2. 提案形式: 「ワイン名 [SELECT:ID]」
3. 解説は100文字以内で極めて簡潔に。
4. リスト外のワイン提案は絶対に禁止。
5. 返答の末尾は必ず [SELECT:ID] または [BUTTON:ラベル] で終わらせてください。

【提供可能在庫リスト】
${wineContext}`;

      const model = client.getGenerativeModel({ 
        model: "models/gemini-3-flash-preview",
        systemInstruction
      });

      const geminiHistory = history?.map((h: any) => ({
        role: h.role === 'ai' ? 'model' : 'user',
        parts: [{ text: h.content }]
      })) || [];

      const result = await model.generateContent({
        contents: [...geminiHistory, { role: "user", parts: [{ text: userQuery }] }]
      });

      const responseText = result.response.text();
      res.json({ message: responseText });
    } catch (error: any) {
      console.error("Sommelier Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Admin: Set Custom Role (Strictly Admin Only)
  app.post("/api/admin/set-role", authenticateUser, async (req, res) => {
    try {
      const { uid, role } = req.body;
      const caller = (req as any).user;

      // Strict enforcement: Only users who already have 'admin' claims can change roles
      if (caller.role !== "admin") {
        return res.status(403).json({ error: "Forbidden: Admin access required" });
      }

      await admin.auth().setCustomUserClaims(uid, { role });
      await dbAdmin.collection("users").doc(uid).set({ role }, { merge: true });
      res.json({ success: true, message: `Role ${role} set successfully for ${uid}.` });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Self: Sync Claims (Self-service based on Firestore profile)
  app.post("/api/auth/sync-claims", authenticateUser, async (req, res) => {
    try {
      const { uid } = (req as any).user;
      const userDoc = await dbAdmin.collection("users").doc(uid).get();
      if (!userDoc.exists) return res.status(404).json({ error: "Profile not found" });
      
      const role = userDoc.data()?.role || "customer";
      await admin.auth().setCustomUserClaims(uid, { role });
      res.json({ success: true, role });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Staff Talk AI (Secured)
  app.post("/api/staff-talk", authenticateUser, async (req, res) => {
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

  // Social Post AI (Secured)
  app.post("/api/social-post", authenticateUser, async (req, res) => {
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
