import React from 'react';
import { WineMaster, Store } from '../../types';
import { Search, Plus, Wine, Upload, Save, Sparkles, Trash2, CheckCircle2, X, Eye, EyeOff } from 'lucide-react';
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
  onUpdateWineItem: (wineId: string, updatedFields: Partial<WineMaster>) => void;
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
      {/* 操作アクションヘッダー */}
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
              placeholder="ワイン名、産地、IDでマスターを検索..."
              value={searchId}
              onChange={(e) => setSearchId(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddWine()}
              className="pl-12 pr-4 py-2 bg-white border border-slate-300 rounded-full text-xs w-full md:w-56 lg:w-80 text-slate-900 outline-none focus:ring-2 focus:ring-brand-wine/10 focus:border-brand-wine transition-all"
            />
            
            {/* ライブ検索サジェストパネルをフローティング配置 */}
            {searchId.trim().length > 0 && (() => {
              const matched = masterWines
                .filter(w => {
                  const query = searchId.toLowerCase();
                  const matchesNameJp = (w.name_jp || '').toLowerCase().includes(query);
                  const matchesNameEn = (w.name_en || '').toLowerCase().includes(query);
                  const matchesId = (w.id || '').toLowerCase().includes(query);
                  const matchesCountry = (w.country || '').toLowerCase().includes(query);
                  return (matchesNameJp || matchesNameEn || matchesId || matchesCountry) && !selectedWines.some(sw => sw.id === w.id);
                })
                .slice(0, 8); // 表示上限を8件にしてスマートに

              if (matched.length === 0) return null;

              return (
                <div className="absolute left-0 right-0 z-[100] mt-2 bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden max-h-64 overflow-y-auto animate-in fade-in slide-in-from-top-1 duration-200">
                  <div className="px-4 py-2 bg-slate-50 border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    マスターカタログ検索候補 ({matched.length}件)
                  </div>
                  {matched.map(w => (
                    <button
                      key={w.id}
                      onClick={() => {
                        handleAddWine(w.id);
                        setSearchId('');
                      }}
                      className="w-full text-left px-4 py-3 hover:bg-slate-50 border-b border-slate-100/50 flex flex-col gap-0.5 transition-colors group"
                    >
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-xs text-slate-800 group-hover:text-brand-wine transition-colors">{w.name_jp}</span>
                        <span className="bg-slate-100 text-slate-500 font-mono text-[9px] px-1.5 py-0.5 rounded font-black uppercase tracking-wider shrink-0">{w.supplier || 'PIEROTH'}</span>
                      </div>
                      <div className="text-[10px] text-slate-400 font-medium">
                        {w.country || '不明な生産国'} • {w.grape || '不明な品種'} • 通常 ¥{w.price_bottle?.toLocaleString()} • (ID: {w.id})
                      </div>
                    </button>
                  ))}
                </div>
              );
            })()}
          </div>
          <button
            onClick={() => handleAddWine()}
            className="bg-brand-gold text-brand-wine p-2 md:p-2.5 rounded-full hover:scale-110 transition-all shadow-md active:scale-95 shrink-0"
            title="選択したワインをリストに即時追加"
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
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 md:px-4 py-2 bg-slate-800 text-white rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-slate-700 transition-all shadow-md"
            >
              <Upload className="w-4 h-4 shrink-0" /> <span className="truncate">CSV読み込み</span>
            </button>
            <button
              onClick={onSaveInventory}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 md:px-4 py-2 border-2 border-brand-wine text-brand-wine rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-brand-wine hover:text-white transition-all shadow-sm"
            >
              <Save className="w-4 h-4 shrink-0" /> <span className="truncate">保存</span>
            </button>
          </div>
        </div>
      </div>
     
      {/* メインリスト領域 */}
      <div className="p-4 md:p-6 space-y-4">
        {/* PC表示用のグリッドヘッダー（mdサイズ以上でのみ表示） */}
        <div className="hidden md:grid md:grid-cols-12 gap-4 px-6 py-2 text-xs font-extrabold text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100">
          <div className="md:col-span-4">ワイン銘柄</div>
          <div className="md:col-span-2 text-center">仕入れ原価(税別)</div>
          <div className="md:col-span-2 text-center">ボトル設定</div>
          <div className="md:col-span-2 text-center">グラス設定</div>
          <div className="md:col-span-1 text-center">表示状態</div>
          <div className="md:col-span-1 text-right">操作</div>
        </div>

        {/* ワインカードリスト */}
        {selectedWines.map((wine, idx) => {
          const bottleStats = calculateProfit(wine.cost, wine.price_bottle);
          const glassStats = calculateGlassProfit(wine.cost, wine.price_glass, wine.glasses_per_bottle || 6);
          return (
            <div
              key={wine.id}
              className={`bg-white p-4 md:p-6 rounded-2xl border border-slate-100 md:grid md:grid-cols-12 flex flex-col items-center gap-4 transition-all shadow-sm group ${
                !wine.visible ? 'opacity-60 bg-slate-50/50' : 'hover:border-slate-300'
              }`}
            >
              {/* 1. ワイン銘柄カラム (PC: 4/12幅, スマホ: w-full) */}
              <div className="md:col-span-4 flex items-center gap-3 w-full min-w-0">
                <button
                  onClick={() => {
                    onUpdateWineItem(wine.id, { isFeatured: !wine.isFeatured });
                  }}
                  className={`p-2 rounded-xl transition-all border shrink-0 ${
                    wine.isFeatured ? 'bg-amber-50 border-amber-300 text-amber-500 shadow-sm' : 'bg-slate-50 border-slate-200 text-slate-300 hover:text-slate-400'
                  }`}
                  title={wine.isFeatured ? 'おすすめ解除' : 'おすすめに設定'}
                >
                  <Sparkles className={`w-4 h-4 ${wine.isFeatured ? 'fill-current' : ''}`} />
                </button>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 mb-1 w-full min-w-0">
                    <span className="font-bold text-slate-800 text-sm md:text-base leading-snug break-words">
                      {wine.name_jp}
                    </span>
                    {wine.isFeatured && (
                      <span className="bg-amber-100 text-amber-600 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-widest shrink-0">
                        Featured
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] md:text-xs text-slate-400 font-bold uppercase tracking-widest truncate">
                    ID: {wine.id} • {wine.region}
                  </div>
                </div>
              </div>

              {/* 2. 仕入れ原価カラム */}
              <div className="md:col-span-2 w-full md:w-auto flex md:flex-col items-center justify-between md:justify-center gap-2 px-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest md:hidden">仕入れ原価</span>
                <div className="flex items-center gap-1">
                  <span className="text-slate-400 font-mono text-xs">¥</span>
                  <input
                    type="number"
                    defaultValue={wine.cost}
                    key={`cost-${wine.id}-${wine.cost}`}
                    onBlur={(e) => {
                      const val = parseInt(e.target.value) || 0;
                      if (val !== wine.cost) {
                        onUpdateWineItem(wine.id, { cost: val });
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.currentTarget.blur();
                      }
                    }}
                    className="w-24 bg-slate-50 border border-slate-200 rounded-xl px-2 py-1.5 focus:border-brand-wine outline-none font-mono text-slate-700 text-center font-bold"
                  />
                </div>
              </div>

              {/* 3. ボトル設定カラム */}
              <div className="md:col-span-2 w-full md:w-auto flex md:flex-col items-center justify-between md:justify-center gap-2 px-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest md:hidden">ボトル価格</span>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    defaultValue={wine.price_bottle}
                    key={`bottle-${wine.id}-${wine.price_bottle}`}
                    onBlur={(e) => {
                      const val = parseInt(e.target.value) || 0;
                      if (val !== wine.price_bottle) {
                        onUpdateWineItem(wine.id, { price_bottle: val });
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.currentTarget.blur();
                      }
                    }}
                    className="w-24 md:w-28 bg-white border border-slate-300 rounded-xl px-2 py-1.5 focus:border-brand-wine outline-none font-mono text-slate-900 font-bold text-center"
                  />
                  <div className="flex flex-col text-right md:text-center min-w-[60px]">
                    <span className="font-bold text-brand-wine font-mono text-xs">¥{bottleStats.profit.toLocaleString()}</span>
                    <span className="text-[10px] text-slate-400 font-bold tracking-tighter">粗利 {Math.round(bottleStats.costRatio)}%</span>
                  </div>
                </div>
              </div>

              {/* 4. グラス設定カラム */}
              <div className="md:col-span-2 w-full md:w-auto flex flex-col gap-2 border-t md:border-t-0 pt-2 md:pt-0 border-slate-100">
                <div className="flex items-center justify-between md:justify-center gap-2">
                  <span className="text-[10px] font-bold text-slate-400 w-8 md:hidden">グラス価格</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      defaultValue={wine.price_glass}
                      key={`glass-${wine.id}-${wine.price_glass}`}
                      onBlur={(e) => {
                        const val = parseInt(e.target.value) || 0;
                        if (val !== wine.price_glass) {
                          onUpdateWineItem(wine.id, { price_glass: val });
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.currentTarget.blur();
                        }
                      }}
                      className="w-20 bg-white border border-slate-300 rounded-lg px-2 py-1 text-xs font-mono text-slate-900 text-center"
                    />
                    <div className="flex flex-col text-right md:text-left min-w-[55px]">
                      <span className="font-bold text-brand-wine font-mono text-[11px]">¥{glassStats.profit.toLocaleString()}</span>
                      <span className="text-[9px] text-slate-400 font-bold">粗利 {Math.round(glassStats.costRatio)}%</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between md:justify-center gap-2">
                  <span className="text-[10px] font-bold text-slate-400 w-8 md:hidden">グラス杯数</span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      defaultValue={wine.glasses_per_bottle || 6}
                      key={`gpb-${wine.id}-${wine.glasses_per_bottle}`}
                      onBlur={(e) => {
                        const val = parseInt(e.target.value) || 6;
                        if (val !== wine.glasses_per_bottle) {
                          onUpdateWineItem(wine.id, { glasses_per_bottle: val });
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.currentTarget.blur();
                        }
                      }}
                      className="w-12 bg-slate-50 border border-slate-300 rounded-md px-1 py-0.5 text-center text-xs font-mono text-slate-600"
                    />
                    <span className="text-[10px] font-bold text-slate-400 tracking-tighter">杯 / BTL</span>
                  </div>
                </div>
              </div>

              {/* 5. メニュー表示設定カラム */}
              <div className="md:col-span-1 w-full md:w-auto flex md:flex-col items-center justify-between md:justify-center gap-2 border-t md:border-t-0 pt-2 md:pt-0 border-slate-100">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest md:hidden">メニュー表示</span>
                <button
                  onClick={() => {
                    onUpdateWineItem(wine.id, { visible: !wine.visible });
                  }}
                  className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all shrink-0 ${
                    wine.visible
                      ? 'bg-green-50 border-green-200 text-green-700 hover:bg-green-100'
                      : 'bg-slate-100 border-slate-200 text-slate-400 hover:bg-slate-200'
                  }`}
                >
                  {wine.visible ? '表示中' : '非表示'}
                </button>
              </div>

              {/* 6. 操作（削除）カラム */}
              <div className="md:col-span-1 w-full md:w-auto flex items-center justify-end md:justify-end border-t md:border-t-0 pt-2 md:pt-0 border-slate-100">
                <div className="md:hidden flex items-center gap-2 mr-auto">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">ラベル:</span>
                  <input
                     placeholder="プロモラベル..."
                     className="text-xs bg-slate-50 border border-slate-200 rounded-md px-2 py-1 outline-none focus:border-brand-wine w-24"
                     defaultValue={wine.promoLabel || ''}
                     key={`promo-mobile-${wine.id}-${wine.promoLabel || ''}`}
                     onBlur={(e) => {
                       const val = e.target.value;
                       if (val !== wine.promoLabel) {
                         onUpdateWineItem(wine.id, { promoLabel: val });
                       }
                     }}
                     onKeyDown={(e) => {
                       if (e.key === 'Enter') {
                         e.currentTarget.blur();
                       }
                     }}
                   />
                </div>
                {/* デスクトップ表示用のプロモ入力（グループホバーで滑らかに出現） */}
                <div className="hidden md:flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all mr-2">
                  <input
                     placeholder="おすすめラベル..."
                     className="text-[11px] bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 outline-none focus:border-brand-wine w-24"
                     defaultValue={wine.promoLabel || ''}
                     key={`promo-desktop-${wine.id}-${wine.promoLabel || ''}`}
                     onBlur={(e) => {
                       const val = e.target.value;
                       if (val !== wine.promoLabel) {
                         onUpdateWineItem(wine.id, { promoLabel: val });
                       }
                     }}
                     onKeyDown={(e) => {
                       if (e.key === 'Enter') {
                         e.currentTarget.blur();
                       }
                     }}
                   />
                </div>
                <button
                  onClick={() => onDeleteWine(wine.id)}
                  className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all shrink-0 border border-transparent hover:border-red-100"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}

        {/* 在庫が空の時のフォールバック表示 */}
        {selectedWines.length === 0 && (
          <div className="px-8 py-24 text-center">
            <Wine className="w-12 h-12 text-slate-200 mx-auto mb-4 animate-bounce" />
            <p className="font-serif italic text-lg text-slate-400">銘柄を選択、またはCSVを読み込んで開始します</p>
          </div>
        )}
      </div>
    </div>
  );
};
