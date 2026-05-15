import { Router } from "express";
import { getMenu, proxyImage, handleTranslateRequest } from "../controllers/menuController.js";
import { authenticateUser } from "../middleware/auth.js";

const router = Router();

router.get("/menu/:storeId", getMenu);
router.get("/proxy-image", authenticateUser, proxyImage);
router.post("/translate", handleTranslateRequest);

export default router;
