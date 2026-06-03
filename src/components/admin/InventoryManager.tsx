// src/components/admin/InventoryManager.tsx
import React, { useState } from 'react';
import { WineMaster, Store } from '../../types';
import { Plus, Wine, Upload, Save, Sparkles, Trash2, Loader2, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import { useWines } from '../../lib/WineContext';
import { motion, AnimatePresence } from 'motion/react';

interface InventoryManagerProps {
  selectedStore: Store | undefined;
  selectedStoreId: string;
  selectedWines: WineMaster[];
  setSelectedWines: React.Dispatch<React.SetStateAction<WineMaster[]>>;
  masterWines: WineMaster[];
  searchId: string;
  setSearchId: (id: string) => void;
  handleAddWine: (id?: string) => void;
  onShowCatalogSelection: () => void;
  onFileUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onSaveInventory: () => void;
  onDeleteWine: (id: string) => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  hasMoreWines: boolean;
  onLoadMoreWines: () => void;
  onUpdateWineItem: (wineId: string, updatedFields: Partial<WineMaster>, saveImmediately?: boolean) => void;
  isOwner?: boolean; 
}

export const InventoryManager: React.FC<InventoryManagerProps> = ({
  selectedStore,
  selectedStoreId,
  selectedWines,
  onShowCatalogSelection,
  onFileUpload,
  onSaveInventory,
  onDeleteWine,
  fileInputRef,
  onUpdateWineItem,
  setSelectedWines,
  masterWines,
  searchId,
  setSearchId,
  handleAddWine,
  hasMoreWines,
  onLoadMoreWines,
  isOwner = false, 
}) => {
  const { showToast, showConfirm } = useWines();

  // 💡 修正の核心: 重複した非同期自動保存を全廃。UIのステート更新とorderのインデックス割り当てのみに集中し、保存ボタンが押された時に完璧に永続化する。
  const applySort = (type: string) => {
    if (!type) return;
    const newWines = [...selectedWines];
    
    const getColorWeight = (color: string) => {
      const c = String(color || '').toLowerCase();
      if (c.includes('泡') || c.includes('スパークリング')) return 1;
      if (c.includes('白') || c.includes('white')) return 2;
      if (c.includes('赤') || c.includes('red')) return 3;
      if (c.includes('ロゼ') || c.includes('rose')) return 4;
      if (c.includes('オレンジ') || c.includes('orange')) return 5;
      return 99;
    };

    newWines.sort((a, b) => {
      switch (type) {
        case 'type':
          return getColorWeight(a.color || '') - getColorWeight(b.color || '');
        case 'type_price_asc':
          if (getColorWeight(a.color || '') === getColorWeight(b.color || '')) {
            return (a.price_bottle || 0) - (b.price_bottle || 0);
          }
          return getColorWeight(a.color || '') - getColorWeight(b.color || '');
        case 'type_price_desc':
          if (getColorWeight(a.color || '') === getColorWeight(b.color || '')) {
            return (b.price_bottle || 0) - (a.price_bottle || 0);
          }
          return getColorWeight(a.color || '') - getColorWeight(b.color || '');
        case 'price_asc':
          return (a.price_bottle || 0) - (b.price_bottle || 0);
        case 'price_desc':
          return (b.price_bottle || 0) - (a.price_bottle || 0);
        default:
          return 0;
      }
    });

    newWines.forEach((w, index) => { w.order = index; });
    setSelectedWines(newWines);
    showToast('並び替えを仮適用しました。「一括保存」を押すと確定します。', 'info');
  };

  const moveUp = (index: number) => {
    if (index === 0) return;
    const newWines = [...selectedWines];
    [newWines[index - 1], newWines[index]] = [newWines[index], newWines[index - 1]];
    newWines.forEach((w, i) => { w.order = i; });
    setSelectedWines(newWines);
  };

  const moveDown = (index: number) => {
    if (index === selectedWines.length - 1) return;
    const newWines = [...selectedWines];
    [newWines[index + 1], newWines[index]] = [newWines[index], newWines[index + 1]];
    newWines.forEach((w, i) => { w.order = i; });
    setSelectedWines(newWines);
  };

  return (
    <div className="bg-white rounded-3xl overflow-hidden flex flex-col shadow-sm border border-slate-200 relative pb-4">
      <div className="px-4 md:px-8 py-5 md:py-6 border-b border-slate-100 bg-slate-50 flex flex-col xl:flex-row justify-between items-center gap-6">
        <div className="flex items-center gap-3 self-start md:self-auto">
          <div className="w-10 h-10 bg-brand-wine text-white rounded-xl flex items-center justify-center shadow-md shrink-0"><Wine className="w-6 h-6" /></div>
          <h2 className="serif text-xl md:text-2xl text-slate-900">セラー銘柄管理</h2>
        </div>
        
        <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
          <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-xl border border-slate-200 shadow-sm">
            <ArrowUpDown className="w-4 h-4 text-slate-400" />
            <select 
              onChange={(e) => {
                applySort(e.target.value);
                e.target.value = ''; 
              }} 
              className="text-xs font-bold text-slate-700 outline-none bg-transparent cursor-pointer"
            >
              <option value="">一括並び替え...</option>
              <option value="type">種類別（泡・白・赤...）</option>
              <option value="type_price_asc">種類別 ＋ 価格の安い順</option>
              <option value="type_price_desc">種類別 ＋ 価格の高い順</option>
              <option value="price_asc">価格の安い順</option>
              <option value="price_desc">価格の高い順</option>
            </select>
          </div>

          <button onClick={onSaveInventory} className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-2.5 bg-green-600 text-white rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-green-500 transition-all shadow-md active:scale-95">
            <Save className="w-4 h-4 shrink-0" /> <span className="truncate">一括保存</span>
          </button>

          {!isOwner && (
            <>
              <button onClick={onShowCatalogSelection} className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-2.5 bg-brand-wine text-white rounded-xl text-xs font-bold uppercase tracking-widest hover:brightness-110 transition-all shadow-md active:scale-95">
                <Plus className="w-5 h-5 shrink-0" /> <span className="truncate">銘柄を追加</span>
              </button>
              <input type="file" ref={fileInputRef} onChange={onFileUpload} className="hidden" accept=".csv" />
              <button onClick={() => fileInputRef.current?.click()} className="hidden md:flex flex-none items-center justify-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-slate-700 transition-all shadow-md">
                <Upload className="w-4 h-4" /> CSV読込
              </button>
            </>
          )}
        </div>
      </div>
     
      <div className="w-full overflow-x-auto pb-4">
        <div className="min-w-[1100px] p-4 md:p-6 space-y-4">
          <div className="grid grid-cols-[2.5fr_3.5fr_1fr_1fr] gap-4 px-6 py-3 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100">
            <div>ワイン銘柄</div>
            <div className="text-center">価格設定 (仕入 / ボトル / グラス / 杯数)</div>
            <div className="text-center">メニュー公開</div>
            <div className="text-right">並び替え・操作</div>
          </div>

          {selectedWines.map((wine, index) => {
            return (
              <div key={`${wine.id}-${index}`} className={`bg-white px-6 py-4 rounded-2xl border border-slate-100 grid grid-cols-[2.5fr_3.5fr_1fr_1fr] items-center gap-4 transition-all shadow-sm group ${ !wine.visible ? 'opacity-65 bg-slate-50/50' : 'hover:border-slate-300' }`}>
                <div className="flex items-center gap-4 min-w-0 pr-4">
                  <button onClick={() => onUpdateWineItem(wine.id, { isFeatured: !wine.isFeatured }, true)} className={`p-2.5 rounded-xl transition-all border shrink-0 ${ wine.isFeatured ? 'bg-amber-50 border-amber-300 text-amber-500 shadow-sm' : 'bg-slate-50 border-slate-200 text-slate-300' }`}><Sparkles className={`w-4 h-4 ${wine.isFeatured ? 'fill-current' : ''}`} /></button>
                  <div className="min-w-0 flex flex-col justify-center">
                    <span className="font-black text-slate-800 text-[15px] leading-tight line-clamp-2">{wine.name_jp || '名称未設定'}</span>
                    <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest truncate mt-1 flex items-center gap-2"><span className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-500 font-mono">CODE: {wine.id}</span></div>
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-2 items-center justify-center">
                  <div className="flex flex-col gap-1 items-center">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">仕入(税別)</span>
                    <div className="relative w-full"><span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 font-mono text-xs">¥</span><input type="number" value={wine.cost === 0 ? 0 : (wine.cost || '')} onChange={(e) => onUpdateWineItem(wine.id, { cost: parseInt(e.target.value) || 0 }, false)} className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-6 pr-2 py-2 focus:border-brand-wine focus:bg-white outline-none font-mono text-slate-900 font-black text-center text-sm transition-all" /></div>
                  </div>
                  <div className="flex flex-col gap-1 items-center">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">ボトル</span>
                    <div className="relative w-full"><span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 font-mono text-xs">¥</span><input type="number" value={wine.price_bottle === 0 ? 0 : (wine.price_bottle || '')} onChange={(e) => onUpdateWineItem(wine.id, { price_bottle: parseInt(e.target.value) || 0 }, false)} className="w-full bg-white border border-slate-300 rounded-xl pl-6 pr-2 py-2 focus:border-brand-wine outline-none font-mono text-slate-900 font-black text-center text-sm shadow-inner" /></div>
                  </div>
                  <div className="flex flex-col gap-1 items-center">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">グラス</span>
                    <div className="relative w-full"><span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 font-mono text-xs">¥</span><input type="number" value={wine.price_glass === 0 ? 0 : (wine.price_glass || '')} onChange={(e) => onUpdateWineItem(wine.id, { price_glass: parseInt(e.target.value) || 0 }, false)} className="w-full bg-white border border-slate-300 rounded-xl pl-6 pr-2 py-2 focus:border-brand-wine outline-none font-mono text-slate-900 font-black text-center text-sm shadow-inner" /></div>
                  </div>
                  <div className="flex flex-col gap-1 items-center">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">杯数</span>
                    <div className="relative w-full"><input type="number" value={wine.glasses_per_bottle === 0 ? 0 : (wine.glasses_per_bottle || 6)} onChange={(e) => onUpdateWineItem(wine.id, { glasses_per_bottle: parseInt(e.target.value) || 6 }, false)} className="w-full bg-white border border-slate-300 rounded-xl px-2 py-2 focus:border-brand-wine outline-none font-mono text-slate-900 font-black text-center text-sm shadow-inner" /><span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">杯</span></div>
                  </div>
                </div>

                <div className="flex items-center justify-center">
                  <button onClick={() => onUpdateWineItem(wine.id, { visible: !wine.visible }, true)} className={`h-11 px-4 rounded-xl text-xs font-black uppercase tracking-widest border transition-all shrink-0 w-28 flex items-center justify-center ${ wine.visible ? 'bg-green-50 border-green-200 text-green-700 hover:bg-green-100 shadow-sm' : 'bg-slate-50 border-slate-200 text-slate-400 hover:bg-slate-100' }`}>{wine.visible ? '● 公開中' : '✕ 非表示'}</button>
                </div>

                <div className="flex items-center justify-end gap-2">
                  <div className="flex flex-col gap-1">
                    <button onClick={() => moveUp(index)} disabled={index === 0} className="p-1 text-slate-400 hover:text-brand-wine hover:bg-brand-wine/10 rounded transition-all disabled:opacity-30 disabled:cursor-not-allowed" title="上に移動"><ArrowUp className="w-4 h-4" /></button>
                    <button onClick={() => moveDown(index)} disabled={index === selectedWines.length - 1} className="p-1 text-slate-400 hover:text-brand-wine hover:bg-brand-wine/10 rounded transition-all disabled:opacity-30 disabled:cursor-not-allowed" title="下に移動"><ArrowDown className="w-4 h-4" /></button>
                  </div>
                  {!isOwner ? (
                    <button onClick={() => onDeleteWine(wine.id)} className="p-2.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all border border-transparent hover:border-red-100 ml-2" title="メニューから削除"><Trash2 className="w-4 h-4" /></button>
                  ) : (
                    <div className="w-9 h-9 ml-2" />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
