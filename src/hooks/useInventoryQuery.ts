import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { storeRepository } from '../lib/repositories/storeRepository';
import { db } from '../lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { WineMaster, Store } from '../types';

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

      // クォータ節約のための「in」一括取得（最大30件ずつチャンク処理してRead数を劇的に削減）
      const enrichedWines: WineMaster[] = [];
      const itemIds = inventoryItems.map(item => item.id);

      for (let i = 0; i < itemIds.length; i += 30) {
        const chunk = itemIds.slice(i, i + 30);
        const q = query(collection(db, 'winesMaster'), where('__name__', 'in', chunk));
        const masterSnaps = await getDocs(q);
        
        masterSnaps.forEach(docSnap => {
          const masterData = docSnap.data() as WineMaster;
          const invItem = inventoryItems.find(item => item.id === docSnap.id);
          if (invItem) {
            enrichedWines.push({ 
              ...masterData, 
              id: docSnap.id,
              pureId: masterData.id || docSnap.id,
              price_bottle: invItem.price_bottle ?? masterData.price_bottle,
              price_glass: invItem.price_glass ?? masterData.price_glass,
              cost: masterData.cost ?? 2000,
              glasses_per_bottle: invItem.glasses_per_bottle ?? 6,
              visible: invItem.visible ?? true,
              isFeatured: invItem.isFeatured ?? false,
              promoLabel: invItem.promoLabel || '',
              stock: invItem.stock ?? 0,
              isActive: invItem.isActive ?? true
            });
          }
        });
      }

      // マスターデータの登録順（name_jp順など）に綺麗にソートして返却
      const sortedWines = enrichedWines.sort((a, b) => (a.name_jp || '').localeCompare(b.name_jp || ''));

      return {
        store: storeData,
        inventory: sortedWines
      };
    },
    enabled: !!storeId,
    staleTime: 1000 * 60 * 5, // 5 minutes
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
    }
  });

  const updateItemMutation = useMutation({
    mutationFn: ({ itemId, data }: { itemId: string; data: any }) => {
      if (!storeId) throw new Error('No store ID');
      return storeRepository.updateInventoryItem(storeId, itemId, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory', storeId] });
    }
  });

  const deleteItemMutation = useMutation({
    mutationFn: (itemId: string) => {
      if (!storeId) throw new Error('No store ID');
      return storeRepository.deleteInventoryItem(storeId, itemId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory', storeId] });
    }
  });

  const addItemMutation = useMutation({
    mutationFn: ({ itemId, data }: { itemId: string; data: any }) => {
      if (!storeId) throw new Error('No store ID');
      return storeRepository.addInventoryItem(storeId, itemId, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory', storeId] });
    }
  });

  return {
    updateStoreMutation,
    updateItemMutation,
    deleteItemMutation,
    addItemMutation
  };
}
