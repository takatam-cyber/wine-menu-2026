// src/hooks/useInventoryQuery.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { storeRepository } from '../lib/repositories/storeRepository';
import { db } from '../lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { WineMaster, Store } from '../types';

// ファイル単独で安全にIDをクレンジングする関数
const safeExtractPureId = (id: string | undefined, supplier?: string) => {
  if (!id) return '';
  const s = (supplier || 'PIEROTH').toUpperCase();
  const prefix = `${s}_`;
  if (id.toUpperCase().startsWith(prefix)) {
    return id.substring(prefix.length);
  }
  return id;
};

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
      const upperInventoryItems = inventoryItems.map(item => ({
        ...item,
        id: item.id.toUpperCase()
      }));

      const searchIds = new Set<string>();
      upperInventoryItems.forEach(item => {
        if (item.id) searchIds.add(item.id);
        const pure = safeExtractPureId(item.id, item.supplier).toUpperCase();
        if (pure) {
          searchIds.add(pure);
          searchIds.add(`${(item.supplier || 'PIEROTH').toUpperCase()}_${pure}`);
        }
      });

      // 【致命的クラッシュの修正】
      // Firebase の 'in' クエリに空文字が渡るとアプリが死ぬ（Invalid document ID）ため、
      // 空文字・空白・不正な接頭辞だけの文字列をここで完全に除去します。
      const searchIdsArray = Array.from(searchIds).filter(id => 
        id && id.trim().length > 0 && id !== 'PIEROTH_' && id !== 'OTHER_'
      );

      const chunkPromises = [];
      for (let i = 0; i < searchIdsArray.length; i += 30) {
        const chunk = searchIdsArray.slice(i, i + 30);
        // chunkが空のままクエリを投げないようにブロック
        if (chunk.length > 0) {
          const q = query(collection(db, 'winesMaster'), where('__name__', 'in', chunk));
          chunkPromises.push(getDocs(q));
        }
      }

      const snapshotsArray = await Promise.all(chunkPromises);
      
      snapshotsArray.forEach(masterSnaps => {
        masterSnaps.forEach(docSnap => {
          const masterData = docSnap.data() as WineMaster;
          const masterDocId = docSnap.id.toUpperCase();
          const masterPureId = safeExtractPureId(masterDocId, masterData.supplier).toUpperCase();
          
          const invItem = upperInventoryItems.find(item => {
            const itemPureId = safeExtractPureId(item.id, item.supplier || masterData.supplier).toUpperCase();
            // 純粋なID同士、または完全一致で照合
            return itemPureId === masterPureId || item.id === masterDocId;
          });

          if (invItem) {
            enrichedWines.push({ 
              ...masterData, 
              id: masterDocId,
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

      // 重複排除とソート（pureId がない場合は id をキーにする）
      const uniqueWines = Array.from(new Map(enrichedWines.map(w => [w.pureId || w.id, w])).values());
      const sortedWines = uniqueWines.sort((a, b) => (a.name_jp || '').localeCompare(b.name_jp || ''));

      return {
        store: storeData,
        inventory: sortedWines
      };
    },
    enabled: !!storeId,
    staleTime: 0, 
    gcTime: 1000 * 60 * 1,
    refetchOnWindowFocus: false,
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
