// src/components/admin/MasterCatalog.tsx
import React, { useState, useMemo, useEffect } from 'react';
import { WineMaster } from '../../types';
import { Search, Edit2, Filter, Wine, ChevronLeft, ChevronRight, CheckCircle2, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface MasterCatalogProps {
  wines: WineMaster[];
  masterSearchTerm: string;
  onSearchMaster: (term: string) => void;
  isEditingMaster: boolean;
  editingMasterWine: WineMaster | null;
  editMasterData: any;
  setEditMasterData: (data: any) => void;
  onStartEditingMaster: (wine: WineMaster) => void;
  onUpdateMaster: () => void;
  onCancelEditMaster: () => void;
  // 新機能一括削除用プロップス
  selectedMasterCatalogIds: string[];
  setSelectedMasterCatalogIds: React.Dispatch<React.SetStateAction<string[]>>;
  onBulkDeleteWines: () => void;
  hasMoreWines: boolean;
  onLoadMoreWines: () => void;
}

export const MasterCatalog: React.FC<MasterCatalogProps> = ({
  wines,
  masterSearchTerm,
  onSearchMaster,
  onStartEditingMaster,
  selectedMasterCatalogIds,
  setSelectedMasterCatalogIds,
  onBulkDeleteWines,
  hasMoreWines,
  onLoadMoreWines,
}) => {
  const [activeTab, setActiveTab] = useState<'PIEROTH' | 'OTHER'>('PIEROTH');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  // タブ切り替え時に選択状態とページを初期化
  useEffect(() => {
    setCurrentPage(1);
    setSelectedMasterCatalogIds([]);
  }, [activeTab, setSelectedMasterCatalogIds]);

  useEffect(() => {
    setCurrentPage(1);
  }, [masterSearchTerm]);

  // 現在のタブに応じたワイン抽出
  const tabWines = useMemo(() => {
    return wines.filter(w => {
      const s = (w.supplier || 'PIEROTH').toUpperCase();
      return activeTab === 'PIEROTH' ? s === 'PIEROTH' : s === 'OTHER';
    });
  }, [wines, activeTab]);

  // 検索ヒット条件
  const filteredWines = useMemo(() => {
    return tabWines.filter(w => {
      if (!masterSearchTerm) return true;
      const t = masterSearchTerm.toLowerCase();
      return (
        w.name_jp?.toLowerCase().includes(t) ||
        w.name_en?.toLowerCase().includes(t) ||
        w.id?.toLowerCase().includes(t) ||
        w.grape?.toLowerCase().includes(t) ||
        w.country?.toLowerCase().includes(t) ||
        w.region?.toLowerCase().includes(t)
      );
    }).sort((a, b) => (a.name_jp || '').localeCompare(b.name_jp || ''));
  }, [tabWines, masterSearchTerm]);

  // ページネーション分割
  const totalPages = Math.ceil(filteredWines.length / itemsPerPage);
  const currentItems = filteredWines.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  // 個別チェックのトグル
  const toggleSelection = (id: string) => {
    setSelectedMasterCatalogIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  // 現在のページ内アイテムがすべて選択されているか
  const isAllCurrentPageSelected = useMemo(() => {
    if (currentItems.length === 0) return false;
    return currentItems.every(item => selectedMasterCatalogIds.includes(item.id));
  }, [currentItems, selectedMasterCatalogIds]);

  // 現在のページ内アイテムを一括選択・解除
  const toggleSelectAllCurrentPage = () => {
    if (isAllCurrentPageSelected) {
      const currentIds = currentItems.map(item => item.id);
      setSelectedMasterCatalogIds(prev => prev.filter(id => !currentIds.includes(id)));
    } else {
      const idsToAdd = currentItems.map(item => item.id).filter(id => !selectedMasterCatalogIds.includes(id));
      setSelectedMasterCatalogIds(prev => [...prev, ...idsToAdd]);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* 検索コントロールエリア */}
      <div className="bg-white border border-slate-200 rounded-[2rem] p-6 md:p-8 shadow-sm flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="relative flex-1 w-full group">
          <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300 group-focus-within:text-brand-wine transition-colors" />
          <input 
            type="text"
            placeholder="カタログ内のワイン名・コード・品種で検索..."
            value={masterSearchTerm}
            onChange={(e) => onSearchMaster(e.target.value)}
            className="w-full pl-14 pr-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm focus:bg-white focus:border-brand-wine outline-none transition-all shadow-inner focus:shadow-luxury-soft"
          />
        </div>

        {/* インポーター切り替えタブ */}
        <div className="flex bg-slate-100/60 p-1 rounded-xl border border-slate-200/50 w-full md:w-auto shrink-0">
          <button 
            onClick={() => setActiveTab('PIEROTH')}
            className={`flex-1 md:flex-none px-6 py-2.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 whitespace-nowrap ${
              activeTab === 'PIEROTH' ? 'bg-white text-brand-wine shadow-sm font-black' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <Wine className="w-3.5 h-3.5" />
            ピーロート
          </button>
          <button 
            onClick={() => setActiveTab('OTHER')}
            className={`flex-1 md:flex-none px-6 py-2.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 whitespace-nowrap ${
              activeTab === 'OTHER' ? 'bg-white text-brand-wine shadow-sm font-black' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <Filter className="w-3.5 h-3.5" />
            他社インポート
          </button>
        </div>
      </div>

      {/* 【新機能】一括削除フローティング警告アクションバー */}
      <AnimatePresence>
        {selectedMasterCatalogIds.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="bg-red-50 border border-red-200 rounded-2xl p-4 md:px-8 flex items-center justify-between gap-4 shadow-md text-red-900"
          >
            <div className="flex items-center gap-3">
              <div className="w-2.5 h-2.5 bg-red-500 rounded-full animate-ping shrink-0" />
              <p className="text-xs md:text-sm font-bold">
                マスターカタログの銘柄が <span className="text-lg text-red-600 font-black px-1">{selectedMasterCatalogIds.length}</span> 件チェックされています。
              </p>
            </div>
            <button
              onClick={onBulkDeleteWines}
              className="flex items-center gap-2 bg-red-600 text-white px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-red-700 transition-all shadow-md active:scale-95 shrink-0"
            >
              <Trash2 className="w-4 h-4" />
              選択した銘柄を一括削除
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* メイングリッドリスト */}
      <div className="bg-white border border-slate-200 rounded-[2rem] overflow-hidden shadow-sm">
        {/* 一括全選択用ヘッダーコントロール */}
        {currentItems.length > 0 && (
          <div className="px-6 py-4 bg-slate-50/50 border-b border-slate-100 flex items-center justify-between">
            <button
              onClick={toggleSelectAllCurrentPage}
              className="flex items-center gap-3 px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:border-brand-wine hover:text-brand-wine transition-all shadow-sm"
            >
              <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${
                isAllCurrentPageSelected ? 'bg-brand-wine border-brand-wine text-white' : 'border-slate-300'
              }`}>
                {isAllCurrentPageSelected && <CheckCircle2 className="w-3 h-3 text-white" />}
              </div>
              {isAllCurrentPageSelected ? 'このページの選択をすべて解除' : 'このページの全20件をすべて選択'}
            </button>
            <div className="text-[11px] font-black text-slate-400 uppercase tracking-widest">
              ヒット数: {filteredWines.length}件
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 p-6 md:p-8">
          {currentItems.map(wine => {
            const isChecked = selectedMasterCatalogIds.includes(wine.id);
            return (
              <div 
                key={wine.id}
                onClick={() => toggleSelection(wine.id)}
                className={`bg-white p-6 rounded-[2rem] border transition-all flex gap-5 group cursor-pointer relative overflow-hidden ${
                  isChecked 
                    ? 'border-red-300 bg-red-50/[0.01] shadow-md ring-1 ring-red-500/10' 
                    : 'border-slate-100 hover:border-brand-gold shadow-luxury-soft hover:shadow-md'
                }`}
              >
                {/* チェックボックスと画像エリア */}
                <div className="flex flex-col items-center gap-4 shrink-0 py-1">
                  <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all duration-300 ${
                    isChecked ? 'bg-red-600 border-red-600 text-white scale-110 shadow-sm' : 'border-slate-200 bg-white group-hover:border-brand-gold'
                  }`}>
                    {isChecked && <CheckCircle2 className="w-4 h-4 text-white" />}
                  </div>
                  
                  <div className="w-20 h-32 flex items-center justify-center p-2 bg-slate-50 rounded-2xl border border-slate-100 transition-colors group-hover:bg-white">
                    <img 
                      src={`/api/proxy-image?url=${encodeURIComponent(wine.image_url)}`} 
                      alt="" 
                      loading="lazy"
                      className="h-full object-contain group-hover:scale-105 transition-transform" 
                    />
                  </div>
                </div>

                {/* メインテキストディテール */}
                <div className="flex-1 min-w-0 flex flex-col pt-1">
                  <div className="text-[10px] font-black text-brand-gold uppercase tracking-[0.2em] mb-1">
                    {wine.country} • {wine.color}
                  </div>
                  <h4 className="font-bold text-slate-900 text-sm md:text-base mb-1.5 line-clamp-2 leading-snug">
                    {wine.name_jp || '名称未設定'}
                  </h4>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-3 truncate italic">
                    {wine.grape || '品種情報なし'}
                  </p>
                  
                  <div className="mt-auto space-y-2">
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-base font-black text-slate-900">¥{(wine.price_bottle || 0).toLocaleString()}</span>
                      <span className="text-[9px] font-bold text-slate-300 uppercase tracking-widest">参考ボトル価格</span>
                    </div>
                    
                    <div className="flex items-center justify-between gap-2">
                      <div className="px-2 py-0.5 bg-slate-100 rounded text-[9px] font-mono text-slate-500 font-bold uppercase tracking-tighter truncate max-w-[130px]">
                        {wine.id}
                      </div>
                      
                      {/* 単体編集用ボタン（チェックボックスの衝突を避けるため e.stopPropagation()） */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onStartEditingMaster(wine);
                        }}
                        className="p-1.5 text-slate-400 hover:text-brand-wine hover:bg-slate-100 rounded-lg transition-colors border border-transparent hover:border-slate-200"
                        title="この銘柄のマスター情報を編集"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* 検索ノーヒット時 */}
        {filteredWines.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 text-slate-400">
            <Wine className="w-12 h-12 mb-4 opacity-10 animate-bounce" />
            <p className="text-sm font-bold">該当するマスター銘柄が見つかりませんでした</p>
          </div>
        )}

        {/* 追加ロード */}
        {hasMoreWines && filteredWines.length > 0 && currentPage === totalPages && (
          <div className="pb-12 flex justify-center">
            <button 
              onClick={onLoadMoreWines}
              className="px-12 py-3.5 bg-slate-50 border border-slate-200 rounded-full text-xs font-black uppercase tracking-widest text-slate-500 hover:bg-white hover:border-brand-gold hover:text-brand-gold transition-all shadow-sm"
            >
              次のマスターページを追記読込
            </button>
          </div>
        )}
      </div>

      {/* ページネーションコントロール */}
      {totalPages > 1 && (
        <div className="p-6 md:px-8 bg-white border border-slate-200 rounded-[2rem] flex flex-col sm:flex-row items-center justify-between gap-6 shadow-sm">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">
            ページ <span className="text-brand-wine font-black">{currentPage}</span> / {totalPages} 
            <span className="mx-3 text-slate-200">|</span> 
            表示中: {filteredWines.length}件
          </div>
          
          <div className="flex items-center gap-3">
            <button 
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              className="w-10 h-10 rounded-full border border-slate-200 flex items-center justify-center text-slate-400 disabled:opacity-20 hover:bg-slate-50 transition-all active:scale-90"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            
            <div className="flex items-center gap-1.5">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum = currentPage;
                if (totalPages <= 5) pageNum = i + 1;
                else if (currentPage <= 3) pageNum = i + 1;
                else if (currentPage >= totalPages - 2) pageNum = totalPages - 4 + i;
                else pageNum = currentPage - 2 + i;

                return (
                  <button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    className={`w-10 h-10 rounded-xl text-xs font-black tracking-widest transition-all ${
                      currentPage === pageNum 
                        ? 'bg-brand-wine text-white shadow-sm' 
                        : 'bg-slate-50 text-slate-400 hover:bg-slate-100'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>

            <button 
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              className="w-10 h-10 rounded-full border border-slate-200 flex items-center justify-center text-slate-400 disabled:opacity-20 hover:bg-slate-50 transition-all active:scale-90"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
