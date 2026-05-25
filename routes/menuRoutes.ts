// routes/menuRoutes.ts
import { Router, Request, Response, NextFunction } from "express";
import { getMenu, proxyImage, invalidateMenuCache, placeOrder } from "../controllers/menuController.js";
import { authenticateUser } from "../middleware/auth.js";

const router = Router();

// 💡 最終解決策: Express の RequestHandler (戻り値 void) に完璧に合わせるため、
// ブロック付きのアロー関数 `{ ... }` でラップして Promise の返却をブロックします。

router.get("/menu/:storeId", (req: Request, res: Response, next: NextFunction) => {
  getMenu(req, res).catch(next);
});

router.post("/menu/:storeId/invalidate", (req: Request, res: Response) => {
  invalidateMenuCache(req, res);
});

router.get("/proxy-image", (req: Request, res: Response, next: NextFunction) => {
  proxyImage(req, res).catch(next);
});

// 🚨 セキュアな発注API（ミドルウェアとコントローラーを直列で安全に実行）
router.post("/menu/:storeId/order", 
  (req: Request, res: Response, next: NextFunction) => {
    authenticateUser(req, res, next).catch(next);
  },
  (req: Request, res: Response, next: NextFunction) => {
    placeOrder(req, res).catch(next);
  }
);

export default router;
