import { Request, Response } from "express";
import { dbAdmin } from "../lib/firebase-admin.js";

/**
 * Optimized menu fetcher using "1 Document Read" strategy.
 * Fetches the store document which now contains the pre-computed publicMenu snapshot.
 */
export const getMenu = async (req: Request, res: Response) => {
  try {
    const { storeId } = req.params;
    
    // FETCH: Only 1 Read from Firestore
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

    // COST CONTROL: Force browser caching for 5 minutes (300s) to reduce repeat reads
    res.setHeader("Cache-Control", "public, max-age=300");
    
    res.json({
      store: publicStoreData,
      menu: menu,
    });
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
    const isAllowed = ALLOWED_DOMAINS.some(domain => url.hostname.endsWith(domain));

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
