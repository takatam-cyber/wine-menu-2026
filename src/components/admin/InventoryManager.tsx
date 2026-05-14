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
    <div className="bg-white rounded-3xl overflow-hidden flex flex-col shadow-sm border border-slate-200">
      <div className="px-4 md:px-8 py-5 md:py-6 border-b border-slate-100 bg-slate-50 flex flex-col xl:flex-row justify-between items-center gap-6">
        <div className="flex items-center gap-3 self-start md:self-auto">
          <div className="w-10 h-10 bg-brand-wine text-white rounded-xl flex items-center justify-center shadow-md shrink-0">
            <Wine className="w-6 h-6" />
          </div>
          <h2 className="serif text-xl md:text-2xl text-slate-900">在庫・メニュー管理</h2>
        </div>
        <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
          <div className="relative flex-1 md:flex-none group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              list="master-wines-list"
              placeholder="マスターからワインを検索・追加..."
              value={searchId}
              onChange={(e) => setSearchId(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddWine()}
              className="pl-12 pr-4 py-2 bg-white border border-slate-300 rounded-full text-[10px] md:text-xs w-full md:w-56 lg:w-80 text-slate-900 outline-none focus:ring-2 focus:ring-brand-wine/10 focus:border-brand-wine transition-all"
            />
            <datalist id="master-wines-list">
              {masterWines.filter(w => !selectedWines.some(sw => sw.id === w.id)).map(w => (
                <option key={w.id} value={w.id}>{w.name_jp} ({w.country})</option>
              ))}
            </datalist>
          </div>
          <button
            onClick={onShowCatalogSelection}
            className="bg-brand-gold text-brand-wine p-2 md:p-2.5 rounded-full hover:scale-110 transition-all shadow-md active:scale-95 shrink-0"
            title="マスターから追加"
          >
            <Plus className="w-5 h-5" />
          </button>
          
          <div className="hidden md:block h-6 w-[1px] bg-slate-300 mx-1 md:mx-2"></div>
          
          <input 
            type="file"
            ref={fileInputRef}
            onChange={onFileUpload}
            className="hidden"
            accept=".csv"
          />
          <div className="flex gap-2 w-full sm:w-auto mt-2 sm:mt-0">
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 md:px-4 py-2 bg-slate-800 text-white rounded-xl text-[9px] md:text-xs font-bold uppercase tracking-widest hover:bg-slate-700 transition-all shadow-md"
            >
              <Upload className="w-4 h-4 shrink-0" /> <span className="truncate">CSV読み込み</span>
            </button>
            <button
              onClick={onSaveInventory}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 md:px-4 py-2 border-2 border-brand-wine text-brand-wine rounded-xl text-[9px] md:text-xs font-bold uppercase tracking-widest hover:bg-brand-wine hover:text-white transition-all shadow-sm"
            >
              <Save className="w-4 h-4 shrink-0" /> <span className="truncate">保存</span>
            </button>
          </div>
        </div>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="text-[10px] uppercase text-slate-400 border-b border-slate-100 bg-slate-50/50">
              <th className="px-8 py-5 font-bold">ワイン銘柄</th>
              <th className="px-4 py-5 font-bold">仕入れ原価(税別)</th>
              <th className="px-4 py-5 font-bold">ボトル設定</th>
              <th className="px-4 py-5 font-bold">グラス設定</th>
              <th className="px-4 py-5 font-bold text-center">メニュー表示</th>
              <th className="px-8 py-5 font-bold text-right">操作</th>
            </tr>
          </thead>
          <tbody className="text-xs">
            {selectedWines.map((wine, idx) => {
              const bottleStats = calculateProfit(wine.cost, wine.price_bottle);
              const glassStats = calculateGlassProfit(wine.cost, wine.price_glass, wine.glasses_per_bottle || 6);
              return (
                <tr key={wine.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors group">
                  <td className="px-8 py-6">
                    <div className="flex items-center gap-3">
                      <button 
                        onClick={() => {
                          const newWines = [...selectedWines];
                          newWines[idx].isFeatured = !newWines[idx].isFeatured;
                          setSelectedWines(newWines);
                        }}
                        className={`p-2 rounded-full transition-all border ${
                          wine.isFeatured ? 'bg-amber-100 border-amber-300 text-amber-600 shadow-sm' : 'bg-slate-50 border-slate-200 text-slate-300 hover:text-slate-400'
                        }`}
                        title={wine.isFeatured ? 'おすすめ解除' : 'おすすめに設定'}
                      >
                        <Sparkles className={`w-4 h-4 ${wine.isFeatured ? 'fill-current' : ''}`} />
                      </button>
                      <div>
                        <div className="font-bold text-slate-800 text-sm mb-1 flex items-center gap-2">
                          {wine.name_jp}
                          {wine.isFeatured && <span className="bg-amber-100 text-amber-600 text-[8px] px-2 py-0.5 rounded-full font-bold uppercase tracking-widest">Featured</span>}
                        </div>
                        <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">ID: {wine.id} • {wine.region}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-6">
                    <input
                      type="number"
                      value={wine.cost}
                      onChange={(e) => {
                        const newWines = [...selectedWines];
                        newWines[idx].cost = parseInt(e.target.value) || 0;
                        setSelectedWines(newWines);
                      }}
                      className="w-24 bg-white border border-slate-200 rounded px-2 py-1.5 focus:border-brand-wine outline-none font-mono text-slate-600 text-center"
                    />
                  </td>
                  <td className="px-4 py-6">
                    <div className="flex items-center gap-4">
                       <div className="relative group">
                         <input
                          type="number"
                          value={wine.price_bottle}
                          onChange={(e) => {
                            const newWines = [...selectedWines];
                            newWines[idx].price_bottle = parseInt(e.target.value) || 0;
                            setSelectedWines(newWines);
                          }}
                          className="w-28 bg-white border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-brand-wine/10 focus:border-brand-wine outline-none font-mono text-slate-900 font-bold text-center"
                        />
                       </div>
                      <div className="flex flex-col min-w-[70px]">
                        <span className="font-bold text-brand-wine font-mono text-sm leading-none">¥{bottleStats.profit.toLocaleString()}</span>
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter mt-1">原価率 {Math.round(bottleStats.costRatio)}%</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-6">
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] font-bold text-slate-400 w-8">価格</span>
                        <input
                          type="number"
                          value={wine.price_glass}
                          onChange={(e) => {
                            const newWines = [...selectedWines];
                            newWines[idx].price_glass = parseInt(e.target.value) || 0;
                            setSelectedWines(newWines);
                          }}
                          className="w-20 bg-white border border-slate-300 rounded px-2 py-1 text-sm font-mono text-slate-900 text-center"
                        />
                        <div className="flex flex-col">
                          <span className="font-bold text-brand-wine font-mono text-xs">¥{glassStats.profit.toLocaleString()}</span>
                          <span className="text-[9px] text-slate-400 font-bold uppercase tracking-tighter">原価率 {Math.round(glassStats.costRatio)}%</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] font-bold text-slate-400 w-8">取数</span>
                        <input
                          type="number"
                          value={wine.glasses_per_bottle || 6}
                          onChange={(e) => {
                            const newWines = [...selectedWines];
                            newWines[idx].glasses_per_bottle = parseInt(e.target.value) || 6;
                            setSelectedWines(newWines);
                          }}
                          className="w-20 bg-slate-50 border border-slate-300 rounded px-2 py-1 text-xs font-mono text-slate-600 text-center"
                        />
                        <span className="text-[9px] font-bold text-slate-400 tracking-widest">杯/BTL</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-6 text-right">
                     <div className="flex flex-col gap-2 items-end">
                      <button 
                        onClick={() => {
                          const newWines = [...selectedWines];
                          newWines[idx].visible = !newWines[idx].visible;
                          setSelectedWines(newWines);
                        }}
                        className={`px-4 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest border transition-all ${
                          wine.visible 
                            ? 'bg-green-50 border-green-200 text-green-700 hover:bg-green-100' 
                            : 'bg-slate-100 border-slate-200 text-slate-400 hover:bg-slate-200'
                        }`}
                      >
                        {wine.visible ? '● 表示中' : '○ 非表示'}
                      </button>
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] font-bold text-slate-400 uppercase">ラベル:</span>
                        <input 
                           placeholder="おすすめラベル..."
                           className="text-[9px] bg-slate-50 border border-slate-200 rounded px-2 py-1 outline-none focus:border-brand-wine w-24"
                           value={wine.promoLabel || ''}
                           onChange={(e) => {
                             const newWines = [...selectedWines];
                             newWines[idx].promoLabel = e.target.value;
                             setSelectedWines(newWines);
                           }}
                         />
                      </div>
                     </div>
                  </td>
                  <td className="px-8 py-6 text-right">
                     <button 
                       onClick={() => onDeleteWine(wine.id)}
                       className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                     >
                       <Trash2 className="w-4 h-4" />
                     </button>
                  </td>
                </tr>
              );
            })}
            {selectedWines.length === 0 && (
              <tr>
                <td colSpan={6} className="px-8 py-24 text-center">
                  <Wine className="w-12 h-12 text-slate-100 mx-auto mb-6" />
                  <p className="font-serif italic text-xl text-slate-300">銘柄を選択、またはCSVを読み込んで開始します</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
