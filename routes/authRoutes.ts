// routes/authRoutes.ts
import { Router } from "express";
import { setRole, syncClaims } from "../controllers/authController.js";
import { authenticateUser } from "../middleware/auth.js";

const router = Router();

router.post("/admin/set-role", authenticateUser, setRole);
router.post("/auth/sync-claims", authenticateUser, syncClaims);

export default router;
