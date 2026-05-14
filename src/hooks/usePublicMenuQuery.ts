import { useQuery } from '@tanstack/react-query';
import { Store, WineMaster } from '../types';

interface MenuData {
  store: Partial<Store>;
  menu: WineMaster[];
}

export function usePublicMenuQuery(storeId: string | null) {
  return useQuery<MenuData>({
    queryKey: ['publicMenu', storeId],
    queryFn: async () => {
      if (!storeId) throw new Error("Store ID is required");
      const response = await fetch(`/api/menu/${storeId}`);
      if (!response.ok) throw new Error("Failed to fetch menu");
      return response.json();
    },
    enabled: !!storeId,
    staleTime: 1000 * 60, // 1 minute (matching server cache)
  });
}
