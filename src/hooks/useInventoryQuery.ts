import { useQuery } from '@tanstack/react-query';
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
      // Optimized: Fetch in chunks if many
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
