// src/hooks/useInventoryQuery.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { storeRepository } from '../lib/repositories/storeRepository';
import { WineMaster, Store } from '../types';

export function useInventoryQuery(storeId: string | null) {
  return useQuery({
    queryKey: ['inventory', storeId],
    queryFn: async () => {
      if (!storeId) return null;
      
      // 1. 店舗の親ドキュメントのデータを取得
      const storeData = await storeRepository.getStoreById(storeId);
      if (!storeData) return null;

      // 【究極のバグ根治リファクタリング】
      // ご指摘の通り、一般顧客用メニューと完全に同じ「publicMenu」配列フィールドを
      // そのままダッシュボードのデータ参照先として一本化します。
      // これにより、サブコレクションとのIDマッチング漏れや、キャッシュの不整合による
      // 「画面を入り直すと0に戻る」というバグは、システムの構造上【物理的に発生不可能】になります。
      const enrichedWines: WineMaster[] = storeData.publicMenu || [];

      // マスターデータの登録順（名前順）に綺麗にソートして返却
      const sortedWines = [...enrichedWines].sort((a, b) => (a.name_jp || '').localeCompare(b.name_jp || ''));

      return {
        store: storeData,
        inventory: sortedWines
      };
    },
    enabled: !!storeId,
    // staleTimeを0にすることで、画面の出入り時や切り替え時に、古いキャッシュを無視して必ず最新のFirestoreデータを読み込みます
    staleTime: 0, 
    gcTime: 1000 * 60 * 1, // 不要になったキャッシュは1分で自動破棄
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
      queryClient.invalidateQueries({ queryKey: ['publicMenu', storeId] });
    }
  });

  const updateItemMutation = useMutation({
    mutationFn: ({ itemId, data }: { itemId: string; data: any }) => {
      if (!storeId) throw new Error('No store ID');
      return storeRepository.updateInventoryItem(storeId, itemId, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory', storeId] });
      queryClient.invalidateQueries({ queryKey: ['publicMenu', storeId] });
    }
  });

  const deleteItemMutation = useMutation({
    mutationFn: (itemId: string) => {
      if (!storeId) throw new Error('No store ID');
      return storeRepository.deleteInventoryItem(storeId, itemId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory', storeId] });
      queryClient.invalidateQueries({ queryKey: ['publicMenu', storeId] });
    }
  });

  const addItemMutation = useMutation({
    mutationFn: ({ itemId, data }: { itemId: string; data: any }) => {
      if (!storeId) throw new Error('No store ID');
      return storeRepository.addInventoryItem(storeId, itemId, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory', storeId] });
      queryClient.invalidateQueries({ queryKey: ['publicMenu', storeId] });
    }
  });

  return {
    updateStoreMutation,
    updateItemMutation,
    deleteItemMutation,
    addItemMutation
  };
}
