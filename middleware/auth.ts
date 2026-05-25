// middleware/auth.ts
import { Request, Response, NextFunction } from "express";
import { authAdmin } from "../lib/firebase-admin.js";

// 💡 ルーター側でラップするため、ここでは標準の async 関数として素直に定義
export const authenticateUser = async (req: Request, res: Response, next: NextFunction) => {
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
