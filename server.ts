import express, { Request, Response, NextFunction } from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenAI, Type } from "@google/genai";
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
  // Use the IP address from the proxy if available
  keyGenerator: (req) => {
    const xff = req.headers["x-forwarded-for"];
    if (typeof xff === "string") return xff.split(",")[0].trim();
    return (req.headers["forwarded"] as string) || req.ip || "unknown";
  },
});

async function startServer() {
  const app = express();
  const PORT = process.env.PORT || 3000;

  // Trust Cloud Run's proxy
  app.set("trust proxy", 1);

  // Normalize trailing slashes (Safari fix for deep links)
  app.use((req, res, next) => {
    if (req.path.length > 1 && req.path.endsWith("/") && !req.path.startsWith("/api/")) {
      const query = req.url.slice(req.path.length);
      const safepath = req.path.slice(0, -1);
      res.redirect(301, safepath + query);
    } else {
      next();
    }
  });

  app.use(express.json());
  app.use("/api/", limiter);

  // Admin: Set Custom Role (Strictly Admin Only)
  app.post("/api/admin/set-role", authenticateUser, async (req, res) => {
    try {
      const { uid, role } = req.body;
      const caller = (req as any).user;

      // Strictly lock role assignment to actual admins only.
      // Bootstrap Exception: The project owner (takatam40725@gmail.com) can bypass during initialization.
      const isSystemAdmin = caller.role === "admin" || caller.email === "takatam40725@gmail.com";
      
      if (!isSystemAdmin) {
        return res.status(403).json({ error: "Forbidden: Admin access required for role management" });
      }

      // DISALLOW self-escalation if not already system admin
      // The current block already prevents this since any non-admin (even with same UID) would be caught by !isSystemAdmin.

      await admin.auth().setCustomUserClaims(uid, { role });
      await dbAdmin.collection("users").doc(uid).set({ role }, { merge: true });
      res.json({ success: true, message: `Role ${role} assigned correctly to ${uid}.` });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Self: Sync Claims (Self-service based on Firestore profile)
  app.post("/api/auth/sync-claims", authenticateUser, async (req, res) => {
    try {
      const { uid, email } = (req as any).user;
      const userDoc = await dbAdmin.collection("users").doc(uid).get();
      
      let role = "customer";
      if (userDoc.exists) {
        role = userDoc.data()?.role || "customer";
      }

      // Automatically upgrade to admin if email domain matches @pieroth.jp or is the bootstrap admin
      if (email && (email.endsWith("@pieroth.jp") || email === "takatam40725@gmail.com")) {
        role = "admin";
      }

      await admin.auth().setCustomUserClaims(uid, { role });
      
      // Update firestore too for consistency if it's different
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

  // Optimized Menu Endpoint (Bypasses client-side multiple roundtrips)
  app.get("/api/menu/:storeId", async (req, res) => {
    try {
      const { storeId } = req.params;
      
      // 1. Get Store Info
      const storeDoc = await dbAdmin.collection("stores").doc(storeId).get();
      if (!storeDoc.exists) return res.status(404).json({ error: "Store not found" });
      
      const storeData = storeDoc.data();
      // Omit private fields like owner_api_key
      const publicStoreData = {
        id: storeDoc.id,
        name: storeData?.name,
        address: storeData?.address,
        cuisine_type: storeData?.cuisine_type,
        hasAiSommelier: storeData?.hasAiSommelier,
        logo_url: storeData?.logo_url,
      };

      // 2. Get Inventory (Fetch all and filter in-memory to handle missing fields/defaults)
      const invSnap = await dbAdmin.collection("stores").doc(storeId).collection("inventory").get();
      
      const inventoryItems = invSnap.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter((item: any) => item.isActive !== false && item.visible !== false);
      
      const masterIds = inventoryItems.map((item: any) => item.id);

      // 3. Get Master Data in chunks
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

      res.setHeader("Cache-Control", "public, max-age=60"); // Cache for 1 minute for snappiness
      res.json({
        store: publicStoreData,
        menu: enrichedMenu,
      });
    } catch (error: any) {
      console.error("Menu Fetch Error:", error);
      res.status(500).json({ error: "メニューの取得に失敗しました。" });
    }
  });

  // Image Proxy to bypass Safari CORS/Referrer issues
  app.get("/api/proxy-image", async (req, res) => {
    const imageUrl = req.query.url as string;
    if (!imageUrl) return res.status(400).send("URL is required");

    try {
      const response = await fetch(imageUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Referer": "https://www.pieroth.jp/" 
        }
      });

      if (!response.ok) throw new Error(`External server returned ${response.status}`);

      const contentType = response.headers.get("content-type");
      if (contentType) res.setHeader("Content-Type", contentType);
      
      res.setHeader("Cache-Control", "public, max-age=86400"); // 1 day cache

      const arrayBuffer = await response.arrayBuffer();
      res.send(Buffer.from(arrayBuffer));
    } catch (error) {
      console.error("Proxy error:", error);
      res.status(500).send("Failed to proxy image");
    }
  });

  // In production, serve assets explicitly to avoid MIME type issues
  if (process.env.NODE_ENV === "production") {
    const distPath = path.resolve(__dirname);
    
    // Explicitly serve assets first with strict headers
    // Note: The order is critical. Assets MUST be served before the catch-all wildcard.
    app.use("/assets", express.static(path.join(distPath, "assets"), {
      immutable: true,
      maxAge: "1y",
      setHeaders: (res, filePath) => {
        res.set("X-Content-Type-Options", "nosniff");
        // Ensure correct JS/CSS MIME types for Safari / Path-based routing (/menu/..)
        if (filePath.endsWith(".js")) res.set("Content-Type", "application/javascript");
        if (filePath.endsWith(".css")) res.set("Content-Type", "text/css");
        if (filePath.endsWith(".svg")) res.set("Content-Type", "image/svg+xml");
      }
    }));
    
    app.use(express.static(distPath));
    
    // Catch-all route must be LAST and serve index.html from dist
    app.get("*", (req, res, next) => {
      // Skip API and assets strictly
      if (req.path.startsWith("/api/")) return next();
      
      // If the path has an extension, it's likely a missing asset, let it fall through to a 404
      // This prevents serving index.html as a .js or .css file (MIME type error)
      const hasExtension = /\.[a-z0-9]+$/i.test(req.path);
      if (hasExtension) {
        return next();
      }
      
      // Prevent index.html from being cached to avoid "White Page" on version updates
      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
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
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
