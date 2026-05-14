import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { storeRepository } from '../lib/repositories/storeRepository';
import { wineRepository } from '../lib/repositories/wineRepository';
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

      // Enrich inventory with master data
      const enriched = await Promise.all(inventoryItems.map(async (item) => {
        const master = await wineRepository.getWineById(item.id);
        if (!master) return null;

        return { 
          ...master, 
          isActive: item.isActive ?? true, 
          visible: item.visible ?? true,
          isFeatured: item.isFeatured ?? false,
          promoLabel: item.promoLabel || '',
          price_bottle: item.price_bottle || master.price_bottle,
          price_glass: item.price_glass || master.price_glass,
          stock: item.stock ?? master.stock,
          cost: master.cost || 2000
        };
      }));

      return {
        store: storeData,
        inventory: enriched.filter(w => w !== null) as WineMaster[]
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
