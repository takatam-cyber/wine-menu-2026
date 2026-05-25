// routes/authRoutes.ts
import { Router } from "express";
import { setRole, syncClaims } from "../controllers/authController.js";
import { authenticateUser } from "../middleware/auth.js";

const router = Router();

// 💡 修正の核心: TypeScriptの「非同期関数 (Promise)」とExpress 4の型定義の衝突を `as any` で完全に無効化
router.post("/admin/set-role", authenticateUser as any, setRole as any);
router.post("/auth/sync-claims", authenticateUser as any, syncClaims as any);

export default router;
