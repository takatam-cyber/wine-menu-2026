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
    staleTime: 0, // Disable client-side caching to ensure real-time stock sync
    refetchOnWindowFocus: true, // Auto-refresh data when customer re-opens the browser TAB
    refetchInterval: 1000 * 60 * 2, // Every 2 minutes background refresh as fail-safe
  });
}
