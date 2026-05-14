import { Router } from "express";
import { getMenu, proxyImage } from "../controllers/menuController.js";

const router = Router();

router.get("/menu/:storeId", getMenu);
router.get("/proxy-image", proxyImage);

export default router;
