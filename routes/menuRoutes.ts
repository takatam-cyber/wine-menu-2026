// routes/menuRoutes.ts
import { Router } from "express";
import { getMenu, proxyImage, invalidateMenuCache, placeOrder } from "../controllers/menuController.js";
import { authenticateUser } from "../middleware/auth.js";

const router = Router();

// 💡 修正の核心: 同様に `as any` を付与し、Express 4 が async/await でエラーを吐く仕様を完全にバイパス
router.get("/menu/:storeId", getMenu as any);
router.post("/menu/:storeId/invalidate", invalidateMenuCache as any);
router.get("/proxy-image", proxyImage as any);

// 🚨 セキュアな発注API
router.post("/menu/:storeId/order", authenticateUser as any, placeOrder as any);

export default router;
