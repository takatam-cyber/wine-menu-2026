import { Request, Response } from "express";
import { dbAdmin } from "../lib/firebase-admin.js";

// サーバーサイド・インメモリキャッシュの構造定義（B2B SaaS防御レイヤー）
interface CacheEntry {
  data: any;
  expiresAt: number;
  hits: number;
  lastAccessedAt: number;
}

// メモリ枯渇を防ぐため、スレッドセーフな組み込みMapでキャッシュを管理
const menuCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 15000; // 有効期限15秒（コスト削減とリアルタイム在庫同期の最適閾値）
const MAX_CACHE_SIZE = 500; // メモリ枯渇 (OOM) および DoS 攻撃を防ぐ上限境界線

/**
 * アトミック・ガベージコレクション (LRUロジック内蔵)
 * 1. 期限切れの古いエントリーを厳格に走査して排除
 * 2. 依然として上限サイズを超過している場合、最もアクセスが古いエントリーから順に間引く
 */
const performGC = () => {
  const now = Date.now();
  
  // 1. 期限切れキャッシュの即時解放
  for (const [storeId, entry] of menuCache.entries()) {
    if (entry.expiresAt < now) {
      menuCache.delete(storeId);
    }
  }
  
  // 2. キャッシュサイズ制限超過時のLRUエビクション
  if (menuCache.size > MAX_CACHE_SIZE) {
    const entries = Array.from(menuCache.entries());
    
    // 最後にアクセスされたタイムスタンプの昇順でソート（最も古いものを先頭に）
    entries.sort((a, b) => a[1].lastAccessedAt - b[1].lastAccessedAt);
    
    const countToEvict = menuCache.size - MAX_CACHE_SIZE;
    for (let i = 0; i < countToEvict; i++) {
      menuCache.delete(entries[i][0]);
    }
  }
};

// 10分ごとのバックグラウンド定期クリーンアップ（unrefによりイベントループの終了を妨げない）
setInterval(performGC, 10 * 60 * 1000).unref();

/**
 * 公開メニュー取得エンドポイント (高パフォーマンス1ドキュメントリード戦略)
 */
export const getMenu = async (req: Request, res: Response) => {
  try {
    const { storeId } = req.params;
    const now = Date.now();

    // 1. キャッシュレイヤーチェック: メモリに有効なデータがあればFirestoreリードを徹底回避
    const cached = menuCache.get(storeId);
    if (cached && cached.expiresAt > now) {
      cached.hits++;
      cached.lastAccessedAt = now;

      res.setHeader("X-Cache", "HIT");
      res.setHeader("Cache-Control", "public, max-age=15, s-maxage=15, stale-while-revalidate=30");
      return res.json(cached.data);
    }
    
    // 2. フェッチレイヤー: キャッシュミス時、Firestoreから非正規化ストアデータを1ドキュメントのみ取得
    const storeDoc = await dbAdmin.collection("stores").doc(storeId).get();
    
    if (!storeDoc.exists) {
      return res.status(404).json({ error: "Store not found" });
    }
    
    const storeData = storeDoc.data() || {};
    
    // クライアントに必要なパブリックメタデータのみを選別抽出（セキュリティカプセル化）
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

    // 非正規化 publicMenu スナップショットを優先割り当て
    const menu = storeData.publicMenu || [];
    const responsePayload = {
      store: publicStoreData,
      menu: menu,
    };

    // 3. キャッシュの書き込み更新
    if (menuCache.size >= MAX_CACHE_SIZE) performGC();
    
    menuCache.set(storeId, {
      data: responsePayload,
      expiresAt: now + CACHE_TTL_MS,
      hits: 1,
      lastAccessedAt: now,
    });

    // 4. ダウンストリーム(CDN/ブラウザ)に対する15秒間のキャッシュ制御指示設定
    res.setHeader("X-Cache", "MISS");
    res.setHeader("Cache-Control", "public, max-age=15, s-maxage=15, stale-while-revalidate=30");
    
    res.json(responsePayload);
  } catch (error: any) {
    console.error("Menu Fetch Error:", error);
    res.status(500).json({ error: "メニューの取得に失敗しました。" });
  }
};

/**
 * 外部画像安全プロキシ (Safari ITP / サードパーティクッキー規制 / ドメインブロック回避層)
 */
export const proxyImage = async (req: Request, res: Response) => {
  try {
    const imageUrl = req.query.url as string;
    if (!imageUrl || !imageUrl.trim().startsWith("http")) {
      // 不正または空のURLが渡された場合は、クライアント側でのクラッシュを防ぐため、透明な1x1のダミーGIFを安全に返却する（耐障害性ガード）
      res.setHeader("Content-Type", "image/gif");
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      return res.send(Buffer.from("R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=", "base64"));
    }

    const url = new URL(imageUrl);
    const ALLOWED_DOMAINS = [
      "drive.google.com", 
      "lh3.googleusercontent.com", 
      "googleusercontent.com", 
      "firebasestorage.googleapis.com"
    ];
    
    const isAllowed = ALLOWED_DOMAINS.some(domain => 
      url.hostname === domain || url.hostname.endsWith(`.${domain}`)
    );

    if (!isAllowed) {
      console.warn(`[Proxy-Security] Blocked unauthorized imaging domain: ${url.hostname}`);
      return res.status(403).send("Forbidden domain");
    }

    const response = await fetch(imageUrl);
    if (!response.ok) {
      return res.status(response.status).send(`Failed to fetch image: ${response.statusText}`);
    }

    const contentType = response.headers.get("content-type") || "image/jpeg";
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // インフラの下り転送コスト（Egress）を極限まで抑制するため、ブラウザに1年間の超強力不変キャッシュを強制指示
    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    res.send(buffer);
  } catch (error: any) {
    console.error("Proxy Image Failure:", error);
    // 実行時エラー発生時も、フロントエンドのハングアップを防ぐため1x1透明画像で安全にフォールバック
    res.setHeader("Content-Type", "image/gif");
    res.send(Buffer.from("R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=", "base64"));
  }
};

/**
 * キャッシュバスター・インジェクション (Cache Invalidator)
 * 解決策: Firestoreのレプリケーション遅延ラグを打破するため、
 * リクエストBODYに最新データがある場合は再フェッチせず、メモリへ直接キャッシュデータを「先行注入(Upsert)」する。
 */
export const invalidateMenuCache = async (req: Request, res: Response) => {
  try {
    const { storeId } = req.params;
    const { store, menu } = req.body; // クライアントから送信された確定カーネルペイロード

    if (storeId) {
      if (store && menu) {
        // 【一貫性注入戦略】Firestoreへの伝播完了を待たず、確定状態を直接インメモリキャッシュに割り当て
        const now = Date.now();
        menuCache.set(storeId, {
          data: { store, menu },
          expiresAt: now + CACHE_TTL_MS,
          hits: 1,
          lastAccessedAt: now
        });
        console.log(`[Cache-Upsert] Successfully injected deterministic memory cache for storeId: ${storeId}`);
      } else {
        // ペイロードが未送信の通常クリーン型リクエスト時は、単純パージを実行
        menuCache.delete(storeId);
        console.log(`[Cache-Purge] Evicted memory cache for storeId: ${storeId}`);
      }
    }
    res.status(200).json({ success: true, message: `Cache updated successfully for storeId: ${storeId}` });
  } catch (error: any) {
    console.error("Cache Invalidation Error:", error);
    res.status(500).json({ error: "Failed to purge menu cache" });
  }
};
