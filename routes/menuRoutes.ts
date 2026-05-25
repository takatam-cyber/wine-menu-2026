// routes/menuRoutes.ts
import { Router } from "express";
import { getMenu, proxyImage, invalidateMenuCache, placeOrder } from "../controllers/menuController.js";
import { authenticateUser } from "../middleware/auth.js";

const router = Router();

router.get("/menu/:storeId", getMenu);
router.post("/menu/:storeId/invalidate", invalidateMenuCache);
router.get("/proxy-image", proxyImage);

// 🚨 修正の核心: TypeScriptのコンパイルエラーを回避するため as any でルーティングをバインド
router.post("/menu/:storeId/order", authenticateUser as any, placeOrder as any);

export default router;
