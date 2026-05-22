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
      
      // サブコレクションから取得したドキュメントIDを大文字に統一
      const upperInventoryItems = inventoryItems.map(item => ({
        ...item,
        id: item.id.toUpperCase()
      }));

      // 【致命的バグの修正】
      // winesMaster コレクションのドキュメントIDは「PIEROTH_A1234」のような【複合ID】です。
      // 純粋なIDで検索すると空振りして0件になってしまうため、必ず複合IDのまま検索にかけます。
      const compositeItemIds = upperInventoryItems.map(item => item.id);

      const chunkPromises = [];
      for (let i = 0; i < compositeItemIds.length; i += 30) {
        const chunk = compositeItemIds.slice(i, i + 30);
        // 複合IDで検索するため、マスターデータから100%確実にヒットします
        const q = query(collection(db, 'winesMaster'), where('__name__', 'in', chunk));
        chunkPromises.push(getDocs(q));
      }

      const snapshotsArray = await Promise.all(chunkPromises);
      
      snapshotsArray.forEach(masterSnaps => {
        masterSnaps.forEach(docSnap => {
          const masterData = docSnap.data() as WineMaster;
          const masterDocId = docSnap.id.toUpperCase();
          
          // 大文字に統一した複合ID同士で、在庫データとマスターデータを確実に結合します
          const invItem = upperInventoryItems.find(item => item.id === masterDocId);

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

      // 日本語の名称順に綺麗にソート
      const sortedWines = enrichedWines.sort((a, b) => (a.name_jp || '').localeCompare(b.name_jp || ''));

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
