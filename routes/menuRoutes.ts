import { Router } from "express";
import { getMenu, proxyImage } from "../controllers/menuController.js";
import { authenticateUser } from "../middleware/auth.js";

const router = Router();

router.get("/menu/:storeId", getMenu);
router.get("/proxy-image", authenticateUser, proxyImage);

export default router;
