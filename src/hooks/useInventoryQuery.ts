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
      
      // 棚1（店舗情報）と 棚2（店舗固有の在庫サブコレクション）を別々に並列取得
      const [storeData, inventoryItems] = await Promise.all([
        storeRepository.getStoreById(storeId),
        storeRepository.getStoreInventory(storeId)
      ]);

      if (!storeData) return null;
      if (inventoryItems.length === 0) {
        return { store: storeData, inventory: [] };
      }

      const enrichedWines: WineMaster[] = [];
      
      // 【棚の完全分離バグ修正】サブコレクションから取得したドキュメントIDをすべて「大文字」に完全統一
      const upperInventoryItems = inventoryItems.map(item => ({
        ...item,
        id: item.id.toUpperCase()
      }));

      // 問い合わせ用の製品コード（大文字）の配列を生成
      const pureItemIds = upperInventoryItems.map(item => 
        extractPureId(item.pureId || item.id, item.supplier || 'PIEROTH').toUpperCase()
      );

      // すべてのチャンクを Promise.all で並列一括取得（超高速化）
      const chunkPromises = [];
      for (let i = 0; i < pureItemIds.length; i += 30) {
        const chunk = pureItemIds.slice(i, i + 30);
        // 【バグ修正】ドキュメント名（__name__）に対して大文字の製品コードで検索するため、マスターから100%確実にヒットします
        const q = query(collection(db, 'winesMaster'), where('__name__', 'in', chunk));
        chunkPromises.push(getDocs(q));
      }

      const snapshotsArray = await Promise.all(chunkPromises);
      
      snapshotsArray.forEach(masterSnaps => {
        masterSnaps.forEach(docSnap => {
          const masterData = docSnap.data() as WineMaster;
          const masterDocId = docSnap.id.toUpperCase();
          
          // 大文字に完全統一したID同士で、店舗在庫の棚（棚2）とカタログの棚（棚3）を確実にマージします
          const invItem = upperInventoryItems.find(item => {
            const itemCompId = extractPureId(item.id, item.supplier || masterData.supplier).toUpperCase();
            const masterCompId = extractPureId(masterDocId, masterData.supplier).toUpperCase();
            return itemCompId === masterCompId;
          });

          if (invItem) {
            enrichedWines.push({ 
              ...masterData, 
              id: masterDocId,
              pureId: extractPureId(masterDocId, masterData.supplier).toUpperCase(),
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
    // staleTimeを0にすることで、画面の切り替えや出入りをした際、ブラウザの古いキャッシュを絶対に掴まず最新のFirestoreデータをロードします
    staleTime: 0, 
    gcTime: 1000 * 60 * 1,
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
