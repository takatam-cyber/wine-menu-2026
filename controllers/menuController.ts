// controllers/menuController.ts
import { Request, Response } from "express";
import { dbAdmin } from "../lib/firebase-admin.js";

interface CacheEntry {
  data: any;
  expiresAt: number;
  hits: number;
  lastAccessedAt: number;
}

const menuCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 15000; 
const MAX_CACHE_SIZE = 500; 

const performGC = () => {
  const now = Date.now();
  for (const [storeId, entry] of menuCache.entries()) {
    if (entry.expiresAt < now) menuCache.delete(storeId);
  }
  if (menuCache.size > MAX_CACHE_SIZE) {
    const entries = Array.from(menuCache.entries()).sort((a, b) => a[1].lastAccessedAt - b[1].lastAccessedAt);
    const countToEvict = menuCache.size - MAX_CACHE_SIZE;
    for (let i = 0; i < countToEvict; i++) menuCache.delete(entries[i][0]);
  }
};
setInterval(performGC, 10 * 60 * 1000).unref();

export const getMenu = async (req: Request, res: Response) => {
  try {
    const { storeId } = req.params;
    const now = Date.now();

    const cached = menuCache.get(storeId);
    if (cached && cached.expiresAt > now) {
      cached.hits++;
      cached.lastAccessedAt = now;
      res.setHeader("X-Cache", "HIT");
      res.setHeader("Cache-Control", "public, max-age=15, s-maxage=15, stale-while-revalidate=30");
      return res.json(cached.data);
    }
    
    const storeDoc = await dbAdmin.collection("stores").doc(storeId).get();
    if (!storeDoc.exists) {
      return res.status(404).json({ error: "Store not found" });
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

    let menu = storeData.publicMenu || [];

    // 【無課金運用＆後方互換性バグ修正】
    // すでに運用中の200店舗など、「まだ一括保存ボタンを押しておらず publicMenu が作られていない店舗」の場合、
    // 配列が空っぽになってお客様メニューが消える（準備中になる）バグを防ぐため、従来の方式で自動補完（フォールバック）します。
    if (menu.length === 0) {
      const inventorySnap = await dbAdmin.collection("stores").doc(storeId).collection("inventory").get();
      
      if (!inventorySnap.empty) {
        const inventoryItems = inventorySnap.docs.map(d => ({
          ...d.data(),
          id: d.id.toUpperCase()
        }));

        const masterPromises = inventoryItems.map(item => 
          dbAdmin.collection("winesMaster").doc(item.id).get()
        );
        
        const masterSnaps = await Promise.all(masterPromises);

        masterSnaps.forEach((mSnap, idx) => {
          if (mSnap.exists) {
            const masterData = mSnap.data() || {};
            const invItem: any = inventoryItems[idx];

            // 表示設定がONのものだけをお客様メニューにマージ
            if (invItem.isActive !== false && invItem.visible !== false) {
              menu.push({
                ...masterData,
                id: mSnap.id,
                pureId: invItem.pureId || mSnap.id,
                price_bottle: invItem.price_bottle ?? masterData.price_bottle,
                price_glass: invItem.price_glass ?? masterData.price_glass,
                cost: invItem.cost ?? masterData.cost ?? 2000,
                glasses_per_bottle: invItem.glasses_per_bottle ?? 6,
                visible: true,
                isFeatured: invItem.isFeatured ?? false,
                promoLabel: invItem.promoLabel || '',
                stock: invItem.stock ?? 0,
                isActive: true
              });
            }
          }
        });
      }
    }

    // 日本語の名称順に綺麗にソート
    const sortedMenu = menu.sort((a: any, b: any) => (a.name_jp || '').localeCompare(b.name_jp || ''));

    const responsePayload = {
      store: publicStoreData,
      menu: sortedMenu,
    };

    if (menuCache.size >= MAX_CACHE_SIZE) performGC();
    
    menuCache.set(storeId, {
      data: responsePayload,
      expiresAt: now + CACHE_TTL_MS,
      hits: 1,
      lastAccessedAt: now,
    });

    res.setHeader("X-Cache", "MISS");
    res.setHeader("Cache-Control", "public, max-age=15, s-maxage=15, stale-while-revalidate=30");
    res.json(responsePayload);
  } catch (error: any) {
    console.error("Menu Fetch Error:", error);
    res.status(500).json({ error: "メニューの取得に失敗しました。" });
  }
};

export const proxyImage = async (req: Request, res: Response) => {
  try {
    const imageUrl = req.query.url as string;
    if (!imageUrl) return res.status(400).send("URL parameter is required");
    const url = new URL(imageUrl);
    const ALLOWED_DOMAINS = ["drive.google.com", "lh3.googleusercontent.com", "googleusercontent.com", "firebasestorage.googleapis.com"];
    const isAllowed = ALLOWED_DOMAINS.some(domain => url.hostname === domain || url.hostname.endsWith(`.${domain}`));
    if (!isAllowed) return res.status(403).send("Forbidden domain");
    const response = await fetch(imageUrl);
    if (!response.ok) return res.status(response.status).send(`Failed to fetch image`);
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

export const invalidateMenuCache = (req: Request, res: Response) => {
  try {
    const { storeId } = req.params;
    menuCache.delete(storeId);
    res.json({ success: true, message: "Cache invalidated" });
  } catch (error) {
    res.status(500).json({ error: "Failed to invalidate cache" });
  }
};
