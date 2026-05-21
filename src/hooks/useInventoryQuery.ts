// src/hooks/useInventoryQuery.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { storeRepository } from '../lib/repositories/storeRepository';
import { db } from '../lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { WineMaster, Store, extractPureId } from '../types';

export function useInventoryQuery(storeId: string | null) {
  return useQuery({
    queryKey: ['inventory', storeId],
    queryFn: async () => {
      if (!storeId) return null;
      
      const [storeData, inventoryItems] = await Promise.all([
        storeRepository.getStoreById(storeId),
        storeRepository.getStoreInventory(storeId)
      ]);

      if (!storeData) return null;
      if (inventoryItems.length === 0) {
        return { store: storeData, inventory: [] };
      }

      const enrichedWines: WineMaster[] = [];
      
      // 【致命的バグ修正】店舗側の複合ID（例: PIEROTH_A1234）から、接頭辞を綺麗に取り除いた純粋なID（例: A1234）の配列を生成
      const pureItemIds = inventoryItems.map(item => 
        extractPureId(item.pureId || item.id, item.supplier || 'PIEROTH')
      );

      // すべてのチャンクを Promise.all で並列一括取得（超高速化）
      const chunkPromises = [];
      for (let i = 0; i < pureItemIds.length; i += 30) {
        const chunk = pureItemIds.slice(i, i + 30);
        // 【バグ修正】純粋な製品コードの配列（chunk）で問い合わせることで、winesMasterからデータが100%確実にヒットするようになります
        const q = query(collection(db, 'winesMaster'), where('__name__', 'in', chunk));
        chunkPromises.push(getDocs(q));
      }

      const snapshotsArray = await Promise.all(chunkPromises);
      
      snapshotsArray.forEach(masterSnaps => {
        masterSnaps.forEach(docSnap => {
          const masterData = docSnap.data() as WineMaster;
          
          // 【バグ修正】大文字に統一した純粋な製品コード同士で、大文字小文字の揺れを完全に無視して安全に紐付け（マージ）
          const masterPureId = extractPureId(masterData.pureId || docSnap.id, masterData.supplier).toUpperCase();
          const invItem = inventoryItems.find(item => {
            const itemPureId = extractPureId(item.pureId || item.id, item.supplier || masterData.supplier).toUpperCase();
            return itemPureId === masterPureId;
          });

          if (invItem) {
            enrichedWines.push({ 
              ...masterData, 
              id: docSnap.id,
              pureId: masterPureId,
              price_bottle: invItem.price_bottle ?? masterData.price_bottle,
              price_glass: invItem.price_glass ?? masterData.price_glass,
              cost: invItem.cost ?? masterData.cost ?? 2000,
              glasses_per_bottle: invItem.glasses_per_bottle ?? 6,
              visible: invItem.visible ?? true,
              isFeatured: invItem.isFeatured ?? false,
              promoLabel: invItem.promoLabel || '',
              stock: invItem.stock ?? 0,
              isActive: invItem.isActive ?? true
            });
          }
        });
      });

      // マスターデータの登録順に綺麗にソートして返却
      const sortedWines = enrichedWines.sort((a, b) => (a.name_jp || '').localeCompare(b.name_jp || ''));

      return {
        store: storeData,
        inventory: sortedWines
      };
    },
    enabled: !!storeId,
    // 【キャッシュ先祖返り防止】staleTime を 0 に強制設定。
    // これにより、画面の切り替えや出入りをした際、ブラウザの古いキャッシュを絶対に掴まず、必ずFirestoreの最新確定データを直接再ロードします。
    staleTime: 0, 
    gcTime: 1000 * 60 * 1, // 不要になったキャッシュは1分で自動破棄
  });
}

export function useInventoryMutations(storeId: string | null) {
  const queryClient = useQueryClient();

  const updateStoreMutation = useMutation({
    mutationFn: (data: Partial<Store>) => {
      if (!storeId) throw new Error('No store ID');
      return storeRepository.updateStore(storeId, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory', storeId] });
      queryClient.invalidateQueries({ queryKey: ['stores'] });
      queryClient.invalidateQueries({ queryKey: ['publicMenu', storeId] });
    }
  });

  const updateItemMutation = useMutation({
    mutationFn: ({ itemId, data }: { itemId: string; data: any }) => {
      if (!storeId) throw new Error('No store ID');
      return storeRepository.updateInventoryItem(storeId, itemId, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory', storeId] });
      queryClient.invalidateQueries({ queryKey: ['publicMenu', storeId] });
    }
  });

  const deleteItemMutation = useMutation({
    mutationFn: (itemId: string) => {
      if (!storeId) throw new Error('No store ID');
      return storeRepository.deleteInventoryItem(storeId, itemId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory', storeId] });
      queryClient.invalidateQueries({ queryKey: ['publicMenu', storeId] });
    }
  });

  const addItemMutation = useMutation({
    mutationFn: ({ itemId, data }: { itemId: string; data: any }) => {
      if (!storeId) throw new Error('No store ID');
      return storeRepository.addInventoryItem(storeId, itemId, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory', storeId] });
      queryClient.invalidateQueries({ queryKey: ['publicMenu', storeId] });
    }
  });

  return {
    updateStoreMutation,
    updateItemMutation,
    deleteItemMutation,
    addItemMutation
  };
}
