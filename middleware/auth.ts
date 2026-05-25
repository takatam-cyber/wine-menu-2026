// middleware/auth.ts
import { RequestHandler } from "express";
import { authAdmin } from "../lib/firebase-admin.js";

// 💡 修正の核心: 関数自体を RequestHandler 型として定義することで、Expressルーターとの型衝突を100%回避
export const authenticateUser: RequestHandler = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized: Missing token" });
    return;
  }

  const idToken = authHeader.split("Bearer ")[1];
  try {
    const decodedToken = await authAdmin.verifyIdToken(idToken);
    // ExpressのRequestオブジェクトに安全にユーザー情報を注入
    (req as any).user = decodedToken;
    next();
  } catch (error) {
    console.error("Auth Error:", error);
    res.status(401).json({ error: "Unauthorized: Invalid token" });
  }
};
