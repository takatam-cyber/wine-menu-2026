// src/hooks/useInventoryQuery.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { storeRepository } from '../lib/repositories/storeRepository';
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

      // 【超絶最適化】winesMasterへのクエリを全廃止。
      // 在庫ドキュメント自体にすべての情報（非正規化データ）が含まれている前提でそのまま表示します。
      const enrichedWines: WineMaster[] = inventoryItems.map(item => ({
        ...(item as WineMaster),
        id: item.id.toUpperCase(),
        pureId: (item.pureId || item.id).toUpperCase(),
        supplier: (item.supplier || 'PIEROTH').toUpperCase(),
      }));

      // 日本語の名称順に綺麗にソートして返却
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
  // ... 既存の mutation ロジック ...
  return {
    updateStoreMutation: useMutation({ mutationFn: (data: Partial<Store>) => storeRepository.updateStore(storeId!, data) }),
    updateItemMutation: useMutation({ mutationFn: ({ itemId, data }: { itemId: string; data: any }) => storeRepository.updateInventoryItem(storeId!, itemId, data) }),
    deleteItemMutation: useMutation({ mutationFn: (itemId: string) => storeRepository.deleteInventoryItem(storeId!, itemId) }),
    addItemMutation: useMutation({ mutationFn: ({ itemId, data }: { itemId: string; data: any }) => storeRepository.addInventoryItem(storeId!, itemId, data) }),
  };
}
