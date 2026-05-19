import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { wineRepository } from '../lib/repositories/wineRepository';

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

export const useWineDetailQuery = (wineId: string | null) => {
  return useQuery({
    queryKey: ['wineDetail', wineId],
    queryFn: () => wineId ? wineRepository.getWineById(wineId) : null,
    enabled: !!wineId,
    staleTime: 1000 * 60 * 10, // 10 minutes cache for master data
  });
};
