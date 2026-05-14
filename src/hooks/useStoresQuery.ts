import { useInfiniteQuery } from '@tanstack/react-query';
import { storeRepository } from '../lib/repositories/storeRepository';
import { UserProfile } from '../types';

export const useStoresQuery = (user: UserProfile | null) => {
  return useInfiniteQuery({
    queryKey: ['stores', user?.uid],
    queryFn: ({ pageParam }) => storeRepository.getStores(user!, 12, pageParam),
    initialPageParam: null as any,
    getNextPageParam: (lastPage) => lastPage.hasMore ? lastPage.lastDoc : undefined,
    enabled: !!user,
  });
};
