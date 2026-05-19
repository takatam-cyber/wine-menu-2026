import React from 'react';
import { WineMaster, Store } from '../../types';
import { Search, Plus, Wine, Upload, Save, Sparkles, Trash2, CheckCircle2, X } from 'lucide-react';
import { motion } from 'motion/react';
import { calculateProfit, calculateGlassProfit } from '../../lib/profit-calc';

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
}

export const InventoryManager: React.FC<InventoryManagerProps> = ({
  selectedStore,
  selectedStoreId,
  selectedWines,
  setSelectedWines,
  masterWines,
  searchId,
  setSearchId,
  handleAddWine,
  onShowCatalogSelection,
  onFileUpload,
  onSaveInventory,
  onDeleteWine,
  fileInputRef,
}) => {
  return (
    <div className="bg-white rounded-[2.5rem] overflow-hidden flex flex-col shadow-luxury-soft border border-slate-200">
      {/* Header Section */}
      <div className="px-6 md:px-10 py-6 md:py-8 border-b border-slate-100 bg-white flex flex-col xl:flex-row justify-between items-center gap-6">
        <div className="flex items-center gap-4 self-start md:self-auto">
          <div className="w-12 h-12 bg-brand-wine text-white rounded-2xl flex items-center justify-center shadow-luxury-wine shrink-0">
            <Wine className="w-6 h-6" />
          </div>
          <div>
            <h2 className="serif text-xl md:text-3xl text-slate-900 tracking-tight">在庫・メニュー管理</h2>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Inventory & Pricing Controls</p>
          </div>
        </div>
        
        <div className="flex flex-wrap items-center gap-4 w-full xl:w-auto">
          <div className="relative flex-1 md:flex-none group">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 group-focus-within:text-brand-wine transition-colors" />
            <input
              type="text"
              list="master-wines-list"
              placeholder="銘柄名やIDでマスターを検索..."
              value={searchId}
              onChange={(e) => setSearchId(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddWine()}
              className="pl-12 pr-6 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl text-xs w-full md:w-64 lg:w-96 text-slate-900 outline-none focus:bg-white focus:border-brand-wine focus:shadow-luxury-soft transition-all"
            />
            <datalist id="master-wines-list">
              {masterWines.filter(w => !selectedWines.some(sw => sw.id === w.id)).map(w => (
                <option key={w.id} value={w.id}>{w.name_jp} ({w.country})</option>
              ))}
            </datalist>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onShowCatalogSelection}
              className="bg-brand-gold text-white w-12 h-12 rounded-2xl flex items-center justify-center hover:scale-105 transition-all shadow-luxury-gold active:scale-95 shrink-0"
              title="マスターカタログを開く"
            >
              <Plus className="w-6 h-6" />
            </button>
            <div className="h-8 w-[1px] bg-slate-100 mx-2 hidden md:block" />
            <input 
              type="file"
              ref={fileInputRef}
              onChange={onFileUpload}
              className="hidden"
              accept=".csv"
            />
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 px-6 py-3.5 bg-slate-800 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-700 transition-all shadow-lg active:scale-95"
            >
              <Upload className="w-4 h-4" /> CSVアップロード
            </button>
            <button
              onClick={onSaveInventory}
              className="flex items-center gap-2 px-6 py-3.5 bg-brand-wine text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-brand-red transition-all shadow-luxury-wine active:scale-95"
            >
              <Save className="w-4 h-4" /> サーバーへ保存
            </button>
          </div>
        </div>
      </div>

      {/* Wine List Header (Desktop Only) */}
      <div className="hidden md:grid md:grid-cols-[1fr_repeat(3,minmax(180px,250px))_100px] gap-4 px-10 py-5 bg-slate-50/50 border-b border-slate-100 italic">
        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">ワイン銘柄 / サプライヤー</span>
        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">仕入れ原価 & ボトル設定</span>
        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">グラス提供設定</span>
        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">表示 & ラベル設定</span>
        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-right px-4">操作</span>
      </div>

      {/* Wine List Content */}
      <div className="flex flex-col flex-1 divide-y divide-slate-50">
        {selectedWines.map((wine, idx) => {
          const bottleStats = calculateProfit(wine.cost, wine.price_bottle);
          const glassStats = calculateGlassProfit(wine.cost, wine.price_glass, wine.glasses_per_bottle || 6);
          const isHidden = wine.visible === false;
          
          return (
            <motion.div 
              layout
              key={wine.id}
              className={`flex flex-col md:grid md:grid-cols-[1fr_repeat(3,minmax(180px,250px))_100px] gap-6 md:gap-4 p-6 md:px-10 md:py-8 transition-all hover:bg-slate-50/80 items-center ${isHidden ? 'opacity-60 grayscale-[0.3]' : ''}`}
            >
              {/* Product Info Column */}
              <div className="flex items-center gap-4 w-full min-w-0">
                <button 
                  onClick={() => {
                    const newWines = [...selectedWines];
                    newWines[idx].isFeatured = !newWines[idx].isFeatured;
                    setSelectedWines(newWines);
                  }}
                  className={`shrink-0 p-3 rounded-2xl transition-all border ${
                    wine.isFeatured ? 'bg-amber-100 border-amber-200 text-amber-600 shadow-luxury-gold' : 'bg-slate-50 border-slate-100 text-slate-300 hover:text-slate-400'
                  }`}
                  title={wine.isFeatured ? 'おすすめ解除' : 'おすすめに設定'}
                >
                  <Sparkles className={`w-5 h-5 ${wine.isFeatured ? 'fill-current' : ''} shrink-0`} />
                </button>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1 min-w-0">
                    <span className="font-bold text-slate-900 text-sm md:text-base leading-tight truncate block flex-1">{wine.name_jp}</span>
                    {wine.isFeatured && (
                      <span className="shrink-0 bg-amber-500 text-white text-[8px] font-black uppercase px-2 py-0.5 rounded-full tracking-widest shadow-sm">Featured</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black text-brand-gold uppercase tracking-widest truncate">
                      {wine.id} • {wine.region} • {wine.country}
                    </span>
                    {(wine.supplier || 'PIEROTH').toUpperCase() === 'OTHER' && (
                      <span className="text-[9px] font-black text-slate-400 border border-slate-200 px-1.5 rounded uppercase tracking-tighter">Other</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Cost & Bottle Pricing Column */}
              <div className="flex flex-col sm:flex-row md:flex-col gap-4 w-full md:w-auto">
                <div className="flex-1 space-y-2">
                  <div className="flex items-center justify-between md:hidden">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">仕入れ原価</label>
                  </div>
                  <div className="relative group/cost">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">¥</span>
                    <input
                      type="number"
                      value={wine.cost}
                      onChange={(e) => {
                        const newWines = [...selectedWines];
                        newWines[idx].cost = parseInt(e.target.value) || 0;
                        setSelectedWines(newWines);
                      }}
                      className="w-full bg-slate-50/50 border border-slate-100 rounded-xl pl-6 pr-4 py-2.5 text-xs font-mono text-slate-600 focus:bg-white focus:border-brand-wine outline-none transition-all"
                    />
                  </div>
                </div>
                <div className="flex-1 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-black text-brand-wine uppercase tracking-widest">ボトル販売価格</label>
                    <div className="bg-brand-wine/5 px-2 py-0.5 rounded-md">
                      <span className="text-[10px] font-black text-brand-wine font-mono">Profit: ¥{bottleStats.profit.toLocaleString()}</span>
                    </div>
                  </div>
                  <div className="relative group/price">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-brand-wine">¥</span>
                    <input
                      type="number"
                      value={wine.price_bottle}
                      onChange={(e) => {
                        const newWines = [...selectedWines];
                        newWines[idx].price_bottle = parseInt(e.target.value) || 0;
                        setSelectedWines(newWines);
                      }}
                      className="w-full bg-white border border-brand-wine/20 rounded-xl pl-6 pr-4 py-2.5 text-sm font-mono text-slate-900 font-black focus:ring-4 focus:ring-brand-wine/5 outline-none transition-all text-right"
                    />
                    <div className={`absolute right-0 -bottom-5 text-[9px] font-bold uppercase tracking-tighter ${bottleStats.costRatio > 40 ? 'text-rose-500' : 'text-slate-400'}`}>
                      原価率 {Math.round(bottleStats.costRatio)}%
                    </div>
                  </div>
                </div>
              </div>

              {/* Glass Pricing Column */}
              <div className="flex flex-col sm:flex-row md:flex-col gap-4 w-full md:w-auto pt-2 md:pt-0">
                <div className="flex-1 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">グラス価格</label>
                    <span className="text-[9px] font-bold text-brand-wine font-mono">¥{glassStats.profit.toLocaleString()} 利</span>
                  </div>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">¥</span>
                    <input
                      type="number"
                      value={wine.price_glass}
                      onChange={(e) => {
                        const newWines = [...selectedWines];
                        newWines[idx].price_glass = parseInt(e.target.value) || 0;
                        setSelectedWines(newWines);
                      }}
                      className="w-full bg-slate-50 border border-slate-100 rounded-xl pl-6 pr-4 py-2 text-xs font-mono text-slate-900 focus:bg-white focus:border-brand-wine outline-none transition-all text-right"
                    />
                  </div>
                </div>
                <div className="flex-1 space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">グラス取数/杯</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={wine.glasses_per_bottle || 6}
                      onChange={(e) => {
                        const newWines = [...selectedWines];
                        newWines[idx].glasses_per_bottle = parseInt(e.target.value) || 6;
                        setSelectedWines(newWines);
                      }}
                      className="w-full bg-slate-100 border border-slate-200 rounded-xl px-4 py-2 text-[11px] font-mono text-slate-600 focus:bg-white outline-none text-center"
                    />
                    <span className="text-[9px] font-bold text-slate-300 uppercase tracking-tighter shrink-0">Btl/Glasses</span>
                  </div>
                </div>
              </div>

              {/* Status & Options Column */}
              <div className="flex flex-col gap-4 w-full md:w-auto">
                <button 
                  onClick={() => {
                    const newWines = [...selectedWines];
                    newWines[idx].visible = !newWines[idx].visible;
                    setSelectedWines(newWines);
                  }}
                  className={`w-full py-3 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] border transition-all flex items-center justify-center gap-2 ${
                    wine.visible 
                      ? 'bg-green-50 border-green-200 text-green-700 hover:bg-green-100' 
                      : 'bg-slate-100 border-slate-200 text-slate-400 hover:bg-slate-200'
                  }`}
                >
                  <div className={`w-1.5 h-1.5 rounded-full ${wine.visible ? 'bg-green-500 animate-pulse' : 'bg-slate-300'}`} />
                  {wine.visible ? 'Menu: Visible' : 'Menu: Hidden'}
                </button>
                
                <div className="relative group/label">
                  <input 
                    placeholder="特記事項（ラベル）..."
                    className="w-full text-[10px] bg-slate-50 border border-slate-100 rounded-xl px-4 py-2.5 outline-none focus:bg-white focus:border-brand-wine transition-all font-bold placeholder:text-slate-300"
                    value={wine.promoLabel || ''}
                    onChange={(e) => {
                      const newWines = [...selectedWines];
                      newWines[idx].promoLabel = e.target.value;
                      setSelectedWines(newWines);
                    }}
                  />
                </div>
              </div>

              {/* Action Column */}
              <div className="flex justify-end pt-4 md:pt-0">
                <button 
                  onClick={() => onDeleteWine(wine.id)}
                  className="w-12 h-12 flex items-center justify-center text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-2xl transition-all active:scale-90 group/del"
                >
                  <Trash2 className="w-5 h-5 group-hover/del:scale-110 transition-transform" />
                </button>
              </div>
            </motion.div>
          );
        })}

        {selectedWines.length === 0 && (
          <div className="py-32 flex flex-col items-center justify-center text-center px-6">
            <div className="w-20 h-20 bg-slate-50 rounded-[2rem] flex items-center justify-center mb-6">
              <Wine className="w-10 h-10 text-slate-200" />
            </div>
            <h3 className="serif text-2xl text-slate-300 italic mb-2">メニューが空です</h3>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">
              マスターから銘柄を選択して追加してください
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
