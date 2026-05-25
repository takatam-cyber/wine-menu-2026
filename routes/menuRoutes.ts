// routes/menuRoutes.ts
import { Router } from "express";
import { getMenu, proxyImage, invalidateMenuCache } from "../controllers/menuController.js";

const router = Router();

router.get("/menu/:storeId", getMenu);
// 【バグ修正】キャッシュ破棄エンドポイントをルーティングに登録
router.post("/menu/:storeId/invalidate", invalidateMenuCache);
router.get("/proxy-image", proxyImage);

export default router;
