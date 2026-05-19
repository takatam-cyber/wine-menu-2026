import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { wineRepository } from '../lib/repositories/wineRepository';
import { WineMaster } from '../types';

export const useWinesMasterQuery = () => {
  return useInfiniteQuery({
    queryKey: ['winesMaster'],
    queryFn: ({ pageParam }) => wineRepository.getWinesMaster(50, pageParam),
    initialPageParam: null as any,
    getNextPageParam: (lastPage) => lastPage.hasMore ? lastPage.lastDoc : undefined,
  });
};

export const useWinesSearchQuery = (term: string) => {
  return useQuery({
    queryKey: ['winesMasterSearch', term],
    queryFn: () => wineRepository.searchWinesMaster(term),
    enabled: !!term,
  });
};

/**
 * useWineDetailQuery
 * Fetches rich master data for a specific wine by its composite ID.
 * This pattern (Delayed Detail Fetch) avoids fetching heavy sommelier notes (AI explanations, aroma) 
 * for the entire menu list, ensuring high performance for the Public Menu.
 */
export const useWineDetailQuery = (wineId: string | null) => {
  return useQuery({
    queryKey: ['wineDetail', wineId],
    queryFn: async (): Promise<WineMaster | null> => {
      if (!wineId) return null;
      return wineRepository.getWineById(wineId);
    },
    enabled: !!wineId,
    staleTime: 1000 * 60 * 60, // 1 hour stale time for stable master data
    gcTime: 1000 * 60 * 60 * 24, // Keep in cache for 24 hours
  });
};
