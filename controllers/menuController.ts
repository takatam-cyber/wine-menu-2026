import { Request, Response } from "express";
import { dbAdmin, FieldPath, drive } from "../lib/firebase-admin.js";

// SSRF Protection: List of allowed domains
const ALLOWED_DOMAINS = [
  "drive.google.com",
  "lh3.googleusercontent.com",
  "pieroth.jp",
  "www.pieroth.jp",
  "res.cloudinary.com"
];

const extractDriveFileId = (url: string): string | null => {
  if (!url) return null;
  
  // High-confidence patterns for Google Drive
  const patterns = [
    /\/file\/d\/([a-zA-Z0-9_-]{25,})/i,
    /[?&]id=([a-zA-Z0-9_-]{25,})/i,
    /drive\.google\.com\/open\?id=([a-zA-Z0-9_-]{25,})/i,
    /drive\.google\.com\/uc\?id=([a-zA-Z0-9_-]{25,})/i
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) return match[1];
  }
  return null;
};

export const getMenu = async (req: Request, res: Response) => {
  // ... existing implementation remains solid ...
  // (Full context used in replacement below)
  try {
    const { storeId } = req.params;
    
    const storeDoc = await dbAdmin.collection("stores").doc(storeId).get();
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

    const invSnap = await dbAdmin.collection("stores").doc(storeId).collection("inventory").get();
    
    const inventoryItems = invSnap.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .filter((item: any) => item.isActive !== false && item.visible !== false);
    
    const masterIds = inventoryItems.map((item: any) => item.id);

    const enrichedMenu: any[] = [];
    for (let i = 0; i < masterIds.length; i += 30) {
      const chunk = masterIds.slice(i, i + 30);
      const masterSnap = await dbAdmin.collection("winesMaster")
        .where(FieldPath.documentId(), "in", chunk)
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
};

export const proxyImage = async (req: Request, res: Response) => {
  const imageUrl = req.query.url as string;
  if (!imageUrl) return res.status(400).send("URL is required");

  // Logic 1: Check for Google Drive URL
  const driveFileId = extractDriveFileId(imageUrl);
  
  if (driveFileId) {
    try {
      const gResponse: any = await drive.files.get(
        { fileId: driveFileId, alt: "media" },
        { responseType: "stream" }
      );

      // Pass through content type from Drive
      const contentType = gResponse.headers["content-type"];
      if (contentType) res.setHeader("Content-Type", contentType);
      
      res.setHeader("Cache-Control", "public, max-age=86400"); // 1 day
      gResponse.data.pipe(res);
      return;
    } catch (error) {
      console.error("Drive Proxy Error:", error);
      // Fallback to standard fetch if API fails or ID was wrong
    }
  }

  // Logic 2: Standard Proxy with Domain Validation
  try {
    const parsedUrl = new URL(imageUrl);
    if (!ALLOWED_DOMAINS.some(d => parsedUrl.hostname.endsWith(d))) {
      console.warn(`Blocked proxy request to unauthorized domain: ${parsedUrl.hostname}`);
      return res.status(403).send("Domain not allowed");
    }

    const response = await fetch(imageUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (WineCatalogProxy/1.0)",
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
};
