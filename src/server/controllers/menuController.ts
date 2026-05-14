import { Request, Response } from "express";
import admin from "firebase-admin";

export const menuController = {
  async getMenu(req: Request, res: Response) {
    try {
      const { storeId } = req.params;
      const db = admin.firestore();
      
      const storeDoc = await db.collection("stores").doc(storeId).get();
      if (!storeDoc.exists) return res.status(404).json({ error: "Store not found" });
      
      const storeData = storeDoc.data();
      const publicStoreData = {
        id: storeDoc.id,
        name: storeData?.name,
        address: storeData?.address,
        cuisine_type: storeData?.cuisine_type,
        hasAiSommelier: storeData?.hasAiSommelier,
        logo_url: storeData?.logo_url,
      };

      const invSnap = await db.collection("stores").doc(storeId).collection("inventory").get();
      const inventoryItems = invSnap.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter((item: any) => item.isActive !== false && item.visible !== false);
      
      const masterIds = inventoryItems.map((item: any) => item.id);

      const enrichedMenu: any[] = [];
      for (let i = 0; i < masterIds.length; i += 30) {
        const chunk = masterIds.slice(i, i + 30);
        const masterSnap = await db.collection("winesMaster")
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

      res.setHeader("Cache-Control", "public, max-age=60");
      res.json({
        store: publicStoreData,
        menu: enrichedMenu,
      });
    } catch (error: any) {
      console.error("Menu Fetch Error:", error);
      res.status(500).json({ error: "メニューの取得に失敗しました。" });
    }
  },

  async proxyImage(req: Request, res: Response) {
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
      
      res.setHeader("Cache-Control", "public, max-age=86400"); 

      const arrayBuffer = await response.arrayBuffer();
      res.send(Buffer.from(arrayBuffer));
    } catch (error) {
      console.error("Proxy error:", error);
      res.status(500).send("Failed to proxy image");
    }
  }
};
