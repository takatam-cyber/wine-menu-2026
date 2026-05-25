// routes/menuRoutes.ts
import { Router, Request, Response, NextFunction } from "express";
import { getMenu, proxyImage, invalidateMenuCache, placeOrder } from "../controllers/menuController.js";
import { authenticateUser } from "../middleware/auth.js";

const router = Router();

// 💡 究極の解決策: async関数を標準のExpressハンドラでラップし、型の不一致を完全に解消
router.get("/menu/:storeId", (req: Request, res: Response, next: NextFunction) => {
  getMenu(req, res).catch(next);
});

router.post("/menu/:storeId/invalidate", (req: Request, res: Response, next: NextFunction) => {
  invalidateMenuCache(req, res).catch(next);
});

router.get("/proxy-image", (req: Request, res: Response, next: NextFunction) => {
  proxyImage(req, res).catch(next);
});

// 🚨 セキュアな発注API (ミドルウェアとコントローラーを直列に安全に実行)
router.post("/menu/:storeId/order", 
  (req: Request, res: Response, next: NextFunction) => {
    authenticateUser(req, res, next).catch(next);
  },
  (req: Request, res: Response, next: NextFunction) => {
    placeOrder(req, res).catch(next);
  }
);

export default router;
