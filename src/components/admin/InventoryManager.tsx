// src/components/admin/InventoryManager.tsx
import React, { useState } from 'react';
import { WineMaster, Store } from '../../types';
import { Plus, Wine, Upload, Sparkles, Trash2, Minus, ShoppingCart, Loader2 } from 'lucide-react';
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
  
  const [isOrderMode, setIsOrderMode] = useState(false);
  const [orderQuantities, setOrderQuantities] = useState<Record<string, number>>({});
  const [isOrderSubmitting, setIsOrderSubmitting] = useState(false);

  const toggleOrderMode = () => {
    if (isOrderMode) {
      setOrderQuantities({}); 
    }
    setIsOrderMode(!isOrderMode);
  };

  const getOrderQty = (wineId: string) => orderQuantities[wineId] ?? 0; 

  const updateOrderQty = (wineId: string, delta: number) => {
    setOrderQuantities(prev => {
      const current = prev[wineId] ?? 0;
      const next = Math.max(0, current + delta);
      return { ...prev, [wineId]: next };
    });
  };

  const setExactOrderQty = (wineId: string, qty: number) => {
    setOrderQuantities(prev => ({ ...prev, [wineId]: Math.max(0, qty) }));
  };

  const handleBulkPlaceOrder = async () => {
    const itemsToOrder = selectedWines
      .filter(w => (orderQuantities[w.id] ?? 0) > 0)
      .map(w => ({ id: w.id, name: w.name_jp, quantity: orderQuantities[w.id] }));

    if (itemsToOrder.length === 0) {
      showToast('発注するワインが選択されていません（全ての本数が0です）。', 'error');
      return;
    }

    const totalBottles = itemsToOrder.reduce((sum, item) => sum + item.quantity, 0);

    showConfirm(
      `合計 ${itemsToOrder.length} 銘柄、${totalBottles} 本をピーロート・ジャパンに発注しますか？`,
      async () => {
        setIsOrderSubmitting(true);
        try {
          const response = await fetch(`/api/menu/${selectedStoreId}/order`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ items: itemsToOrder })
          });

          if (response.ok) {
            showToast(`合計 ${totalBottles} 本を正常に発注しました。担当営業に控えが送信されます。`, 'success');
            setIsOrderMode(false);
            setOrderQuantities({});
          } else {
            showToast('発注処理に失敗しました。', 'error');
          }
        } catch (e) {
          showToast('通信エラーが発生しました。', 'error');
        } finally {
          setIsOrderSubmitting(false);
        }
      },
      '発注確定後、店舗オーナーおよび担当営業のメールアドレスに自動で控えが送信されます。'
    );
  };

  return (
    <div className="bg-white rounded-3xl overflow-hidden flex flex-col shadow-sm border border-slate-200 relative pb-16">
      <div className="px-4 md:px-8 py-5 md:py-6 border-b border-slate-100 bg-slate-50 flex flex-col xl:flex-row justify-between items-center gap-6">
        <div className="flex items-center gap-3 self-start md:self-auto">
          <div className={`w-10 h-10 text-white rounded-xl flex items-center justify-center shadow-md shrink-0 ${isOrderMode ? 'bg-brand-gold' : 'bg-brand-wine'}`}>
            {isOrderMode ? <ShoppingCart className="w-6 h-6 text-brand-wine" /> : <Wine className="w-6 h-6" />}
          </div>
          <h2 className="serif text-xl md:text-2xl text-slate-900">
            {isOrderMode ? 'ピーロート一括発注モード' : 'セラー銘柄管理'}
          </h2>
        </div>
        
        <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
          {isOwner && (
            <button
              onClick={toggleOrderMode}
              className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest transition-all shadow-md active:scale-95 ${
                isOrderMode 
                  ? 'bg-slate-200 text-slate-700 hover:bg-slate-300' 
                  : 'bg-brand-gold text-brand-wine hover:brightness-110'
              }`}
            >
              <ShoppingCart className="w-4 h-4 shrink-0" /> 
              <span className="truncate">{isOrderMode ? '発注モードを終了' : 'ピーロートへ発注する'}</span>
            </button>
          )}

          {!isOrderMode && (
            <>
              <button
                onClick={onShowCatalogSelection}
                className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-2.5 bg-brand-wine text-white rounded-xl text-xs font-bold uppercase tracking-widest hover:brightness-110 transition-all shadow-md active:scale-95"
              >
                <Plus className="w-5 h-5 shrink-0" /> <span className="truncate">銘柄を追加</span>
              </button>
              
              <input type="file" ref={fileInputRef} onChange={onFileUpload} className="hidden" accept=".csv" />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="hidden md:flex flex-none items-center justify-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-slate-700 transition-all shadow-md"
              >
                <Upload className="w-4 h-4" /> CSV読込
              </button>
            </>
          )}
        </div>
      </div>
     
      <div className="w-full overflow-x-auto pb-4">
        <div className="min-w-[1100px] p-4 md:p-6 space-y-4">
          <div className={`grid gap-4 px-6 py-3 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100 ${
            isOrderMode ? 'grid-cols-[2fr_3.5fr_2fr_1fr_0.5fr]' : 'grid-cols-[2fr_4fr_1fr_0.5fr]'
          }`}>
            <div>ワイン銘柄</div>
            <div className="text-center">価格設定 (仕入 / ボトル / グラス / 杯数)</div>
            {isOrderMode && <div className="text-center bg-brand-gold/[0.1] text-brand-wine font-black rounded-t-xl py-1">発注本数入力</div>}
            <div className="text-center">メニュー公開</div>
            <div className="text-right">操作</div>
          </div>

          {selectedWines.map((wine) => {
            const currentQty = getOrderQty(wine.id);
            return (
              <div
                key={wine.id}
                className={`bg-white px-6 py-4 rounded-2xl border border-slate-100 grid items-center gap-4 transition-all shadow-sm group ${
                  !wine.visible ? 'opacity-65 bg-slate-50/50' : 'hover:border-slate-300'
                } ${isOrderMode ? 'grid-cols-[2fr_3.5fr_2fr_1fr_0.5fr]' : 'grid-cols-[2fr_4fr_1fr_0.5fr]'}`}
              >
                {/* 1. ワイン銘柄 */}
                <div className="flex items-center gap-4 min-w-0 pr-4">
                  <button
                    onClick={() => onUpdateWineItem(wine.id, { isFeatured: !wine.isFeatured }, true)}
                    className={`p-2.5 rounded-xl transition-all border shrink-0 ${
                      wine.isFeatured ? 'bg-amber-50 border-amber-300 text-amber-500 shadow-sm' : 'bg-slate-50 border-slate-200 text-slate-300'
                    }`}
                  >
                    <Sparkles className={`w-4 h-4 ${wine.isFeatured ? 'fill-current' : ''}`} />
                  </button>
                  <div className="min-w-0 flex flex-col justify-center">
                    <span className="font-black text-slate-800 text-[15px] leading-tight line-clamp-2">
                      {wine.name_jp || '名称未設定'}
                    </span>
                    <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest truncate mt-1 flex items-center gap-2">
                      <span className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-500 font-mono">CODE: {wine.id}</span>
                    </div>
                  </div>
                </div>

                {/* 2. 販売価格設定 (仕入 / ボトル / グラス / 杯数) */}
                <div className="grid grid-cols-4 gap-2 items-center justify-center">
                  <div className="flex flex-col gap-1 items-center">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">仕入(税別)</span>
                    <div className="relative w-full">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 font-mono text-xs">¥</span>
                      <input
                        type="number"
                        value={wine.cost === 0 ? 0 : (wine.cost || '')}
                        onChange={(e) => onUpdateWineItem(wine.id, { cost: parseInt(e.target.value) || 0 }, true)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-6 pr-2 py-2 focus:border-brand-wine focus:bg-white outline-none font-mono text-slate-900 font-black text-center text-sm transition-all"
                      />
                    </div>
                  </div>
                  <div className="flex flex-col gap-1 items-center">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">ボトル</span>
                    <div className="relative w-full">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 font-mono text-xs">¥</span>
                      <input
                        type="number"
                        value={wine.price_bottle === 0 ? 0 : (wine.price_bottle || '')}
                        onChange={(e) => onUpdateWineItem(wine.id, { price_bottle: parseInt(e.target.value) || 0 }, true)}
                        className="w-full bg-white border border-slate-300 rounded-xl pl-6 pr-2 py-2 focus:border-brand-wine outline-none font-mono text-slate-900 font-black text-center text-sm shadow-inner"
                      />
                    </div>
                  </div>
                  <div className="flex flex-col gap-1 items-center">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">グラス</span>
                    <div className="relative w-full">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 font-mono text-xs">¥</span>
                      <input
                        type="number"
                        value={wine.price_glass === 0 ? 0 : (wine.price_glass || '')}
                        onChange={(e) => onUpdateWineItem(wine.id, { price_glass: parseInt(e.target.value) || 0 }, true)}
                        className="w-full bg-white border border-slate-300 rounded-xl pl-6 pr-2 py-2 focus:border-brand-wine outline-none font-mono text-slate-900 font-black text-center text-sm shadow-inner"
                      />
                    </div>
                  </div>
                  <div className="flex flex-col gap-1 items-center">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">杯数</span>
                    <div className="relative w-full">
                      <input
                        type="number"
                        value={wine.glasses_per_bottle === 0 ? 0 : (wine.glasses_per_bottle || 6)}
                        onChange={(e) => onUpdateWineItem(wine.id, { glasses_per_bottle: parseInt(e.target.value) || 6 }, true)}
                        className="w-full bg-white border border-slate-300 rounded-xl px-2 py-2 focus:border-brand-wine outline-none font-mono text-slate-900 font-black text-center text-sm shadow-inner"
                      />
                      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">杯</span>
                    </div>
                  </div>
                </div>

                {/* 3. オーナーのみ：発注数量入力 */}
                {isOrderMode && (
                  <div className="flex items-center justify-center bg-brand-gold/[0.05] p-2 rounded-2xl border border-brand-gold/30">
                    <div className="flex items-center bg-white rounded-xl p-1 border border-slate-200 shadow-sm w-full max-w-[220px]">
                      <button
                        type="button"
                        onClick={() => updateOrderQty(wine.id, -6)}
                        className="w-9 h-10 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-200 transition-all shrink-0"
                      >
                        <span className="text-[10px] font-black tracking-tighter">-6</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => updateOrderQty(wine.id, -1)}
                        className="w-8 h-10 flex items-center justify-center text-slate-400 hover:text-brand-wine shrink-0"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      
                      {/* 手入力にも柔軟に対応 */}
                      <input
                        type="number"
                        value={currentQty === 0 ? '' : currentQty}
                        placeholder="0"
                        onChange={(e) => setExactOrderQty(wine.id, parseInt(e.target.value) || 0)}
                        className="w-full min-w-0 text-center font-mono text-brand-wine font-black text-lg outline-none bg-transparent px-1"
                      />

                      <button
                        type="button"
                        onClick={() => updateOrderQty(wine.id, 1)}
                        className="w-8 h-10 flex items-center justify-center text-slate-400 hover:text-brand-wine shrink-0"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => updateOrderQty(wine.id, 6)}
                        className="w-9 h-10 rounded-lg bg-brand-wine/10 border border-brand-wine/20 flex items-center justify-center text-brand-wine hover:bg-brand-wine hover:text-white transition-all shrink-0"
                      >
                        <span className="text-[10px] font-black tracking-tighter">+6</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* 4. デジタルメニュー公開スイッチ */}
                <div className="flex items-center justify-center">
                  <button
                    onClick={() => onUpdateWineItem(wine.id, { visible: !wine.visible }, true)}
                    className={`h-11 px-4 rounded-xl text-xs font-black uppercase tracking-widest border transition-all shrink-0 w-28 flex items-center justify-center ${
                      wine.visible
                        ? 'bg-green-50 border-green-200 text-green-700 hover:bg-green-100 shadow-sm'
                        : 'bg-slate-50 border-slate-200 text-slate-400 hover:bg-slate-100'
                    }`}
                  >
                    {wine.visible ? '● 公開中' : '✕ 非表示'}
                  </button>
                </div>

                {/* 5. 操作 (リストから削除) */}
                <div className="flex items-center justify-end">
                  <button
                    onClick={() => onDeleteWine(wine.id)}
                    className="p-2.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all border border-transparent hover:border-red-100"
                    title="メニューリストから削除"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <AnimatePresence>
        {isOrderMode && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="absolute bottom-0 left-0 right-0 bg-brand-dark/95 backdrop-blur-xl border-t border-brand-gold/20 px-6 py-4 flex items-center justify-between z-50 shadow-[0_-10px_40px_rgba(0,0,0,0.3)]"
          >
            <div className="flex flex-col">
              <span className="text-brand-gold text-[10px] font-bold uppercase tracking-widest">発注サマリー</span>
              <span className="text-white text-lg font-black tracking-wider">
                合計: {selectedWines.filter(w => (orderQuantities[w.id] || 0) > 0).length} 銘柄 / {selectedWines.reduce((sum, w) => sum + (orderQuantities[w.id] || 0), 0)} 本
              </span>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={toggleOrderMode}
                className="px-6 py-3 text-white/70 hover:text-white text-xs font-bold uppercase tracking-widest transition-colors"
              >
                キャンセル
              </button>
              <button
                disabled={isOrderSubmitting || selectedWines.reduce((sum, w) => sum + (orderQuantities[w.id] || 0), 0) === 0}
                onClick={handleBulkPlaceOrder}
                className="px-8 py-3 bg-brand-gold text-brand-wine rounded-xl text-sm font-black uppercase tracking-widest hover:brightness-110 active:scale-95 transition-all shadow-[0_0_20px_rgba(212,175,55,0.4)] disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isOrderSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <ShoppingCart className="w-5 h-5" />}
                一括発注を確定する
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
