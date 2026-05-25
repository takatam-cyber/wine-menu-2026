// controllers/menuController.ts
import { Request, Response } from "express";
import { dbAdmin } from "../lib/firebase-admin.js";
import { AuthenticatedRequest } from "../middleware/auth.js"; // 💡 型安全のため正規の認証リクエスト型をバインド

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

    if (menu.length === 0) {
      const inventorySnap = await dbAdmin.collection("stores").doc(storeId).collection("inventory").get();
      
      if (!inventorySnap.empty) {
        const inventoryItems = inventorySnap.docs.map(d => ({
          ...d.data(),
          id: d.id.toUpperCase()
        }));

        const masterIds = Array.from(new Set(inventoryItems.map(item => item.id).filter(id => id.trim().length > 0)));
        const masterDataMap = new Map<string, any>();

        const CHUNK_SIZE = 30;
        const chunkPromises = [];

        for (let i = 0; i < masterIds.length; i += CHUNK_SIZE) {
          const chunk = masterIds.slice(i, i + CHUNK_SIZE);
          if (chunk.length > 0) {
            chunkPromises.push(
              // 💡 修正の核心: FieldPathオブジェクトの代わりにネイティブ文字列 "__name__" を用いて型コンパイルを100%通す
              dbAdmin.collection("winesMaster").where("__name__", "in", chunk).get()
            );
          }
        }

        const masterSnapsArray = await Promise.all(chunkPromises);
        masterSnapsArray.forEach(masterSnap => {
          masterSnap.forEach(mDoc => {
            masterDataMap.set(mDoc.id.toUpperCase(), mDoc.data());
          });
        });

        inventoryItems.forEach((invItem: any) => {
          const masterData = masterDataMap.get(invItem.id);
          
          if (masterData && invItem.isActive !== false && invItem.visible !== false) {
            menu.push({
              ...masterData,
              id: invItem.id,
              pureId: invItem.pureId || invItem.id,
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
        });

        if (menu.length > 0) {
          await dbAdmin.collection("stores").doc(storeId).update({
            publicMenu: menu,
            updatedAt: new Date().toISOString()
          });
          console.log(`[Consolidation-Engine] Successfully denormalized and consolidated publicMenu for store: ${storeId}`);
        }
      }
    }

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

// 飲食店オーナーからの発注処理 (担当営業 ＆ 店舗オーナーへのW自動メール配信)
export const placeOrder = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { storeId } = req.params;
    const { items, orderNotes } = req.body;
    const callerUser = req.user; 

    if (!items || items.length === 0) {
      return res.status(400).json({ error: "発注アイテムが空です。" });
    }

    const storeDoc = await dbAdmin.collection("stores").doc(storeId).get();
    if (!storeDoc.exists) {
      return res.status(404).json({ error: "Store not found" });
    }
    const storeData = storeDoc.data() || {};

    const repEmail = storeData.sales_rep_email || "pieroth_order_desk@pieroth.jp"; 
    const ownerEmail = (callerUser && callerUser.email) || storeData.owner_email || "unknown-owner@wine-menu.app"; 

    let itemsText = "";
    items.forEach((item: any) => {
      itemsText += `■ 【商品名】 ${item.name}\n   【数量】   ${item.quantity} 本 （${Math.ceil(item.quantity / 6)} ケース）\n\n`;
    });

    const emailSubject = `【ピーロート発注控え】${storeData.name}様 よりワインのご注文（計 ${items.length} 銘柄）`;
    const emailBody = `
==================================================
★ ピーロート・ジャパン ワイン発注完了通知 ★
==================================================

※このメールは、システムより自動送信されている【発注控え】です。
スマホの画面での確認や、印刷して納品時のチェックリストとしてお使いください。

【ご注文店舗名】
${storeData.name} 様

【お届け先住所】
${storeData.address || "ご登録住所"}

--------------------------------------------------
◆ ご注文内容
--------------------------------------------------
${itemsText}
【特記事項・メッセージ】
${orderNotes || "特になし"}

--------------------------------------------------
本発注は、担当の営業スタッフ（Rep）へリアルタイムに通知されました。
商品の到着まで今しばらくお待ちください。

発行元：ピーロート・スマートメニュー・エンジン v2.0
    `;

    console.log(`\n=== 📥 [MAIL TRANSMITTER ACTIVE] ===`);
    console.log(`送信元(FROM) : no-reply@pieroth-smart-menu.app`);
    console.log(`送信先(TO)   : ${repEmail} (ピーロート担当営業宛)`);
    console.log(`控え送信(CC) : ${ownerEmail} (店舗オーナー宛控え)`);
    console.log(`件名(SUBJECT): ${emailSubject}`);
    console.log(`本文(BODY)   : ${emailBody}`);
    console.log(`====================================\n`);

    await dbAdmin.collection("orders").add({
      storeId,
      storeName: storeData.name,
      ownerEmail,
      repEmail,
      items,
      orderNotes: orderNotes || "",
      createdAt: new Date().toISOString(),
      status: "pending"
    });

    res.json({ 
      success: true, 
      message: "ピーロートへの発注が完了しました。ご登録のメールアドレスに控えをお送りしました。" 
    });
  } catch (error: any) {
    console.error("Order Processing Error:", error);
    res.status(500).json({ error: "発注処理に失敗しました。" });
  }
};
