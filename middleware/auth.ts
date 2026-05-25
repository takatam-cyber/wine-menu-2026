// middleware/auth.ts
import { Request, Response, NextFunction } from "express";
import { authAdmin } from "../lib/firebase-admin.js";

export interface AuthenticatedRequest extends Request {
  user?: any;
}

export const authenticateUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized: Missing token" });
    return;
  }

  const idToken = authHeader.split("Bearer ")[1];
  try {
    const decodedToken = await authAdmin.verifyIdToken(idToken);
    (req as AuthenticatedRequest).user = decodedToken;
    next();
  } catch (error) {
    console.error("Auth Error:", error);
    res.status(401).json({ error: "Unauthorized: Invalid token" });
  }
};
