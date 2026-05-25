// routes/authRoutes.ts
import { Router, Request, Response, NextFunction } from "express";
import { setRole, syncClaims } from "../controllers/authController.js";
import { authenticateUser } from "../middleware/auth.js";

const router = Router();

// 💡 究極の解決策: async関数をラップし、型の不一致とオーバーロード解決エラーを完全に回避
router.post("/admin/set-role", 
  (req: Request, res: Response, next: NextFunction) => {
    authenticateUser(req, res, next).catch(next);
  },
  (req: Request, res: Response, next: NextFunction) => {
    setRole(req, res).catch(next);
  }
);

router.post("/auth/sync-claims", 
  (req: Request, res: Response, next: NextFunction) => {
    authenticateUser(req, res, next).catch(next);
  },
  (req: Request, res: Response, next: NextFunction) => {
    syncClaims(req, res).catch(next);
  }
);

export default router;
