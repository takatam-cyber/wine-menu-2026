// src/components/admin/InventoryManager.tsx
import React from 'react';
import { WineMaster, Store } from '../../types';
import { Plus, Wine, Upload, Save, Sparkles, Trash2 } from 'lucide-react';
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
  onUpdateWineItem: (wineId: string, updatedFields: Partial<WineMaster>, saveImmediately?: boolean) => void;
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
  onUpdateWineItem,
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
          <button
            onClick={onShowCatalogSelection}
            className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-2.5 bg-brand-gold text-brand-wine rounded-xl text-xs font-bold uppercase tracking-widest hover:brightness-110 transition-all shadow-md active:scale-95"
          >
            <Plus className="w-5 h-5 shrink-0" /> <span className="truncate">マスターから追加</span>
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
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 md:px-4 py-2 bg-slate-800 text-white rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-slate-700 transition-all shadow-md"
            >
              <Upload className="w-4 h-4 shrink-0" /> <span className="truncate">CSV読込</span>
            </button>
            <button
              onClick={onSaveInventory}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 md:px-4 py-2 border-2 border-brand-wine text-white bg-brand-wine rounded-xl text-xs font-bold uppercase tracking-widest hover:brightness-110 transition-all shadow-lg active:scale-95"
            >
              <Save className="w-4 h-4 shrink-0" /> <span className="truncate">一括保存</span>
            </button>
          </div>
        </div>
      </div>
     
      {/* 【UXバグ修正】横スクロールと最低幅を設けて、枠被りや文字が見切れるのを完全に防ぎます */}
      <div className="w-full overflow-x-auto custom-scrollbar pb-4">
        <div className="min-w-[1050px] p-4 md:p-6 space-y-4">
          <div className="grid grid-cols-[2.5fr_1fr_1.5fr_1.5fr_0.8fr_1fr_0.8fr] gap-4 px-6 py-3 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100">
            <div>ワイン銘柄</div>
            <div className="text-center">仕入れ原価(税別)</div>
            <div className="text-center">ボトル設定</div>
            <div className="text-center">グラス設定</div>
            <div className="text-center">在庫数</div>
            <div className="text-center">表示状態</div>
            <div className="text-right">操作</div>
          </div>

          {selectedWines.map((wine, idx) => {
            const bottleStats = calculateProfit(wine.cost, wine.price_bottle);
            const glassStats = calculateGlassProfit(wine.cost, wine.price_glass, wine.glasses_per_bottle || 6);
            return (
              <div
                key={wine.id}
                className={`bg-white px-6 py-4 rounded-2xl border border-slate-100 grid grid-cols-[2.5fr_1fr_1.5fr_1.5fr_0.8fr_1fr_0.8fr] items-center gap-4 transition-all shadow-sm group ${
                  !wine.visible ? 'opacity-60 bg-slate-50/50' : 'hover:border-slate-300'
                }`}
              >
                {/* 1. ワイン銘柄 */}
                <div className="flex items-center gap-4 min-w-0 pr-4">
                  <button
                    onClick={() => onUpdateWineItem(wine.id, { isFeatured: !wine.isFeatured }, true)}
                    className={`p-2.5 rounded-xl transition-all border shrink-0 ${
                      wine.isFeatured ? 'bg-amber-50 border-amber-300 text-amber-500 shadow-sm' : 'bg-slate-50 border-slate-200 text-slate-300 hover:text-slate-400'
                    }`}
                    title={wine.isFeatured ? 'おすすめ解除' : 'おすすめに設定'}
                  >
                    <Sparkles className={`w-4 h-4 ${wine.isFeatured ? 'fill-current' : ''}`} />
                  </button>
                  <div className="min-w-0 flex flex-col justify-center">
                    <div className="flex items-center gap-2 mb-1">
                      {/* 【UXバグ修正】ワイン名が見切れないように2行のLine-clampを設定しゆとりを持たせる */}
                      <span className="font-bold text-slate-800 text-[15px] leading-tight line-clamp-2" title={wine.name_jp}>
                        {wine.name_jp || '名称未設定'}
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest truncate flex items-center gap-2">
                      <span className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-500">ID: {wine.id}</span>
                      <span className="truncate">{wine.region || '産地不明'}</span>
                      {wine.isFeatured && (
                        <span className="text-amber-500 flex items-center gap-0.5"><Sparkles className="w-3 h-3"/>Featured</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* 2. 仕入れ原価 */}
                <div className="flex items-center justify-center gap-1.5">
                  <span className="text-slate-400 font-mono text-xs">¥</span>
                  <input
                    type="number"
                    value={wine.cost === 0 ? 0 : (wine.cost || '')}
                    onChange={(e) => {
                      const val = parseInt(e.target.value) || 0;
                      onUpdateWineItem(wine.id, { cost: val }, false);
                    }}
                    className="w-20 bg-slate-50 border border-slate-200 rounded-xl px-2 py-2 focus:border-brand-wine outline-none font-mono text-slate-700 text-center font-bold text-sm"
                  />
                </div>

                {/* 3. ボトル設定 */}
                <div className="flex items-center justify-center gap-3">
                  <div className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 font-mono text-xs">¥</span>
                    <input
                      type="number"
                      value={wine.price_bottle === 0 ? 0 : (wine.price_bottle || '')}
                      onChange={(e) => {
                        const val = parseInt(e.target.value) || 0;
                        onUpdateWineItem(wine.id, { price_bottle: val }, false);
                      }}
                      className="w-24 bg-white border border-slate-300 rounded-xl pl-6 pr-2 py-2 focus:border-brand-wine outline-none font-mono text-slate-900 font-bold text-center text-sm"
                    />
                  </div>
                  <div className="flex flex-col text-left min-w-[50px]">
                    <span className="font-bold text-brand-wine font-mono text-[11px]">¥{bottleStats.profit.toLocaleString()}</span>
                    <span className="text-[9px] text-slate-400 font-bold tracking-tighter">粗利 {Math.round(bottleStats.costRatio)}%</span>
                  </div>
                </div>

                {/* 4. グラス設定 */}
                <div className="flex flex-col justify-center gap-2">
                  <div className="flex items-center justify-center gap-2">
                    <div className="relative">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 font-mono text-[10px]">¥</span>
                      <input
                        type="number"
                        value={wine.price_glass === 0 ? 0 : (wine.price_glass || '')}
                        onChange={(e) => {
                          const val = parseInt(e.target.value) || 0;
                          onUpdateWineItem(wine.id, { price_glass: val }, false);
                        }}
                        className="w-16 bg-white border border-slate-300 rounded-lg pl-5 pr-1 py-1 text-xs font-mono text-slate-900 text-center"
                      />
                    </div>
                    <div className="flex flex-col text-left min-w-[45px]">
                      <span className="font-bold text-brand-wine font-mono text-[10px]">¥{glassStats.profit.toLocaleString()}</span>
                      <span className="text-[8px] text-slate-400 font-bold">粗利 {Math.round(glassStats.costRatio)}%</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-center gap-1.5">
                    <input
                      type="number"
                      value={wine.glasses_per_bottle === 0 ? 0 : (wine.glasses_per_bottle || '')}
                      onChange={(e) => {
                        const val = parseInt(e.target.value) || 6;
                        onUpdateWineItem(wine.id, { glasses_per_bottle: val }, false);
                      }}
                      className="w-10 bg-slate-50 border border-slate-300 rounded-md px-1 py-0.5 text-center text-xs font-mono text-slate-600"
                    />
                    <span className="text-[9px] font-bold text-slate-400 tracking-tighter">杯/BTL</span>
                  </div>
                </div>

                {/* 5. 在庫数 */}
                <div className="flex items-center justify-center">
                  <input
                    type="number"
                    value={wine.stock === 0 ? 0 : (wine.stock || '')}
                    onChange={(e) => {
                      const val = parseInt(e.target.value) || 0;
                      onUpdateWineItem(wine.id, { stock: val }, false);
                    }}
                    className="w-14 bg-white border border-slate-300 rounded-lg px-2 py-2 focus:border-brand-wine outline-none font-mono text-slate-900 font-bold text-center text-sm"
                  />
                </div>

                {/* 6. 表示状態 */}
                <div className="flex items-center justify-center">
                  <button
                    onClick={() => {
                      onUpdateWineItem(wine.id, { visible: !wine.visible }, true);
                    }}
                    className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all shrink-0 w-[72px] ${
                      wine.visible
                        ? 'bg-green-50 border-green-200 text-green-700 hover:bg-green-100'
                        : 'bg-slate-100 border-slate-200 text-slate-400 hover:bg-slate-200'
                    }`}
                  >
                    {wine.visible ? '表示中' : '非表示'}
                  </button>
                </div>

                {/* 7. 操作 */}
                <div className="flex flex-col items-end justify-center gap-2">
                  <input
                     placeholder="ラベル..."
                     className="text-[10px] bg-slate-50 border border-slate-200 rounded-md px-2 py-1 outline-none focus:border-brand-wine w-20 text-center opacity-0 group-hover:opacity-100 transition-opacity"
                     value={wine.promoLabel || ''}
                     onChange={(e) => {
                       onUpdateWineItem(wine.id, { promoLabel: e.target.value }, false);
                     }}
                   />
                  <button
                    onClick={() => onDeleteWine(wine.id)}
                    className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all shrink-0 border border-transparent hover:border-red-100"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}

          {selectedWines.length === 0 && (
            <div className="px-8 py-24 text-center">
              <Wine className="w-12 h-12 text-slate-200 mx-auto mb-4 animate-bounce" />
              <p className="font-serif italic text-lg text-slate-400">「マスターから追加」ボタンでメニューを作りましょう</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
