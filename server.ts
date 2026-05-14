import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { rateLimit } from "express-rate-limit";

// Routes
import authRoutes from "./routes/authRoutes.js";
import menuRoutes from "./routes/menuRoutes.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

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

  // Use Routes
  app.use("/api", authRoutes);
  app.use("/api", menuRoutes);

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
