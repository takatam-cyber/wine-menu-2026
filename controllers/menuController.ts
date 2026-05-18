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
