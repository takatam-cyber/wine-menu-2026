import { Router } from "express";
import { authController } from "../controllers/authController";
import { menuController } from "../controllers/menuController";
import { authenticateUser } from "../middleware/auth";

const router = Router();

// Auth Routes
router.post("/admin/set-role", authenticateUser, authController.setRole);
router.post("/auth/sync-claims", authenticateUser, authController.syncClaims);

// Menu Routes
router.get("/menu/:storeId", menuController.getMenu);

// Image Proxy - Requires authentication as per security requirements
router.get("/proxy-image", authenticateUser, menuController.proxyImage);

export default router;
