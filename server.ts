import express, { Request, Response, NextFunction } from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { rateLimit } from "express-rate-limit";
import admin from "firebase-admin";
import { readFileSync } from "fs";
import apiRoutes from "./src/server/routes/api";

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

  // Trust Cloud Run's proxy
  app.set("trust proxy", 1);

  // Normalize trailing slashes
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

  // Mount API Routes
  app.use("/api", apiRoutes);

  // Health check
  app.get("/api/health", (req, res) => res.json({ status: "ok" }));

  // In production, serve assets explicitly
  if (process.env.NODE_ENV === "production") {
    const distPath = path.resolve(__dirname);
    
    app.use("/assets", express.static(path.join(distPath, "assets"), {
      immutable: true,
      maxAge: "1y",
      setHeaders: (res, filePath) => {
        res.set("X-Content-Type-Options", "nosniff");
        if (filePath.endsWith(".js")) res.set("Content-Type", "application/javascript");
        if (filePath.endsWith(".css")) res.set("Content-Type", "text/css");
        if (filePath.endsWith(".svg")) res.set("Content-Type", "image/svg+xml");
      }
    }));
    
    app.use(express.static(distPath));
    
    app.get("*", (req, res, next) => {
      if (req.path.startsWith("/api/")) return next();
      const hasExtension = /\.[a-z0-9]+$/i.test(req.path);
      if (hasExtension) return next();
      
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
