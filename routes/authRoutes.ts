// routes/authRoutes.ts
import { Router, RequestHandler } from "express";
import { setRole, syncClaims } from "../controllers/authController.js";
import { authenticateUser } from "../middleware/auth.js";

const router = Router();

// 💡 修正の核心: TypeScriptの厳格モードエラーを回避するための RequestHandler キャスト
router.post(
  "/admin/set-role", 
  authenticateUser as RequestHandler, 
  setRole as RequestHandler
);

router.post(
  "/auth/sync-claims", 
  authenticateUser as RequestHandler, 
  syncClaims as RequestHandler
);

export default router;
