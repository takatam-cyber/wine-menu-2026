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
