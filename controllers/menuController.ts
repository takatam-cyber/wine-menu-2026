// controllers/menuController.ts
import { RequestHandler } from "express";
import { dbAdmin } from "../lib/firebase-admin.js";

/**
 * 💡 [Enterprise Architecture] getMenu
 * APIを100%ステートレス化し、取引先側が書き込んだ `publicMenu` をSSOT(唯一の正)として一発取得。
 * 高頻度なエンドユーザーからのアクセスは、HTTP/CDNキャッシュ層で完璧に堰き止める。
 */
export const getMenu: RequestHandler = async (req, res, next) => {
  try {
    const { storeId } = req.params;

    // 1. 信頼できる唯一の情報源(stores/{storeId})からドキュメントを取得
    const storeDoc = await dbAdmin.collection("stores").doc(storeId).get();
    if (!storeDoc.exists) {
      res.status(404).json({ error: "Store not found" });
      return;
    }
    
    const storeData = storeDoc.data() || {};
    const publicStoreData = {
      id: storeDoc.id,
      name: storeData.name,
      address: storeData.address,
      cuisine_type: storeData.cuisine_type,
      hasAiSommelier: storeData.hasAiSommelier,
      logo_url: storeData.logo_url,
      hidePairingFilter: storeData.hidePairingFilter || false,
      hideWinePairing: storeData.hideWinePairing || false,
      budgetTiers: storeData.budgetTiers || null,
    };

    // 2. 管理画面側ですでに最適化・同期されている publicMenu 配列を利用
    const menu: any[] = storeData.publicMenu || [];

    // 3. 管理画面側で設定された `order` 順を厳格に評価。未定義のものは名称順でフォールバック
    const sortedMenu = menu.sort((a: any, b: any) => {
      const orderA = typeof a.order === "number" ? a.order : 999999;
      const orderB = typeof b.order === "number" ? b.order : 999999;
      if (orderA !== orderB) return orderA - orderB;
      return (a.name_jp || '').localeCompare(b.name_jp || '');
    });

    const responsePayload = {
      store: publicStoreData,
      menu: sortedMenu,
    };

    // 4. 魔法のHTTPキャッシュヘッダー (ロード時間0ms化 ＆ サーバー負荷激減)
    res.setHeader("X-Cache-Strategy", "Stateless-Edge");
    res.setHeader("Cache-Control", "public, max-age=15, s-maxage=15, stale-while-revalidate=30");
    res.json(responsePayload);
  } catch (error: any) {
    console.error("Menu Fetch Error:", error);
    res.status(500).json({ error: "メニューの取得に失敗しました。" });
  }
};

/**
 * 💡 [Enterprise Architecture] invalidateMenuCache
 * フロントエンド(storeRepository.ts等)からの破壊フェッチが残っているため、
 * エンドポイントとしての互換性を維持するために残存。内部のメモリパージ処理は全廃。
 */
export const invalidateMenuCache: RequestHandler = async (req, res, next) => {
  try {
    res.json({ success: true, message: "Cache strategy delegated to stateless CDN layer." });
  } catch (error) {
    res.status(500).json({ error: "Failed to invalidate cache" });
  }
};

/**
 * 💡 proxyImage
 * Google Drive等の画像を安全にプロキシするセキュアレイヤー
 */
export const proxyImage: RequestHandler = async (req, res, next) => {
  try {
    const imageUrl = req.query.url as string;
    if (!imageUrl) {
      res.status(400).send("URL parameter is required");
      return;
    }
    const url = new URL(imageUrl);
    const ALLOWED_DOMAINS = ["drive.google.com", "lh3.googleusercontent.com", "googleusercontent.com", "firebasestorage.googleapis.com"];
    const isAllowed = ALLOWED_DOMAINS.some(domain => url.hostname === domain || url.hostname.endsWith(`.${domain}`));
    if (!isAllowed) {
      res.status(403).send("Forbidden domain");
      return;
    }
    const response = await fetch(imageUrl);
    if (!response.ok) {
      res.status(response.status).send(`Failed to fetch image`);
      return;
    }
    const contentType = response.headers.get("content-type") || "image/jpeg";
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    res.send(buffer);
  } catch (error) {
    res.status(500).send("External imaging failure");
  }
};
