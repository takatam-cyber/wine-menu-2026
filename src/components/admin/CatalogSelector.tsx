import React from 'react';
import { WineMaster, Store } from '../../types';
import { Search, X, CheckCircle2 } from 'lucide-react';
import { motion } from 'motion/react';

interface CatalogSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  selectedStore: Store | undefined;
  wines: WineMaster[];
  masterSearchTerm: string;
  setMasterSearchTerm: (term: string) => void;
  selectedWines: WineMaster[];
  selectedMasterIds: string[];
  toggleMasterSelection: (id: string) => void;
  handleBulkAddWines: () => void;
  hasMoreWines: boolean;
  onLoadMoreWines: () => void;
}

export const CatalogSelector: React.FC<CatalogSelectorProps> = ({
  isOpen,
  onClose,
  selectedStore,
  wines,
  masterSearchTerm,
  setMasterSearchTerm,
  selectedWines,
  selectedMasterIds,
  toggleMasterSelection,
  handleBulkAddWines,
  hasMoreWines,
  onLoadMoreWines,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 md:p-8">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-[40px] w-full max-w-5xl max-h-[85vh] flex flex-col overflow-hidden shadow-2xl"
      >
        <div className="p-8 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="serif text-2xl text-slate-900">マスターからワインを選択</h2>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">選択中の店舗: {selectedStore?.name}</p>
          </div>
          <button 
            onClick={onClose}
            className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-900 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-8 bg-slate-50 border-b border-slate-100">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input 
              placeholder="ワイン名、国、品種、コードで検索..."
              className="w-full bg-white border border-slate-200 rounded-2xl pl-12 pr-6 py-4 text-sm outline-none focus:border-brand-wine shadow-sm transition-all"
              value={masterSearchTerm}
              onChange={e => setMasterSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 md:p-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {wines.filter(w => 
              w.name_jp.toLowerCase().includes(masterSearchTerm.toLowerCase()) ||
              w.name_en.toLowerCase().includes(masterSearchTerm.toLowerCase()) ||
              w.country.toLowerCase().includes(masterSearchTerm.toLowerCase()) ||
              w.grape.toLowerCase().includes(masterSearchTerm.toLowerCase()) ||
              w.id.toLowerCase().includes(masterSearchTerm.toLowerCase())
            ).map(wine => {
              const isAlreadySelected = selectedWines.some(sw => sw.id === wine.id);
              const isChecked = selectedMasterIds.includes(wine.id);
              return (
                <div 
                  key={wine.id} 
                  onClick={() => !isAlreadySelected && toggleMasterSelection(wine.id)}
                  className={`bg-white p-6 rounded-3xl border transition-all flex gap-4 group cursor-pointer ${
                    isAlreadySelected 
                      ? 'border-slate-100 opacity-40 grayscale cursor-not-allowed' 
                      : isChecked 
                        ? 'border-brand-wine bg-brand-wine/5 shadow-md ring-2 ring-brand-wine/10' 
                        : 'border-slate-200 hover:border-brand-wine shadow-sm hover:shadow-md'
                  }`}
                >
                  <div className="flex flex-col items-center gap-4 shrink-0">
                    <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${
                      isChecked ? 'bg-brand-wine border-brand-wine text-white' : 'border-slate-200 bg-white'
                    }`}>
                      {isChecked && <CheckCircle2 className="w-4 h-4" />}
                    </div>
                    <div className="w-16 h-24 bg-slate-50 rounded-xl flex items-center justify-center p-2 border border-slate-100">
                      <img 
                        src={`/api/proxy-image?url=${encodeURIComponent(wine.image_url)}`} 
                        alt="" 
                        crossOrigin="anonymous"
                        referrerPolicy="no-referrer" 
                        className="h-full object-contain" 
                      />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[9px] font-bold text-brand-gold uppercase tracking-widest">{wine.country} • {wine.vintage}</div>
                    <h4 className="font-bold text-slate-900 text-xs mb-1 line-clamp-2">{wine.name_jp}</h4>
                    <p className="text-[10px] text-slate-500 font-mono italic mb-2">{wine.grape}</p>
                    <div className="flex items-center justify-between mt-auto">
                      <span className="text-[10px] font-bold text-slate-400">¥{wine.price_bottle?.toLocaleString()}</span>
                      {isAlreadySelected && (
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">追加済み</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {hasMoreWines && (
            <div className="py-10 flex justify-center">
              <button 
                onClick={onLoadMoreWines}
                className="px-10 py-4 bg-slate-50 border border-slate-200 rounded-full text-[10px] font-bold uppercase tracking-widest text-slate-500 hover:border-brand-wine hover:text-brand-wine transition-all shadow-sm"
              >
                さらにマスターデータを読み込む
              </button>
            </div>
          )}
        </div>

        <div className="p-8 border-t border-slate-100 bg-white flex items-center justify-between">
          <div className="text-sm font-bold text-slate-600">
            {selectedMasterIds.length > 0 ? (
              <span className="text-brand-wine animate-in fade-in zoom-in">{selectedMasterIds.length}件 選択中</span>
            ) : '追加するワインを選択してください'}
          </div>
          <div className="flex gap-4">
            <button 
              onClick={() => {
                 onClose();
              }}
              className="px-8 py-3 bg-slate-100 text-slate-600 rounded-full text-[11px] font-bold uppercase tracking-widest hover:bg-slate-200 transition-all"
            >
              キャンセル
            </button>
            <button 
              onClick={handleBulkAddWines}
              disabled={selectedMasterIds.length === 0}
              className="px-8 py-3 bg-brand-wine text-white rounded-full text-[11px] font-bold uppercase tracking-widest hover:scale-105 transition-all shadow-lg active:scale-95 disabled:opacity-30 disabled:scale-100"
            >
              選択したワインを追加
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
