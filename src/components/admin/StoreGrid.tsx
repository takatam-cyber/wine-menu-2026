// src/components/admin/StoreGrid.tsx
import React from 'react';
import { Store } from '../../types';
import { motion } from 'motion/react';
import { Wine, Trash2, Shield } from 'lucide-react';
import { useWines } from '../../lib/WineContext';

interface StoreGridProps {
  stores: Store[];
  hasMoreStores: boolean;
  onLoadMoreStores: () => void;
  onCreateStore: () => void;
  onDeleteStore: (storeId: string) => void;
  onSelectStore: (storeId: string) => void;
}

export const StoreGrid: React.FC<StoreGridProps> = ({
  stores,
  hasMoreStores,
  onLoadMoreStores,
  onCreateStore,
  onDeleteStore,
  onSelectStore,
}) => {
  const { showConfirm } = useWines();

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 md:gap-8">
      {stores.map(store => (
        <motion.div
          key={store.id}
          whileHover={{ y: -8, boxShadow: "0 20px 25px -5px rgb(0 0 0 / 0.1)" }}
          onClick={() => onSelectStore(store.id)}
          className="bg-white p-8 rounded-3xl border border-slate-200 cursor-pointer transition-all flex flex-col justify-between h-56 shadow-sm group"
        >
          <div>
            <div className="flex justify-between items-start mb-6">
              <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center border border-slate-100 group-hover:bg-brand-wine group-hover:text-white transition-colors shadow-inner">
                <Wine className="w-7 h-7" />
              </div>
              <div className="flex flex-col items-end gap-2 relative z-[60]">
                <span className={`text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full ${store.isActive ? 'bg-green-50 text-green-600 border border-green-100' : 'bg-red-50 text-red-600 border border-red-100'}`}>
                  {store.isActive ? '稼働中' : '停止中'}
                </span>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    showConfirm(
                      `「${store.name}」を完全にシステムから削除してよろしいですか？`,
                      () => onDeleteStore(store.id),
                      'この操作を行うと、店舗に関連付けられたセラー情報や公開メニューURLもすべて即座に無効化されます。'
                    );
                  }}
                  className="flex items-center justify-center p-2.5 bg-red-500 text-white rounded-full hover:bg-red-600 transition-all shadow-xl active:scale-95 pointer-events-auto"
                  title="店舗を削除"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
            <h3 className="serif text-xl text-slate-900 group-hover:text-brand-wine transition-colors">{store.name}</h3>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-[0.2em] mt-1">{store.cuisine_type}</p>
          </div>
          <div className="flex items-center justify-between mt-6 pt-6 border-t border-slate-50">
            <div className="flex flex-col">
              <span className="text-xs text-slate-400 font-bold uppercase tracking-tighter">稼働状況</span>
              <span className="text-xs font-bold text-slate-700">{store.isActive ? '営業中' : '停止中'}</span>
            </div>
          </div>
        </motion.div>
      ))}
      
      {hasMoreStores && (
        <div className="col-span-full py-10 flex justify-center">
          <button 
            onClick={onLoadMoreStores}
            className="px-10 py-4 bg-white border border-slate-200 rounded-full text-xs font-bold uppercase tracking-widest text-slate-500 hover:border-brand-wine hover:text-brand-wine transition-all shadow-sm"
          >
            さらに読み込む (12件ずつ)
          </button>
        </div>
      )}

      {stores.length === 0 && (
        <div className="col-span-full py-32 text-center bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
          <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm">
            <Shield className="w-10 h-10 text-slate-200" />
          </div>
          <p className="serif italic text-2xl text-slate-300">管理店舗が登録されていません</p>
          <button onClick={onCreateStore} className="mt-8 text-brand-wine font-bold uppercase text-xs tracking-widest hover:underline">最初の店舗を登録する</button>
        </div>
      )}
    </div>
  );
};
