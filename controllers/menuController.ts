import { Request, Response } from "express";
import { dbAdmin } from "../lib/firebase-admin.js";

// Server-side memory cache to shield Firestore from read spikes (B2B SaaS protection)
interface CacheEntry {
  data: any;
  expiresAt: number;
  hits: number;
  lastAccessedAt: number;
}

const menuCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 15000; // 15 seconds logic: balance between cost-saving and real-time stock sync
const MAX_CACHE_SIZE = 500; // Hard limit to prevent memory exhaustion (DoS/OOM protection)

/**
 * Atomic Garbage Collection with LRU logic:
 * 1. Purges strictly expired entries.
 * 2. If memory footprint is still above MAX_CACHE_SIZE, evicts Least Recently Used (LRU) entries.
 * This completely prevents cache thrashing for hot hyper-active stores (e.g. Roppongi stores).
 */
const performGC = () => {
  const now = Date.now();
  
  // 1. Strict Expiration Eviction
  for (const [storeId, entry] of menuCache.entries()) {
    if (entry.expiresAt < now) {
      menuCache.delete(storeId);
    }
  }
  
  // 2. Graceful LRU Eviction if over max capacity limit
  if (menuCache.size > MAX_CACHE_SIZE) {
    const entries = Array.from(menuCache.entries());
    
    // Sort entries by lastAccessedAt in ascending order (oldest access gets evicted first)
    entries.sort((a, b) => a[1].lastAccessedAt - b[1].lastAccessedAt);
    
    const countToEvict = menuCache.size - MAX_CACHE_SIZE;
    for (let i = 0; i < countToEvict; i++) {
      menuCache.delete(entries[i][0]);
    }
  }
};

// Periodic background cleanup every 10 minutes
setInterval(performGC, 10 * 60 * 1000).unref();

/**
 * Optimized menu fetcher using "1 Document Read" strategy and memory caching.
 * Fetches the store document which contains the pre-computed publicMenu snapshot.
 */
export const getMenu = async (req: Request, res: Response) => {
  try {
    const { storeId } = req.params;
    const now = Date.now();

    // 1. CACHE LAYER: Check memory cache first to avoid Firestore "Read" explosion
    const cached = menuCache.get(storeId);
    if (cached && cached.expiresAt > now) {
      // TELEMETRY: Register hit and update access recency (critical for LRU defense)
      cached.hits++;
      cached.lastAccessedAt = now;

      // Add debug headers to verify cache health without logs
      res.setHeader("X-Cache", "HIT");
      res.setHeader("Cache-Control", "public, max-age=15, s-maxage=15, stale-while-revalidate=30");
      return res.json(cached.data);
    }
    
    // 2. FETCH LAYER: Cache miss or expired - Fetch exactly 1 document from Firestore
    const storeDoc = await dbAdmin.collection("stores").doc(storeId).get();
    
    if (!storeDoc.exists) {
      return res.status(404).json({ error: "Store not found" });
    }
    
    const storeData = storeDoc.data() || {};
    
    // STRUCTURE: Separate store metadata from the menu payload
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

    // PERFORMANCE: Use denormalized publicMenu if available, fallback to empty array
    const menu = storeData.publicMenu || [];
    const responsePayload = {
      store: publicStoreData,
      menu: menu,
    };

    // 3. CACHE UPDATE: Update server-side memory for the next 15 seconds
    // Lazy GC check on write to keep memory clean even if setInterval is delayed
    if (menuCache.size >= MAX_CACHE_SIZE) performGC();
    
    menuCache.set(storeId, {
      data: responsePayload,
      expiresAt: now + CACHE_TTL_MS,
      hits: 1,
      lastAccessedAt: now,
    });

    // 4. RESPONSE HEADERS: Allow 15s of downstream caching (Browser/CDN)
    res.setHeader("X-Cache", "MISS");
    res.setHeader("Cache-Control", "public, max-age=15, s-maxage=15, stale-while-revalidate=30");
    
    res.json(responsePayload);
  } catch (error: any) {
    console.error("Menu Fetch Error:", error);
    res.status(500).json({ error: "メニューの取得に失敗しました。" });
  }
};

/**
 * Proxy image fetcher to bypass Safari ITP and other domain-related blocks.
 * Implements strong caching to minimize server egress.
 */
export const proxyImage = async (req: Request, res: Response) => {
  try {
    const imageUrl = req.query.url as string;
    if (!imageUrl) {
      return res.status(400).send("URL parameter is required");
    }

    const url = new URL(imageUrl);
    const ALLOWED_DOMAINS = ["drive.google.com", "lh3.googleusercontent.com", "googleusercontent.com", "firebasestorage.googleapis.com"];
    const isAllowed = ALLOWED_DOMAINS.some(domain => 
      url.hostname === domain || url.hostname.endsWith(`.${domain}`)
    );

    if (!isAllowed) {
      console.warn(`[Proxy] Blocked unauthorized domain: ${url.hostname}`);
      return res.status(403).send("Forbidden domain");
    }

    const response = await fetch(imageUrl);
    if (!response.ok) {
      return res.status(response.status).send(`Failed to fetch image: ${response.statusText}`);
    }

    const contentType = response.headers.get("content-type") || "image/jpeg";
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // PERSISTENT CACHING: Force 1 year browser cache to minimize egress costs
    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    res.send(buffer);
  } catch (error: any) {
    console.error("Proxy Image Error:", error);
    res.status(500).send("External imaging failure");
  }
};

/**
 * Express-level Cache Invalidator
 * Triggered by admin / owner modifications to guarantee near-instantaneous state updates.
 */
export const invalidateMenuCache = async (req: Request, res: Response) => {
  try {
    const { storeId } = req.params;
    if (storeId) {
      menuCache.delete(storeId);
      console.log(`[Cache Invalidation] Purged memory cache for storeId: ${storeId}`);
    }
    res.status(200).json({ success: true, message: `Cache successfully purged for storeId: ${storeId}` });
  } catch (error: any) {
    console.error("Cache Invalidation Error:", error);
    res.status(500).json({ error: "Failed to purge menu cache" });
  }
};

