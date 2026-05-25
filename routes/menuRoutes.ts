// routes/menuRoutes.ts
import { Router, RequestHandler } from "express";
import { getMenu, proxyImage, invalidateMenuCache, placeOrder } from "../controllers/menuController.js";
import { authenticateUser } from "../middleware/auth.js";

const router = Router();

// 💡 修正の核心: すべての非同期ハンドラを RequestHandler 型にキャストし、
// Promise<void> と void の型不一致エラー（TS2769）を完全に解消します。
router.get("/menu/:storeId", getMenu as RequestHandler);
router.post("/menu/:storeId/invalidate", invalidateMenuCache as RequestHandler);
router.get("/proxy-image", proxyImage as RequestHandler);

// 🚨 セキュリティ強化：サインイン済みの正規オーナーのみが叩けるセキュアな発注API
router.post(
  "/menu/:storeId/order", 
  authenticateUser as RequestHandler, 
  placeOrder as RequestHandler
);

export default router;
