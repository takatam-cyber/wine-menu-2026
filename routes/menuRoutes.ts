// routes/menuRoutes.ts
import { Router } from "express";
import { getMenu, proxyImage, invalidateMenuCache, placeOrder } from "../controllers/menuController.js";
import { authenticateUser } from "../middleware/auth.js";

const router = Router();

router.get("/menu/:storeId", getMenu);
router.post("/menu/:storeId/invalidate", invalidateMenuCache);
router.get("/proxy-image", proxyImage);

// 🚨 セキュリティ強化：サインイン済みの正規オーナーのみが叩けるセキュアな発注API
router.post("/menu/:storeId/order", authenticateUser, placeOrder);

export default router;
