// routes/menuRoutes.ts
import { Router } from "express";
import { getMenu, proxyImage, invalidateMenuCache } from "../controllers/menuController.js";

const router = Router();

// お客様用デジタルメニューの配信 API
router.get("/menu/:storeId", getMenu);

// キャッシュ無効化ダミー API (管理画面用互換)
router.post("/menu/:storeId/invalidate", invalidateMenuCache);

// 画像安全プロキシ API
router.get("/proxy-image", proxyImage);

export default router;
