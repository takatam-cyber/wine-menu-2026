// src/components/admin/InventoryManager.tsx
import React, { useState } from 'react';
import { WineMaster, Store } from '../../types';
import { Plus, Wine, Upload, Save, Sparkles, Trash2, Minus, ShoppingCart } from 'lucide-react';
import { useWines } from '../../lib/WineContext';

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
  onShowCatalogSelection,
  onFileUpload,
  onSaveInventory,
  onDeleteWine,
  fileInputRef,
  onUpdateWineItem,
  // 💡 厳格な型チェック・未使用プロパティ警告を完璧に回避するため、Propsを全て明示的に受領
  setSelectedWines,
  masterWines,
  searchId,
  setSearchId,
  handleAddWine,
  hasMoreWines,
  onLoadMoreWines,
}) => {
  const { showToast, showConfirm } = useWines();
  
  // 各銘柄の発注予定本数を個別に保持 (飲食店で一般的な1ケース=6本を初期値に採用)
  const [orderQuantities, setOrderQuantities] = useState<Record<string, number>>({});
  const [isOrderSubmitting, setIsOrderSubmitting] = useState(false);

  const getOrderQty = (wineId: string) => orderQuantities[wineId] ?? 6;

  const updateOrderQty = (wineId: string, delta: number) => {
    setOrderQuantities(prev => {
      const current = prev[wineId] ?? 6;
      const next = Math.max(6, current + delta); // 最小は1ケース(6本)を保証
      return { ...prev, [wineId]: next };
    });
  };

  // ピーロートへのダイレクト発注キック処理
  const handlePlaceOrder = async (wine: WineMaster) => {
    const qty = getOrderQty(wine.id);
    
    showConfirm(
      `ピーロート・ジャパンにこのワインを【 ${qty} 本 】発注しますか？`,
      async () => {
        setIsOrderSubmitting(true);
        try {
          const response = await fetch(`/api/menu/${selectedStoreId}/order`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              items: [{ id: wine.id, name: wine.name_jp, quantity: qty }]
            })
          });

          if (response.ok) {
            showToast(`「${wine.name_jp}」を ${qty} 本、正常に発注しました。営業担当へ控えが自動送信されます。`, 'success');
            // 発注成功後に選択本数を初期値に戻す
            setOrderQuantities(prev => ({ ...prev, [wine.id]: 6 }));
          } else {
            showToast('発注処理に失敗しました。', 'error');
          }
        } catch (e) {
          showToast('通信エラーが発生しました。', 'error');
        } finally {
          setIsOrderSubmitting(false);
        }
      },
      `注文予定：${wine.name_jp} × ${qty}本（${Math.ceil(qty / 6)} ケース）`
    );
  };

  return (
    <div className="bg-white rounded-3xl overflow-hidden flex flex-col shadow-sm border border-slate-200">
      <div className="px-4 md:px-8 py-5 md:py-6 border-b border-slate-100 bg-slate-50 flex flex-col xl:flex-row justify-between items-center gap-6">
        <div className="flex items-center gap-3 self-start md:self-auto">
          <div className="w-10 h-10 bg-brand-wine text-white rounded-xl flex items-center justify-center shadow-md shrink-0">
            <Wine className="w-6 h-6" />
          </div>
          <h2 className="serif text-xl md:text-2xl text-slate-900">セラー銘柄選択 ＆ ピーロート即時発注</h2>
        </div>
        
        <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
          <button
            onClick={onShowCatalogSelection}
            className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-2.5 bg-brand-gold text-brand-wine rounded-xl text-xs font-bold uppercase tracking-widest hover:brightness-110 transition-all shadow-md active:scale-95"
          >
            <Plus className="w-5 h-5 shrink-0" /> <span className="truncate">カタログから銘柄を追加</span>
          </button>
          
          <input type="file" ref={fileInputRef} onChange={onFileUpload} className="hidden" accept=".csv" />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="hidden md:flex flex-none items-center justify-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-slate-700 transition-all shadow-md"
          >
            <Upload className="w-4 h-4" /> CSVマスター読込
          </button>
        </div>
      </div>
     
      {/* 💡 修正点: custom-scrollbar の後ろに入り込んでいた全角文字「规范」を完全抹消 */}
      <div className="w-full overflow-x-auto custom-scrollbar pb-4">
        <div className="min-w-[1120px] p-4 md:p-6 space-y-4">
          <div className="grid grid-cols-[2.8fr_1fr_1fr_2.2fr_1.2fr_0.8fr] gap-4 px-6 py-3 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100">
            <div>ワイン銘柄</div>
            <div className="text-center">仕入れ原価</div>
            <div className="text-center">ボトル価格設定</div>
            <div className="text-center bg-brand-wine/[0.02] text-brand-wine font-black rounded-t-xl">老眼・現場特化：ワンタップ発注（ケース単位）</div>
            <div className="text-center">お客様メニュー公開</div>
            <div className="text-right">操作</div>
          </div>

          {selectedWines.map((wine) => {
            const currentQty = getOrderQty(wine.id);
            return (
              <div
                key={wine.id}
                className={`bg-white px-6 py-4 rounded-2xl border border-slate-100 grid grid-cols-[2.8fr_1fr_1fr_2.2fr_1.2fr_0.8fr] items-center gap-4 transition-all shadow-sm group ${
                  !wine.visible ? 'opacity-65 bg-slate-50/50' : 'hover:border-slate-300'
                }`}
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
                      <span className="truncate">{wine.country} / {wine.region}</span>
                    </div>
                  </div>
                </div>

                {/* 2. 仕入れ原価 */}
                <div className="flex items-center justify-center font-mono text-slate-700 font-bold text-sm">
                  ¥{(wine.cost || 2000).toLocaleString()}
                </div>

                {/* 3. ボトル価格設定 */}
                <div className="flex items-center justify-center">
                  <div className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 font-mono text-xs">¥</span>
                    <input
                      type="number"
                      value={wine.price_bottle === 0 ? 0 : (wine.price_bottle || '')}
                      onChange={(e) => onUpdateWineItem(wine.id, { price_bottle: parseInt(e.target.value) || 0 }, true)}
                      className="w-24 bg-white border border-slate-300 rounded-xl pl-6 pr-2 py-2 focus:border-brand-wine outline-none font-mono text-slate-900 font-black text-center text-sm"
                    />
                  </div>
                </div>

                {/* 4. 老眼・現場対応：ワンタップ発注コントロール */}
                <div className="flex items-center justify-center bg-brand-wine/[0.02] p-2 rounded-2xl border border-brand-wine/10 gap-3">
                  <div className="flex items-center bg-white rounded-xl p-1 border border-slate-200 shadow-sm">
                    <button
                      type="button"
                      disabled={currentQty <= 6}
                      onClick={() => updateOrderQty(wine.id, -6)}
                      className="w-10 h-10 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-brand-wine hover:text-white transition-all disabled:opacity-20"
                    >
                      <Minus className="w-4 h-4 stroke-[3]" />
                    </button>
                    
                    <div className="w-16 text-center font-mono text-slate-900 font-black text-base select-none">
                      {currentQty}<span className="text-[10px] font-sans text-slate-400 ml-0.5">本</span>
                    </div>

                    <button
                      type="button"
                      onClick={() => updateOrderQty(wine.id, 6)}
                      className="w-10 h-10 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-brand-wine hover:text-white transition-all"
                    >
                      <Plus className="w-4 h-4 stroke-[3]" />
                    </button>
                  </div>

                  <button
                    type="button"
                    disabled={isOrderSubmitting}
                    onClick={() => handlePlaceOrder(wine)}
                    className="h-12 px-4 bg-brand-gold text-brand-wine rounded-xl text-xs font-black uppercase tracking-widest hover:brightness-110 active:scale-95 transition-all flex items-center gap-2 shadow-md shadow-brand-gold/10 shrink-0"
                  >
                    <ShoppingCart className="w-4 h-4 stroke-[2.5]" />
                    <span>発注する</span>
                  </button>
                </div>

                {/* 5. デジタルメニュー公開スイッチ */}
                <div className="flex items-center justify-center">
                  <button
                    onClick={() => onUpdateWineItem(wine.id, { visible: !wine.visible }, true)}
                    className={`h-11 px-4 rounded-xl text-xs font-black uppercase tracking-widest border transition-all shrink-0 w-28 flex items-center justify-center ${
                      wine.visible
                        ? 'bg-green-50 border-green-200 text-green-700 hover:bg-green-100 shadow-sm'
                        : 'bg-red-50 border-red-200 text-red-600 hover:bg-red-100'
                    }`}
                  >
                    {wine.visible ? '● 公開中' : '✕ 完売・非表示'}
                  </button>
                </div>

                {/* 6. 操作 (リストから削除) */}
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
    </div>
  );
};
