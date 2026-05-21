import { Router } from "express";
import { getMenu, proxyImage, invalidateMenuCache } from "../controllers/menuController.js";

const router = Router();

router.get("/menu/:storeId", getMenu);
router.post("/menu/:storeId/invalidate", invalidateMenuCache);
router.get("/proxy-image", proxyImage);


export default router;
