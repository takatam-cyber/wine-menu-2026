import express, { Request, Response, NextFunction } from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import { rateLimit } from "express-rate-limit";
import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import { readFileSync } from "fs";
const firebaseConfig = JSON.parse(
  readFileSync(new URL("./firebase-applet-config.json", import.meta.url), "utf-8")
);

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
  const PORT = process.env.PORT || 8080;

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

      let client;
      try {
        client = getAIClient();
      } catch (e) {
        return res.json({ 
          message: "ただいまAIソムリエが休暇を頂いております（システム準備中）。時間を置いて再度お越しくださいませ。", 
          buttons: ["最初から探す"] 
        });
      }
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

      // 3. Flavor Mapping Analysis (Sophisticated Inference)
      const analyzerModel = client.getGenerativeModel({ model: "models/gemini-1.5-flash" });
      const mappingResult = await analyzerModel.generateContent(`
        ユーザーの要望を分析し、最適なワインのプロファイルを作成してください。
        以下のJSON形式で返答してください：
        {
          "keywords": ["抽出されたキーワード1", "キーワード2"],
          "profile": {
            "sweetness": 1, // 1(ドライ) - 5(極甘口)
            "body": 3,      // 1(ライト) - 5(フル)
            "acidity": 3,   // 1(低) - 5(高)
            "tannins": 3    // 1(低) - 5(高)
          },
          "mood": "この要望にぴったりのシチュエーションを一言で"
        }
        要望: ${userQuery}
      `);
      
      let mapping: any = { keywords: [], profile: {} };
      try {
        const text = mappingResult.response.text();
        const jsonMatch = text.match(/\{.*\}/s);
        if (jsonMatch) mapping = JSON.parse(jsonMatch[0]);
      } catch (e) {}

      // 4. Mathematical Flavor Logic (Distance-based Ranking)
      const rankedWines = availableWines.map(w => {
        let score = 0;
        
        // Characteristic Match (Euclidean-ish distance)
        if (mapping.profile) {
          const charDiff = 
            Math.abs((w.sweetness || 1) - (mapping.profile.sweetness || 3)) +
            Math.abs((w.body || 3) - (mapping.profile.body || 3)) +
            Math.abs((w.acidity || 3) - (mapping.profile.acidity || 3)) +
            Math.abs((w.tannins || 3) - (mapping.profile.tannins || 3));
          score += (10 - charDiff); // Lower diff = higher score
        }

        // Keyword Match Boost
        const wineStr = JSON.stringify(w).toLowerCase();
        const keywordMatches = mapping.keywords?.filter((k: string) => wineStr.includes(k.toLowerCase())).length || 0;
        score += (keywordMatches * 5);

        return { wine: w, score };
      }).sort((a, b) => b.score - a.score);

      const filteredWines = rankedWines
        .slice(0, 15)
        .map(r => r.wine);

      const wineContext = filteredWines
        .map(w => `[ID:${w.id}] ${w.name_jp} | 特徴:${w.ai_explanation} | 品種:${w.grape} | 価格:¥${Number(w.price_bottle).toLocaleString()}`)
        .join("\n");

      const systemInstruction = `あなたはピーロート・ジャパンの専属シニアソムリエです。
高級ホテルのラウンジでお客様をお迎えするように、優雅で、それでいて情熱的にワインを提案してください。

【お客様のご要望に対する分析（Mapping）】
- 推奨理由には、お客様が大切にされている「香り」や「ムード」に触れてください。
- ピーロートのブランドカラーである「信頼と革新」を体現するような言葉遣いを。

【出力の鉄則】
1. 挨拶や自己紹介（「私はソムリエです」等）は不要。即座に提案に入ってください。
2. 提案形式: 「ワイン名 [SELECT:ID]」
3. 解説は100文字以内で、非常に情緒的かつプロフェッショナルに。
4. 提供可能リスト外のワインは、たとえ知識として知っていても絶対に提案しないでください。
5. 返答の末尾は必ず [SELECT:ID] または [BUTTON:ラベル] で終わらせてください。

【本日ご提案可能なセラー（実在庫）】
${wineContext}`;

      const model = client.getGenerativeModel({ 
        model: "models/gemini-1.5-flash",
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
      let client;
      try {
        client = getAIClient();
      } catch (e) {
        return res.status(503).json({ error: "AIサービス準備中です。環境変数 MY_SOMMELIER_KEY を設定してください。" });
      }
      const model = client.getGenerativeModel({ model: "models/gemini-1.5-flash" });
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
      let client;
      try {
        client = getAIClient();
      } catch (e) {
        return res.status(503).json({ error: "AIサービス準備中です。環境変数 MY_SOMMELIER_KEY を設定してください。" });
      }
      const model = client.getGenerativeModel({ model: "models/gemini-1.5-flash" });
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

  app.listen(Number(PORT), "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
