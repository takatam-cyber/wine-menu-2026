import express, { Request, Response, NextFunction } from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { rateLimit } from "express-rate-limit";
import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import { readFileSync } from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const firebaseConfig = JSON.parse(
  readFileSync(path.join(__dirname, "firebase-applet-config.json"), "utf-8")
);

dotenv.config();

// Firebase Admin initialization
if (!admin.apps.length) {
  admin.initializeApp({
    projectId: firebaseConfig.projectId
  });
}
const firebaseApp = admin.app();
const dbAdmin = getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId);

// Authentication Middleware
const authenticateUser = async (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized: Missing token" });
  }

  const idToken = authHeader.split("Bearer ")[1];
  try {
    const decodedToken = await admin.auth(firebaseApp).verifyIdToken(idToken);
    (req as any).user = decodedToken;
    next();
  } catch (error) {
    console.error("Auth Error:", error);
    res.status(401).json({ error: "Unauthorized: Invalid token" });
  }
};

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: "リクエスト制限を超えました。15分後に再度お試しください。" },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const xff = req.headers["x-forwarded-for"];
    if (typeof xff === "string") return xff.split(",")[0].trim();
    return (req.headers["forwarded"] as string) || req.ip || "unknown";
  },
});

async function startServer() {
  const app = express();
  const PORT = process.env.PORT || 3000;

  app.set("trust proxy", 1);
  app.use(express.json());
  app.use("/api/", limiter);

  // Admin: Set Custom Role
  app.post("/api/admin/set-role", authenticateUser, async (req, res) => {
    try {
      const { uid, role } = req.body;
      const caller = (req as any).user;
      const isSystemAdmin = caller.role === "admin" || caller.email === "takatam40725@gmail.com";
      
      if (!isSystemAdmin) {
        return res.status(403).json({ error: "Forbidden" });
      }

      await admin.auth().setCustomUserClaims(uid, { role });
      await dbAdmin.collection("users").doc(uid).set({ role }, { merge: true });
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Self: Sync Claims
  app.post("/api/auth/sync-claims", authenticateUser, async (req, res) => {
    try {
      const { uid, email } = (req as any).user;
      const userDoc = await dbAdmin.collection("users").doc(uid).get();
      
      let role = "customer";
      if (userDoc.exists) {
        role = userDoc.data()?.role || "customer";
      }

      if (email && (email.endsWith("@pieroth.jp") || email === "takatam40725@gmail.com")) {
        role = "admin";
      }

      await admin.auth().setCustomUserClaims(uid, { role });
      if (userDoc.exists && userDoc.data()?.role !== role) {
        await dbAdmin.collection("users").doc(uid).set({ role }, { merge: true });
      } else if (!userDoc.exists) {
        await dbAdmin.collection("users").doc(uid).set({ 
          role, 
          email: email || "",
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
      }
      res.json({ success: true, role });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Optimized Menu Endpoint
  app.get("/api/menu/:storeId", async (req, res) => {
    try {
      const { storeId } = req.params;
      const storeDoc = await dbAdmin.collection("stores").doc(storeId).get();
      if (!storeDoc.exists) return res.status(404).json({ error: "Store not found" });
      
      const storeData = storeDoc.data();
      const publicStoreData = {
        id: storeDoc.id,
        name: storeData?.name,
        address: storeData?.address,
        cuisine_type: storeData?.cuisine_type,
        hasAiSommelier: storeData?.hasAiSommelier
      };

      const invSnap = await dbAdmin.collection("stores").doc(storeId).collection("inventory").get();
      const inventoryItems = invSnap.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter((item: any) => item.isActive !== false && item.visible !== false);
      
      const masterIds = inventoryItems.map((item: any) => item.id);
      const enrichedMenu: any[] = [];
      for (let i = 0; i < masterIds.length; i += 30) {
        const chunk = masterIds.slice(i, i + 30);
        const masterSnap = await dbAdmin.collection("winesMaster")
          .where(admin.firestore.FieldPath.documentId(), "in", chunk)
          .get();
        
        masterSnap.forEach(mDoc => {
          const masterData = mDoc.data();
          const invItem: any = inventoryItems.find((inv: any) => inv.id === mDoc.id);
          enrichedMenu.push({
            ...masterData,
            id: mDoc.id,
            price_bottle: invItem?.price_bottle || masterData?.price_bottle,
            price_glass: invItem?.price_glass || masterData?.price_glass,
            isFeatured: invItem?.isFeatured || false,
            promoLabel: invItem?.promoLabel || "",
          });
        });
      }

      res.setHeader("Cache-Control", "public, max-age=60");
      res.json({ store: publicStoreData, menu: enrichedMenu });
    } catch (error: any) {
      console.error("Menu Fetch Error:", error);
      res.status(500).json({ error: "Failed to fetch menu" });
    }
  });

  // Image Proxy
  app.get("/api/proxy-image", async (req, res) => {
    const imageUrl = req.query.url as string;
    if (!imageUrl) return res.status(400).send("URL is required");
    try {
      const response = await fetch(imageUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0",
          "Referer": "https://www.pieroth.jp/" 
        }
      });
      if (!response.ok) throw new Error(`Status ${response.status}`);
      const contentType = response.headers.get("content-type");
      if (contentType) res.setHeader("Content-Type", contentType);
      res.setHeader("Cache-Control", "public, max-age=86400");
      const arrayBuffer = await response.arrayBuffer();
      res.send(Buffer.from(arrayBuffer));
    } catch (error) {
      console.error("Proxy error:", error);
      res.status(500).send("Proxy failed");
    }
  });

  // Static Assets and Fallback
  if (process.env.NODE_ENV === "production") {
    const distPath = path.resolve(__dirname, "dist");
    app.use(express.static(distPath));
    app.use("/assets", express.static(path.join(distPath, "assets")));
    app.get("*", (req, res) => {
      if (req.path.startsWith("/api/")) return;
      res.sendFile(path.join(distPath, "index.html"));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  }

  app.listen(Number(PORT), "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
