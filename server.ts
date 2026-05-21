// ============================================================================
// Pieroth Smart Menu Engine - Express サーバーコア層
// ============================================================================

import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { rateLimit } from "express-rate-limit";
import fs from "fs";

// APIルーティングのインポート
import authRoutes from "./routes/authRoutes.js";
import menuRoutes from "./routes/menuRoutes.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

/**
 * APIレートリミッター設定 (ブルートフォースおよびDoS攻撃からのインフラ保護)
 */
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分間
  max: 100, // 15分あたり最大100リクエスト
  message: { error: "リクエスト制限を超えました。15分後に再度お試しください。" },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // リバースプロキシ（Cloud Run等）経由の正確なクライアントIP抽出
    const xff = req.headers["x-forwarded-for"];
    if (typeof xff === "string") return xff.split(",")[0].trim();
    return (req.headers["forwarded"] as string) || req.ip || "unknown";
  },
});

async function startServer() {
  const app = express();
  const PORT = process.env.PORT || 3000;

  // プロキシ背後のIP信頼設定（Express Rate Limitを正確に動作させるために必須）
  app.set("trust proxy", 1);

  /**
   * ミドルウェア: トレイルスラッシュ (末尾スラッシュ) の厳格な標準化リダイレクト
   * 目的: SEO評価の分散防御およびSPAクライアントルーティングの相対パス解決エラーを防止
   */
  app.use((req, res, next) => {
    if (req.path.length > 1 && req.path.endsWith("/") && !req.path.startsWith("/api/")) {
      const query = req.url.slice(req.path.length);
      const safepath = req.path.slice(0, -1);
      return res.redirect(301, safepath + query);
    }
    next();
  });

  app.use(express.json());
  
  /**
   * APIスコープに対するセキュリティゲートマッピング
   * 特例ガード: 高頻度で消費される画像プロキシエンドポイントのみ、転送ハングアップを防ぐためリミッターから完全に除外
   */
  app.use("/api", (req, res, next) => {
    if (req.path === "/proxy-image") {
      return next();
    }
    limiter(req, res, next);
  });

  // APIエンドポイントのバインド
  app.use("/api", authRoutes);
  app.use("/api", menuRoutes);

  /**
   * 実行環境に応じた静的アセットおよびSPAの配信戦略
   */
  if (process.env.NODE_ENV === "production") {
    const distPath = path.resolve(__dirname);
    
    /**
     * 1. 構築済み静的コンパイルアセット層の配信設定
     * 拡張子ベースの崩壊を回避するため、Safari/iOS等で厳格に解釈されるMIMEタイプヘッダーを強制注入
     */
    app.use("/assets", express.static(path.join(distPath, "assets"), {
      immutable: true,
      maxAge: "1y", // ハッシュ付きファイルのため1年間の永続キャッシュを許可
      setHeaders: (res, filePath) => {
        res.set("X-Content-Type-Options", "nosniff");
        if (filePath.endsWith(".js")) res.set("Content-Type", "application/javascript");
        if (filePath.endsWith(".css")) res.set("Content-Type", "text/css");
        if (filePath.endsWith(".svg")) res.set("Content-Type", "image/svg+xml");
      }
    }));
    
    // ルート直下の静的ファイル配信
    app.use(express.static(distPath));
    
    /**
     * 2. 堅牢型 SPA Wildcard キャッチオールルーティング
     * 【バグ修正】: 拡張子を持つが実際にはサーバーに存在しないアセットリクエスト（タイポや古いビルドのJSなど）に対し、
     * 誤って index.html を返却してしまうと、ブラウザが HTML を JS としてパースし「MIMEタイプエラー」で画面が真っ白にフリーズします。
     * この致命的欠陥を防御するため、実ファイルが存在しないアセットリクエストは、インデックスを返さずに即座に404エラーを確定させます。
     */
    app.get("*", (req, res, next) => {
      // APIリクエストはキャッチオールから厳格に除外
      if (req.path.startsWith("/api/")) return next();
      
      // パス尾部にドット+英数字（拡張子形式）が存在するか検証
      const hasExtension = /\.[a-z0-9]+$/i.test(req.path);
      if (hasExtension) {
        // 実際のファイルがディスク上に存在するか同期確認（404の早期確定）
        const targetFilePath = path.join(distPath, req.path);
        if (!fs.existsSync(targetFilePath)) {
          return res.status(404).send("Asset not found");
        }
      }
      
      // 画面更新時（バージョンアップ時）の「古い画面キャッシュの固定化（ホワイトアウト）」を完全防止するノーキャッシュヘッダー
      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
      res.sendFile(path.join(distPath, "index.html"));
    });
  } else {
    /**
     * 開発環境: Vite HMR (Hot Module Replacement) ミドルウェアをシームレスに結合
     */
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  }

  // 指定ポートでのバインド起動
  app.listen(Number(PORT), "0.0.0.0", () => {
    console.log(`[Enterprise Server] Running securely on http://localhost:${PORT}`);
  });
}

startServer();
