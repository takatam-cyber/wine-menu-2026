// routes/authRoutes.ts
import { Router, Request, Response, NextFunction } from "express";
import { setRole, syncClaims } from "../controllers/authController.js";
import { authenticateUser } from "../middleware/auth.js";

const router = Router();

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
