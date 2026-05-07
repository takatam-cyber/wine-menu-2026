import express, { Request, Response, NextFunction } from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import { rateLimit } from "express-rate-limit";
import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import firebaseConfig from "./firebase-applet-config.json";

dotenv.config();

// Firebase Admin initialization
let firebaseApp: admin.app.App;
try {
  firebaseApp = admin.initializeApp({
    projectId: firebaseConfig.projectId,
    credential: admin.credential.applicationDefault()
  });
} catch (e) {
  // If app already exists, handle it
  firebaseApp = admin.apps.find(a => a?.options.projectId === firebaseConfig.projectId) || admin.app();
}

const dbAdmin = getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId);

// Authentication Middleware
const authenticateUser = async (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized: Missing token" });
  }

  const idToken = authHeader.split("Bearer ")[1];
  try {
    const decodedToken = await admin.auth(firebaseApp).verifyIdToken(idToken);
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
  // Use the IP address from the proxy if available
  keyGenerator: (req) => {
    const xff = req.headers["x-forwarded-for"];
    if (typeof xff === "string") return xff.split(",")[0].trim();
    return (req.headers["forwarded"] as string) || req.ip || "unknown";
  },
});

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Trust Cloud Run's proxy
  app.set("trust proxy", 1);

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
      // Fetch up to 100 active items to give AI a better selection
      const inventorySnap = await dbAdmin
        .collection("stores")
        .doc(storeId)
        .collection("inventory")
        .where("isActive", "==", true)
        .limit(100)
        .get();

      const inventoryIds = inventorySnap.docs.map(doc => doc.id);
      
      if (inventoryIds.length === 0) {
        return res.json({ 
          message: "申し訳ありません。現在、この店舗には提案可能な在庫がございません。", 
          buttons: ["最初から探す"] 
        });
      }

      // 2. Fetch Detailed Wine Data for available IDs in chunks
      // Firestore 'in' query is limited to 30 items. Using __name__ for direct document ID matching.
      const availableWines: any[] = [];
      for (let i = 0; i < inventoryIds.length; i += 30) {
        const chunk = inventoryIds.slice(i, i + 30);
        const winesSnap = await dbAdmin
          .collection("winesMaster")
          .where(admin.firestore.FieldPath.documentId(), "in", chunk)
          .get();
        availableWines.push(...winesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() as any })));
      }

      // 3. Keyword Extraction for filtered RAG
      const analyzerModel = client.getGenerativeModel({ model: "models/gemini-1.5-flash" });
      const analysisResult = await analyzerModel.generateContent(`
        ユーザーの要望から検索ワード(色,タイプ,料理,産地等)を3-5個抽出してJSONで返してください。
        例: {"keywords": ["赤", "フルボディ", "牛肉", "ボルドー"]}
        要望: ${userQuery}
      `);
      
      let keywords: string[] = [];
      try {
        const text = analysisResult.response.text();
        const jsonMatch = text.match(/\{.*\}/s);
        if (jsonMatch) keywords = JSON.parse(jsonMatch[0]).keywords || [];
      } catch (e) {}

      // 4. Precision RAG Filtering (Enterprise-grade ranking)
      const rankedWines = availableWines.map(w => {
        const wineStr = JSON.stringify(w).toLowerCase();
        const matches = keywords.filter(k => wineStr.includes(k.toLowerCase())).length;
        return { wine: w, matches };
      }).sort((a, b) => b.matches - a.matches);

      const filteredWines = rankedWines
        .filter(r => r.matches > 0 || keywords.length === 0)
        .map(r => r.wine)
        .slice(0, 20); // Give AI a slightly larger selection of the most relevant items

      const wineContext = filteredWines
        .map(w => `[ID:${w.id}] ${w.name_jp} | タイトル:${w.name_en} | 品種:${w.grape} | 合う料理:${w.pairing} | 価格:¥${Number(w.price_bottle).toLocaleString()}`)
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

      res.json({ message: result.response.text() });
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

      // Strictly lock role assignment to actual admins only.
      // Bootstrap Exception: The project owner (takatam40725@gmail.com) can bypass during initialization.
      const isSystemAdmin = caller.role === "admin" || caller.email === "takatam40725@gmail.com";
      
      if (!isSystemAdmin) {
        return res.status(403).json({ error: "Forbidden: Admin access required for role management" });
      }

      // DISALLOW self-escalation if not already system admin
      // The current block already prevents this since any non-admin (even with same UID) would be caught by !isSystemAdmin.

      await admin.auth().setCustomUserClaims(uid, { role });
      await dbAdmin.collection("users").doc(uid).set({ role }, { merge: true });
      res.json({ success: true, message: `Role ${role} assigned correctly to ${uid}.` });
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
