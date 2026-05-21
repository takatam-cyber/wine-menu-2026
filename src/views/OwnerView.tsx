// src/views/OwnerView.tsx
import React, { useState, useEffect, useRef } from 'react';
import { WineMaster, Store, extractPureId } from '../types';
import { Wine, Save, Loader2, X, Plus, Search, Edit2, AlertCircle, Sparkles } from 'lucide-react';
import { useWines } from '../lib/WineContext';
import { db } from '../lib/firebase';
import { doc, updateDoc, setDoc, writeBatch, deleteDoc } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';
import { useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'motion/react';
import { wineRepository } from '../lib/repositories/wineRepository';
import { useStoresQuery } from '../hooks/useStoresQuery';
import { useInventoryQuery, useInventoryMutations } from '../hooks/useInventoryQuery';
import { useWinesMasterQuery } from '../hooks/useWinesQuery';
import { InventoryManager } from '../components/admin/InventoryManager';
import { CatalogSelector } from '../components/admin/CatalogSelector';
import { StoreAnalytics } from '../components/admin/StoreAnalytics';

export const OwnerView: React.FC = () => {
  const { user } = useWines();
  const queryClient = useQueryClient();
  const [selectedStoreId, setSelectedStoreId] = useState(new URLSearchParams(window.location.search).get('storeId') || user?.storeId || '');
  
  const { data: storesData } = useStoresQuery(user);
  const stores = storesData?.pages.flatMap(p => p.data) || [];

  const { data: inventoryData, isLoading: inventoryLoading } = useInventoryQuery(selectedStoreId);
  const { updateStoreMutation } = useInventoryMutations(selectedStoreId);
  
  const store = inventoryData?.store || null;
  const inventory = inventoryData?.inventory || [];

  const { data: masterWinesData, fetchNextPage: fetchNextWinesMaster, hasNextPage: hasMoreWinesMaster } = useWinesMasterQuery();
  const masterWines = masterWinesData?.pages.flatMap(p => p.data) || [];
  const [masterSearchTerm, setMasterSearchTerm] = useState('');

  const [selectedWines, setSelectedWines] = useState<WineMaster[]>([]);
  const [searchId, setSearchId] = useState('');
  const [isEditingStore, setIsEditingStore] = useState(false);
  const [editStoreData, setEditStoreData] = useState<Partial<Store>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [showCatalogSelection, setShowCatalogSelection] = useState(false);
  const [selectedMasterIds, setSelectedMasterIds] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (inventoryData?.inventory && selectedStoreId === inventoryData.store?.id) {
      setSelectedWines(inventoryData.inventory);
    } else if (!selectedStoreId) {
      setSelectedWines([]);
    }
  }, [selectedStoreId, inventoryData?.inventory]);

  useEffect(() => {
    if (store) {
      setEditStoreData(store);
    }
  }, [store]);

  const getWineDocId = (wine: { id: string; supplier?: string; pureId?: string }) => {
    const pure = extractPureId(wine.pureId || wine.id, wine.supplier);
    const supplier = (wine.supplier || 'PIEROTH').toUpperCase();
    return `${supplier}_${pure}`;
  };

  useEffect(() => {
    const urlSid = new URLSearchParams(window.location.search).get('storeId');
    if (urlSid) {
      setSelectedStoreId(urlSid);
    } else if (user?.storeId) {
      setSelectedStoreId(user.storeId);
    } else if (stores.length > 0 && (user?.role === 'admin' || user?.role === 'rep')) {
      if (!selectedStoreId) setSelectedStoreId(stores[0].id);
    }
  }, [stores, user]);

  // 【バグ修正】オーナー画面で選択中の店舗IDを、ブラウザのURLパラメータ(?storeId=xxx)にリアルタイム常時同期
  // これにより、ヘッダーの「管理者画面に戻る」共通ボタンがいつでも正しい店舗IDを読み込めるようになります
  useEffect(() => {
    if (selectedStoreId) {
      const url = new URL(window.location.href);
      if (url.searchParams.get('storeId') !== selectedStoreId) {
        url.searchParams.set('storeId', selectedStoreId);
        window.history.replaceState({}, '', url.toString());
      }
    }
  }, [selectedStoreId]);

  const sid = selectedStoreId;

  const projectWineForPublic = (w: any) => ({
    id: getWineDocId(w),
    pureId: extractPureId(w.pureId || w.id, w.supplier),
    supplier: (w.supplier || 'PIEROTH').toUpperCase(),
    name_jp: w.name_jp,
    name_en: w.name_en,
    menu_short: w.menu_short || '',
    menu_short_en: w.menu_short_en || '',
    ai_explanation: w.ai_explanation || '',
    ai_explanation_en: w.ai_explanation_en || '',
    country: w.country,
    country_en: w.country_en,
    region: w.region,
    region_en: w.region_en,
    grape: w.grape,
    grape_en: w.grape_en,
    color: w.color,
    color_en: w.color_en,
    type: w.type,
    type_en: w.type_en,
    vintage: w.vintage,
    alcohol: w.alcohol,
    sweetness: w.sweetness || 1,
    body: w.body || 3,
    acidity: w.acidity || 3,
    tannins: w.tannins || 3,
    aroma_intensity: w.aroma_intensity || 3,
    complexity: w.complexity || 3,
    finish: w.finish || 3,
    oak: w.oak || 1,
    aroma_features: w.aroma_features || '',
    aroma_features_en: w.aroma_features_en || '',
    tags: w.tags || '',
    tags_en: w.tags_en || '',
    pairing: w.pairing || '',
    pairing_en: w.pairing_en || '',
    price_bottle: w.price_bottle,
    price_glass: w.price_glass,
    glasses_per_bottle: w.glasses_per_bottle || 6,
    image_url: w.image_url,
    isFeatured: w.isFeatured ?? false,
    promoLabel: w.promoLabel || '',
    isActive: w.isActive ?? true,
    updatedAt: new Date().toISOString()
  });

  const syncPublicMenuWithDocs = async (storeId: string, updatedWines: WineMaster[]) => {
    try {
      const richPublicMenu = updatedWines
        .filter(w => w.visible !== false && w.isActive !== false)
        .map(w => {
          const compId = getWineDocId(w);
          return projectWineForPublic({ ...w, id: compId, pureId: w.pureId || w.id });
        });

      await updateDoc(doc(db, 'stores', storeId), {
        publicMenu: richPublicMenu,
        updatedAt: new Date().toISOString()
      });
      
      fetch(`/api/menu/${storeId}/invalidate`, { method: 'POST' }).catch(() => {});
      queryClient.invalidateQueries({ queryKey: ['publicMenu', storeId] });
    } catch (e) {
      console.error("Failed to sync publicMenu:", e);
    }
  };

  const handleUpdateStore = async () => {
    if (!sid || !user?.uid) return;
    setIsSaving(true);
    try {
      await updateStoreMutation.mutateAsync({
        name: editStoreData.name,
        cuisine_type: editStoreData.cuisine_type,
        address: editStoreData.address,
        hidePairingFilter: editStoreData.hidePairingFilter,
        hideWinePairing: editStoreData.hideWinePairing,
        budgetTiers: editStoreData.budgetTiers,
      });

      if (editStoreData.name !== store?.name) {
        await updateDoc(doc(db, 'users', user.uid), {
          name: editStoreData.name
        });
      }

      setIsEditingStore(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `stores/${sid}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateWineItem = (wineId: string, updatedFields: Partial<WineMaster>, saveImmediately = false) => {
    if (!sid) return;
    
    const nextWines = selectedWines.map(w => {
      if (w.id === wineId) {
        return { ...w, ...updatedFields };
      }
      return w;
    });

    setSelectedWines(nextWines);

    if (saveImmediately) {
      const wine = nextWines.find(w => w.id === wineId);
      if (!wine) return;

      const compositeId = getWineDocId(wine);
      const itemRef = doc(db, 'stores', sid, 'inventory', compositeId);

      (async () => {
        try {
          const docPayload = {
            id: compositeId,
            pureId: wine.pureId || wine.id,
            supplier: (wine.supplier || 'PIEROTH').toUpperCase(),
            price_bottle: wine.price_bottle ?? 0,
            price_glass: wine.price_glass ?? 0,
            cost: wine.cost ?? 0,
            stock: wine.stock ?? 0,
            glasses_per_bottle: wine.glasses_per_bottle ?? 6,
            visible: wine.visible ?? true,
            isFeatured: wine.isFeatured ?? false,
            promoLabel: wine.promoLabel || '',
            updatedAt: new Date().toISOString()
          };
          await setDoc(itemRef, docPayload, { merge: true });
          await syncPublicMenuWithDocs(sid, nextWines);
        } catch (error) {
          console.error('Error auto-updating wine inventory item:', error);
        }
      })();
    }
  };

  const handleSaveInventory = async () => {
    if (!sid) return;
    setIsSaving(true);
    try {
      const CHUNK_SIZE = 450;
      const wines = [...selectedWines];
      
      for (let i = 0; i < wines.length; i += CHUNK_SIZE) {
        const chunk = wines.slice(i, i + CHUNK_SIZE);
        const batch = writeBatch(db);
        
        chunk.forEach(wine => {
          const compositeId = getWineDocId(wine);
          const docRef = doc(db, 'stores', sid, 'inventory', compositeId);
          
          const inventoryItem = {
            id: compositeId,
            pureId: wine.pureId || wine.id,
            supplier: (wine.supplier || 'PIEROTH').toUpperCase(),
            price_bottle: wine.price_bottle ?? 0,
            price_glass: wine.price_glass ?? 0,
            cost: wine.cost ?? 0,
            stock: wine.stock ?? 0,
            glasses_per_bottle: wine.glasses_per_bottle || 6,
            visible: wine.visible ?? true,
            isFeatured: wine.isFeatured ?? false,
            promoLabel: wine.promoLabel || '',
            isActive: wine.isActive ?? true,
            updatedAt: new Date().toISOString()
          };
          batch.set(docRef, inventoryItem, { merge: true });
        });
        
        await batch.commit();
      }

      await syncPublicMenuWithDocs(sid, wines);

      alert('すべてのセラー情報を一括保存しました。');
      queryClient.invalidateQueries({ queryKey: ['inventory', sid] });
      queryClient.invalidateQueries({ queryKey: ['stores'] });
    } catch (error) {
      console.error('一括保存に失敗しました:', error);
      alert('一括保存に失敗しました。');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddWine = async (wineId?: string) => {
    const idToUse = wineId || searchId;
    let wine = masterWines.find(w => w.id === idToUse);
    
    if (!wine) {
      try {
        wine = await wineRepository.getWineById(idToUse) || undefined;
      } catch (e) {
        console.error("Master wine fetch error:", e);
      }
    }

    if (!wine) {
      alert('該当するワインコードが見つかりません。候補リストから選択してください。');
      return;
    }

    const compositeId = getWineDocId(wine);
    const alreadyExists = selectedWines.some(sw => sw.pureId === (wine?.pureId || wine?.id));

    if (alreadyExists) {
      alert('このワインは既にメニューに登録されています。');
      return;
    }

    if (sid) {
      const allowed = store?.allowedSuppliers?.map(s => s.toUpperCase());
      const wineSupplier = (wine.supplier || 'PIEROTH').toUpperCase();
      
      if (allowed && !allowed.includes(wineSupplier)) {
        alert(`この店舗には指定サプライヤー「${wineSupplier}」のワインを登録する権限がありません`);
        return;
      }

      try {
        const newInventoryItem = {
          id: compositeId,
          pureId: wine.pureId || wine.id,
          supplier: (wine.supplier || 'PIEROTH').toUpperCase(),
          price_bottle: wine.price_bottle || wine.cost * 3,
          price_glass: wine.price_glass || Math.round((wine.cost * 3 / 6) / 100) * 100,
          cost: wine.cost,
          glasses_per_bottle: 6,
          stock: 0,
          isActive: true,
          visible: true,
          updatedAt: new Date().toISOString()
        };
        
        await setDoc(doc(db, 'stores', sid, 'inventory', compositeId), newInventoryItem);

        const currentWinesList = [...selectedWines];
        const fullyProjectedWine = {
          ...wine,
          ...newInventoryItem,
          id: compositeId,
          pureId: wine.pureId || wine.id
        } as WineMaster;
        const newWinesList = [...currentWinesList, fullyProjectedWine];
        setSelectedWines(newWinesList);
        await syncPublicMenuWithDocs(sid, newWinesList);
        
        setSearchId('');
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, `stores/${sid}/inventory/${compositeId}`);
      }
    }
  };

  const handleBulkAddWines = async () => {
    if (!sid || selectedMasterIds.length === 0) return;
    
    try {
      const winesToAdd = masterWines.filter(w => selectedMasterIds.includes(w.id));
      
      if (store?.allowedSuppliers) {
        const allowed = store.allowedSuppliers.map(s => s.toUpperCase());
        const unauthorized = winesToAdd.filter(w => !allowed.includes((w.supplier || 'PIEROTH').toUpperCase()));
        if (unauthorized.length > 0) {
          const unauthorizedSet = Array.from(new Set(unauthorized.map(w => (w.supplier || 'PIEROTH').toUpperCase())));
          alert(`許可されていないサプライヤーのワインが含まれています: ${unauthorizedSet.join(', ')}`);
          return;
        }
      }

      const CHUNK_SIZE = 450;
      for (let i = 0; i < winesToAdd.length; i += CHUNK_SIZE) {
        const chunk = winesToAdd.slice(i, i + CHUNK_SIZE);
        const batch = writeBatch(db);
        
        chunk.forEach(wine => {
          const compositeId = getWineDocId(wine);
          const newInventoryItem = {
            id: compositeId,
            pureId: wine.pureId || wine.id,
            supplier: (wine.supplier || 'PIEROTH').toUpperCase(),
            price_bottle: wine.price_bottle || wine.cost * 3,
            price_glass: wine.price_glass || Math.round((wine.cost * 3 / 6) / 100) * 100,
            cost: wine.cost,
            glasses_per_bottle: 6,
            stock: 0,
            isActive: true,
            visible: true,
            updatedAt: new Date().toISOString()
          };
          batch.set(doc(db, 'stores', sid, 'inventory', compositeId), newInventoryItem);
        });

        await batch.commit();
      }

      const newWinesToAppend = winesToAdd.map(wine => {
        const compositeId = getWineDocId(wine);
        return {
          ...wine,
          id: compositeId,
          pureId: wine.pureId || wine.id,
          price_bottle: wine.price_bottle || wine.cost * 3,
          price_glass: wine.price_glass || Math.round((wine.cost * 3 / 6) / 100) * 100,
          cost: wine.cost,
          glasses_per_bottle: 6,
          stock: 0,
          isActive: true,
          visible: true,
          updatedAt: new Date().toISOString()
        } as WineMaster;
      });
      const mergedList = [...selectedWines];
      newWinesToAppend.forEach(nw => {
        if (!mergedList.some(sw => sw.pureId === nw.pureId)) {
          mergedList.push(nw);
        }
      });
      setSelectedWines(mergedList);
      await syncPublicMenuWithDocs(sid, mergedList);
      
      setShowCatalogSelection(false);
      setSelectedMasterIds([]);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `stores/${sid}/inventory/bulk`);
    }
  };

  const toggleMasterSelection = (id: string) => {
    setSelectedMasterIds(prev => prev.includes(id) ? prev.filter(mid => mid !== id) : [...prev, id]);
  };

  const handleDeleteWine = async (wineId: string) => {
    if (!sid || !window.confirm('このワインをメニューから削除しますか？')) return;
    const wine = selectedWines.find(w => w.id === wineId);
    if (!wine) return;
    
    const compositeId = getWineDocId(wine);
    try {
      await deleteDoc(doc(db, 'stores', sid, 'inventory', compositeId));
      
      const filteredList = selectedWines.filter(w => getWineDocId(w) !== compositeId);
      setSelectedWines(filteredList);
      await syncPublicMenuWithDocs(sid, filteredList);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `stores/${sid}/inventory/${compositeId}`);
    }
  };

  return (
    <div id="owner-view" className="max-w-4xl lg:max-w-7xl mx-auto px-4 py-8 md:py-12 space-y-8 animate-in fade-in duration-700">
      <header className="flex flex-col md:flex-row md:items-start justify-between gap-6">
        <div className="flex-1">
          {isEditingStore ? (
            <div className="space-y-4 bg-black/40 p-6 rounded-2xl border border-brand-gold/20 animate-in slide-in-from-top duration-300">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-brand-gold/60 uppercase tracking-widest block mb-1">店名</label>
                  <input 
                    className="w-full bg-white/5 border border-brand-gold/20 rounded-lg px-3 py-2 text-brand-ivory text-sm outline-none focus:border-brand-gold"
                    value={editStoreData.name || ''}
                    onChange={e => setEditStoreData({...editStoreData, name: e.target.value})}
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-brand-gold/60 uppercase tracking-widest block mb-1">料理カテゴリー</label>
                  <input 
                    className="w-full bg-white/5 border border-brand-gold/20 rounded-lg px-3 py-2 text-brand-ivory text-sm outline-none focus:border-brand-gold"
                    value={editStoreData.cuisine_type || ''}
                    onChange={e => setEditStoreData({...editStoreData, cuisine_type: e.target.value})}
                  />
                </div>
              </div>
                <div>
                  <label className="text-xs font-bold text-brand-gold/60 uppercase tracking-widest block mb-1">住所</label>
                  <input 
                    className="w-full bg-white/5 border border-brand-gold/20 rounded-lg px-3 py-2 text-brand-ivory text-sm outline-none focus:border-brand-gold"
                    value={editStoreData.address || ''}
                    onChange={e => setEditStoreData({...editStoreData, address: e.target.value})}
                  />
                </div>

                <div className="space-y-4 pt-4 border-t border-brand-gold/20">
                  <div className="flex items-center justify-between p-3 bg-white/5 border border-brand-gold/20 rounded-xl">
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-brand-gold-dark uppercase tracking-wider">ペアリングフィルターを非表示</span>
                      <span className="text-xs text-gray-500 uppercase">「お料理から選ぶ」を隠す</span>
                    </div>
                    <button 
                      onClick={() => setEditStoreData({...editStoreData, hidePairingFilter: !editStoreData.hidePairingFilter})}
                      className={`w-12 h-6 rounded-full transition-all relative ${editStoreData.hidePairingFilter ? 'bg-brand-gold' : 'bg-gray-700'}`}
                    >
                      <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${editStoreData.hidePairingFilter ? 'left-7' : 'left-1'}`} />
                    </button>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-white/5 border border-brand-gold/20 rounded-xl">
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-brand-gold-dark uppercase tracking-wider">マリアージュ詳細を非表示</span>
                      <span className="text-xs text-gray-500 uppercase">「最高のマリアージュ」を隠す</span>
                    </div>
                    <button 
                      onClick={() => setEditStoreData({...editStoreData, hideWinePairing: !editStoreData.hideWinePairing})}
                      className={`w-12 h-6 rounded-full transition-all relative ${editStoreData.hideWinePairing ? 'bg-brand-gold' : 'bg-gray-700'}`}
                    >
                      <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${editStoreData.hideWinePairing ? 'left-7' : 'left-1'}`} />
                    </button>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-brand-gold/60 uppercase tracking-widest block mb-1">予算設定 (カンマ区切り)</label>
                    <input 
                      type="text"
                      placeholder="5000, 10000, 20000"
                      value={editStoreData.budgetTiers?.join(', ') || ''}
                      onChange={e => {
                        const tiers = e.target.value.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n));
                        setEditStoreData({...editStoreData, budgetTiers: tiers});
                      }}
                      className="w-full bg-white/5 border border-brand-gold/20 rounded-lg px-3 py-2 text-brand-ivory text-sm outline-none focus:border-brand-gold transition-all"
                    />
                    <p className="text-xs text-gray-500 mt-1 uppercase tracking-tighter">例: 5000, 10000, 20000 (数値のみ入力してください)</p>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button onClick={() => setIsEditingStore(false)} className="px-4 py-2 text-xs uppercase font-bold text-gray-400 hover:text-white transition-colors">キャンセル</button>
                  <button 
                    onClick={handleUpdateStore} 
                    disabled={isSaving}
                    className="bg-brand-gold text-brand-wine px-6 py-2 rounded-lg text-xs uppercase font-bold tracking-widest flex items-center gap-2 hover:brightness-110"
                  >
                    {isSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                    保存する
                  </button>
                </div>
            </div>
          ) : (
            <div>
              <div className="flex flex-col md:flex-row md:items-center gap-3">
                <div className="flex items-center gap-3">
                  <h1 className="serif text-3xl text-brand-gold-dark">{store?.name || '店舗情報不明'}</h1>
                  <button onClick={() => setIsEditingStore(true)} className="p-2 text-brand-gold-dark/40 hover:text-brand-gold-dark transition-colors">
                    <Edit2 className="w-4 h-4" />
                  </button>
                </div>
                {(user?.role === 'admin' || user?.role === 'rep') && (
                  <select 
                    className="bg-brand-gold-dark/10 border border-brand-gold-dark/30 text-brand-gold-dark rounded-full px-4 py-1 text-xs font-bold uppercase outline-none"
                    value={sid || ''}
                    onChange={(e) => window.location.href = `/owner?storeId=${e.target.value}`}
                  >
                    <option value="" disabled>店舗を切り替え</option>
                    {stores.map(s => (
                      <option key={s.id} value={s.id} className="bg-brand-wine text-brand-gold-dark font-sans">{s.name}</option>
                    ))}
                  </select>
                )}
              </div>
              <p className="text-gray-400 text-xs uppercase tracking-widest font-bold mt-1">
                {store?.cuisine_type} • {store?.address}
              </p>
            </div>
          )}
        </div>
      </header>

      <StoreAnalytics selectedWines={selectedWines} />

      <div className="bg-white/5 rounded-3xl overflow-hidden shadow-luxury-soft">
        <InventoryManager 
          selectedStore={store || undefined}
          selectedStoreId={sid}
          selectedWines={selectedWines}
          setSelectedWines={setSelectedWines}
          masterWines={masterWines}
          searchId={searchId}
          setSearchId={setSearchId}
          handleAddWine={handleAddWine}
          onShowCatalogSelection={() => setShowCatalogSelection(true)}
          onFileUpload={() => { alert('オーナー権限での一括CSVインポートは現在制限されています。') }}
          onSaveInventory={handleSaveInventory}
          onDeleteWine={handleDeleteWine}
          fileInputRef={fileInputRef}
          hasMoreWines={hasMoreWinesMaster}
          onLoadMoreWines={fetchNextWinesMaster}
          onUpdateWineItem={handleUpdateWineItem}
        />
      </div>

      <CatalogSelector 
        isOpen={showCatalogSelection}
        onClose={() => setShowCatalogSelection(false)}
        selectedStore={store || undefined}
        wines={masterWines}
        masterSearchTerm={masterSearchTerm}
        setMasterSearchTerm={setMasterSearchTerm}
        selectedWines={selectedWines}
        selectedMasterIds={selectedMasterIds}
        toggleMasterSelection={toggleMasterSelection}
        handleBulkAddWines={handleBulkAddWines}
        hasMoreWines={hasMoreWinesMaster}
        onLoadMoreWines={fetchNextWinesMaster}
      />
    </div>
  );
};
