// src/views/OwnerView.tsx
import React, { useState, useEffect, useRef } from 'react';
import { WineMaster, Store } from '../types';
import { Wine, Save, Loader2, X, Plus, Search, Edit2, AlertCircle, Sparkles, Settings, QrCode, ExternalLink } from 'lucide-react';
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

const PRODUCTION_DOMAIN = import.meta.env.VITE_APP_DOMAIN || "";
const getBaseUrl = () => typeof window === 'undefined' ? '' : (window.location.origin.includes('googleusercontent.com') || window.location.origin.includes('localhost') ? PRODUCTION_DOMAIN : window.location.origin);

const safeExtractPureId = (id: any, supplier?: any) => {
  if (!id) return '';
  const strId = String(id);
  const s = String(supplier || 'PIEROTH').toUpperCase();
  const prefix = `${s}_`;
  if (strId.toUpperCase().startsWith(prefix)) {
    return strId.substring(prefix.length);
  }
  return strId;
};

const getWineDocId = (wine: any) => {
  if (!wine) return `UNKNOWN_${Date.now()}`;
  const pure = safeExtractPureId(wine.pureId || wine.id, wine.supplier).toUpperCase();
  if (!pure) return String(wine.id || `UNKNOWN_${Date.now()}`);
  const supplier = String(wine.supplier || 'PIEROTH').toUpperCase();
  return `${supplier}_${pure}`;
};

export const OwnerView: React.FC = () => {
  const { user, showToast, showConfirm } = useWines();
  const queryClient = useQueryClient();
  const [selectedStoreId, setSelectedStoreId] = useState(new URLSearchParams(window.location.search).get('storeId') || user?.storeId || '');
  
  const { data: storesData } = useStoresQuery(user);
  const stores = (storesData?.pages.flatMap(p => p.data) || []).filter(Boolean);

  const { data: inventoryData, isLoading: inventoryLoading } = useInventoryQuery(selectedStoreId);
  const { updateStoreMutation } = useInventoryMutations(selectedStoreId);
  
  const store = inventoryData?.store || null;
  const inventory = inventoryData?.inventory || [];

  const { data: masterWinesData, fetchNextPage: fetchNextWinesMaster, hasNextPage: hasMoreWinesMaster } = useWinesMasterQuery();
  const masterWines = (masterWinesData?.pages.flatMap(p => p.data) || []).filter(Boolean);
  const [masterSearchTerm, setMasterSearchTerm] = useState('');

  const [selectedWines, setSelectedWines] = useState<WineMaster[]>([]);
  const [initialWines, setInitialWines] = useState<WineMaster[]>([]);
  
  const [dataLoadedForStore, setDataLoadedForStore] = useState<string | null>(null);

  const [searchId, setSearchId] = useState('');
  const [isEditingStore, setIsEditingStore] = useState(false);
  const [editStoreData, setEditStoreData] = useState<Partial<Store>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [showCatalogSelection, setShowCatalogSelection] = useState(false);
  const [selectedMasterIds, setSelectedMasterIds] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (inventoryData?.inventory && selectedStoreId === inventoryData.store?.id) {
      if (dataLoadedForStore !== selectedStoreId) {
        setSelectedWines(JSON.parse(JSON.stringify(inventoryData.inventory)));
        setInitialWines(JSON.parse(JSON.stringify(inventoryData.inventory)));
        setDataLoadedForStore(selectedStoreId);
      }
    } else if (!selectedStoreId) {
      setSelectedWines([]);
      setInitialWines([]);
      setDataLoadedForStore(null);
    }
  }, [selectedStoreId, inventoryData?.inventory, dataLoadedForStore]);

  useEffect(() => {
    if (store) {
      setEditStoreData(store);
    }
  }, [store]);

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

      fetch(`/api/menu/${sid}/invalidate`, { method: 'POST' }).catch(() => {});
      queryClient.invalidateQueries({ queryKey: ['inventory', sid] });
      queryClient.invalidateQueries({ queryKey: ['stores'] });

      setIsEditingStore(false);
      showToast('店舗設定を更新しました。', 'success');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `stores/${sid}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateWineItem = (wineId: string, updatedFields: Partial<WineMaster>, saveImmediately = false) => {
    if (!sid) return;
    
    const nextWines = selectedWines.map(w => w.id === wineId ? { ...w, ...updatedFields } : w);
    setSelectedWines(nextWines);

    if (saveImmediately) {
      const wine = nextWines.find(w => w.id === wineId);
      if (!wine) return;
      const compositeId = getWineDocId(wine);
      
      (async () => {
        try {
          await setDoc(doc(db, 'stores', sid, 'inventory', compositeId), { ...wine, id: compositeId }, { merge: true });
          const richPublicMenu = nextWines
            .filter(w => w.visible !== false && w.isActive !== false)
            .map(w => ({ ...w, id: getWineDocId(w) }));
          
          await updateDoc(doc(db, 'stores', sid), { publicMenu: richPublicMenu, updatedAt: new Date().toISOString() });
          
          queryClient.invalidateQueries({ queryKey: ['publicMenu', sid] });
          setInitialWines(JSON.parse(JSON.stringify(nextWines)));
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
      let totalWriteCount = 0;
      const CHUNK_SIZE = 450;
      
      for (let i = 0; i < selectedWines.length; i += CHUNK_SIZE) {
        const chunk = selectedWines.slice(i, i + CHUNK_SIZE);
        const batch = writeBatch(db);
        let chunkWriteCount = 0;
        
        chunk.forEach(wine => {
          const initialWine = initialWines.find(iw => iw.id === wine.id);
          const isChanged = !initialWine || 
            initialWine.price_bottle !== wine.price_bottle || 
            initialWine.price_glass !== wine.price_glass || 
            initialWine.cost !== wine.cost || 
            initialWine.stock !== wine.stock || 
            initialWine.visible !== wine.visible || 
            initialWine.isFeatured !== wine.isFeatured || 
            initialWine.promoLabel !== wine.promoLabel ||
            initialWine.glasses_per_bottle !== wine.glasses_per_bottle;

          if (isChanged) {
            const compositeId = getWineDocId(wine);
            const docRef = doc(db, 'stores', sid, 'inventory', compositeId);
            batch.set(docRef, { ...wine, id: compositeId }, { merge: true });
            chunkWriteCount++;
            totalWriteCount++;
          }
        });
        
        if (chunkWriteCount > 0) await batch.commit();
      }

      const richPublicMenu = selectedWines
        .filter(w => w.visible !== false && w.isActive !== false)
        .map(w => ({ ...w, id: getWineDocId(w) }));

      await updateDoc(doc(db, 'stores', sid), {
        publicMenu: richPublicMenu,
        updatedAt: new Date().toISOString()
      });

      fetch(`/api/menu/${sid}/invalidate`, { method: 'POST' }).catch(() => {});
      queryClient.invalidateQueries({ queryKey: ['publicMenu', sid] });
      queryClient.invalidateQueries({ queryKey: ['inventory', sid] });
      
      setInitialWines(JSON.parse(JSON.stringify(selectedWines)));
      showToast(`セラー情報を保存しました（更新: ${totalWriteCount}件）`, 'success');
    } catch (error) {
      console.error('一括保存に失敗しました:', error);
      showToast('一括保存に失敗しました。', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddWine = async (wineId?: string) => {
    const idToUse = wineId || searchId;
    let wine = masterWines.find(w => w.id === idToUse);
    if (!wine) return showToast('該当するワインコードが見つかりません。', 'error');

    const compositeId = getWineDocId(wine);
    if (selectedWines.some(sw => getWineDocId(sw) === compositeId)) return showToast('このワインは既にメニューに登録されています。', 'info');

    if (sid) {
      try {
        const newInventoryItem = {
          ...wine,
          id: compositeId,
          pureId: safeExtractPureId(wine.pureId || wine.id, wine.supplier).toUpperCase(),
          supplier: String(wine.supplier || 'PIEROTH').toUpperCase(),
          price_bottle: wine.price_bottle || wine.cost * 3,
          price_glass: wine.price_glass || Math.round((wine.cost * 3 / 6) / 100) * 100,
          glasses_per_bottle: 6,
          stock: 0,
          isActive: true,
          visible: true,
          updatedAt: new Date().toISOString()
        };
        
        await setDoc(doc(db, 'stores', sid, 'inventory', compositeId), newInventoryItem);
        const newWinesList = [...selectedWines, newInventoryItem as WineMaster];
        
        setSelectedWines(newWinesList);
        setInitialWines(JSON.parse(JSON.stringify(newWinesList)));
        setSearchId('');
        
        const richPublicMenu = newWinesList
          .filter(w => w.visible !== false && w.isActive !== false)
          .map(w => ({ ...w, id: getWineDocId(w) }));

        await updateDoc(doc(db, 'stores', sid), { publicMenu: richPublicMenu, updatedAt: new Date().toISOString() });
        fetch(`/api/menu/${sid}/invalidate`, { method: 'POST' }).catch(() => {});
        queryClient.invalidateQueries({ queryKey: ['publicMenu', sid] });
        showToast('ワインをセラーに追加しました。', 'success');
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, `stores/${sid}/inventory/${compositeId}`);
      }
    }
  };

  const handleBulkAddWines = async () => {
    if (!sid || selectedMasterIds.length === 0) return;
    try {
      const winesToAdd = masterWines.filter(w => selectedMasterIds.includes(w.id));
      const CHUNK_SIZE = 450;
      
      for (let i = 0; i < winesToAdd.length; i += CHUNK_SIZE) {
        const chunk = winesToAdd.slice(i, i + CHUNK_SIZE);
        const batch = writeBatch(db);
        chunk.forEach(wine => {
          const compositeId = getWineDocId(wine);
          const newInventoryItem = {
            ...wine,
            id: compositeId,
            pureId: safeExtractPureId(wine.pureId || wine.id, wine.supplier).toUpperCase(),
            supplier: String(wine.supplier || 'PIEROTH').toUpperCase(),
            price_bottle: wine.price_bottle || wine.cost * 3,
            price_glass: wine.price_glass || Math.round((wine.cost * 3 / 6) / 100) * 100,
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

      const newWinesToAppend = winesToAdd.map(wine => ({
        ...wine,
        id: getWineDocId(wine),
        pureId: safeExtractPureId(wine.pureId || wine.id, wine.supplier).toUpperCase(),
        price_bottle: wine.price_bottle || wine.cost * 3,
        price_glass: wine.price_glass || Math.round((wine.cost * 3 / 6) / 100) * 100,
        glasses_per_bottle: 6,
        stock: 0,
        isActive: true,
        visible: true,
        updatedAt: new Date().toISOString()
      } as WineMaster));
      
      const mergedList = [...selectedWines];
      newWinesToAppend.forEach(nw => { if (!mergedList.some(sw => sw.id === nw.id)) mergedList.push(nw); });
      
      setSelectedWines(mergedList);
      setInitialWines(JSON.parse(JSON.stringify(mergedList)));
      
      const richPublicMenu = mergedList
        .filter(w => w.visible !== false && w.isActive !== false)
        .map(w => ({ ...w, id: getWineDocId(w) }));

      await updateDoc(doc(db, 'stores', sid), { publicMenu: richPublicMenu, updatedAt: new Date().toISOString() });
      
      fetch(`/api/menu/${sid}/invalidate`, { method: 'POST' }).catch(() => {});
      queryClient.invalidateQueries({ queryKey: ['publicMenu', sid] });

      setShowCatalogSelection(false);
      setSelectedMasterIds([]);
      showToast(`${winesToAdd.length}件のワインを一括導入しました。`, 'success');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `stores/${sid}/bulk`);
    }
  };

  const toggleMasterSelection = (id: string) => {
    setSelectedMasterIds(prev => prev.includes(id) ? prev.filter(mid => mid !== id) : [...prev, id]);
  };

  const handleDeleteWine = async (wineId: string) => {
    if (!sid) return;
    showConfirm(
      'このワインをメニューから削除しますか？',
      async () => {
        try {
          await deleteDoc(doc(db, 'stores', sid, 'inventory', wineId));
          const filteredList = selectedWines.filter(w => w.id !== wineId);
          
          setSelectedWines(filteredList);
          setInitialWines(JSON.parse(JSON.stringify(filteredList)));
          
          const richPublicMenu = filteredList
            .filter(w => w.visible !== false && w.isActive !== false)
            .map(w => ({ ...w, id: getWineDocId(w) }));

          await updateDoc(doc(db, 'stores', sid), { publicMenu: richPublicMenu, updatedAt: new Date().toISOString() });
          fetch(`/api/menu/${sid}/invalidate`, { method: 'POST' }).catch(() => {});
          queryClient.invalidateQueries({ queryKey: ['publicMenu', sid] });
          showToast('ワインを削除しました。', 'success');
        } catch (error) {
          handleFirestoreError(error, OperationType.DELETE, `stores/${sid}/inventory/${wineId}`);
        }
      },
      '削除すると、お客様用デジタルメニューからも即座に非表示になります。'
    );
  };

  const renderMasterEditModal = () => (
    <AnimatePresence>
      {isEditingStore && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md">
            <h3 className="text-lg font-bold mb-4">店舗詳細を編集</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">店名</label>
                <input 
                  type="text"
                  value={editStoreData.name || ''}
                  onChange={e => setEditStoreData({ ...editStoreData, name: e.target.value })}
                  className="w-full border rounded-xl p-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">料理カテゴリー</label>
                <input 
                  type="text"
                  value={editStoreData.cuisine_type || ''}
                  onChange={e => setEditStoreData({ ...editStoreData, cuisine_type: e.target.value })}
                  className="w-full border rounded-xl p-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">住所</label>
                <input 
                  type="text"
                  value={editStoreData.address || ''}
                  onChange={e => setEditStoreData({ ...editStoreData, address: e.target.value })}
                  className="w-full border rounded-xl p-2 text-sm"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => setIsEditingStore(false)} className="px-4 py-2 text-sm text-slate-500">キャンセル</button>
              <button onClick={handleUpdateStore} className="px-4 py-2 bg-brand-wine text-white rounded-xl text-sm font-bold">更新</button>
            </div>
          </div>
        </div>
      )}
    </AnimatePresence>
  );

  if (inventoryLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-24 gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-brand-gold-dark" />
        <p className="text-brand-gold-dark/60 text-xs font-bold uppercase tracking-widest">セラーを読み込み中...</p>
      </div>
    );
  }

  return (
    <div id="owner-view" className="max-w-4xl lg:max-w-7xl mx-auto px-4 py-8 md:py-12 space-y-8 animate-in fade-in duration-700">
      <header className="flex flex-col md:flex-row md:items-start justify-between gap-6">
        <div className="flex-1">
          <div className="flex flex-col md:flex-row md:items-center gap-3">
            <h1 className="serif text-3xl text-brand-gold-dark">{store?.name || '店舗情報不明'}</h1>
            {(user?.role === 'admin' || user?.role === 'rep') && (
              <select 
                className="bg-brand-gold-dark/10 border border-brand-gold-dark/30 text-brand-gold-dark rounded-full px-4 py-1 text-xs font-bold uppercase tracking-widest outline-none"
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
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <InventoryManager 
            selectedStore={store || undefined}
            selectedStoreId={sid as string}
            selectedWines={selectedWines}
            setSelectedWines={setSelectedWines}
            masterWines={masterWines}
            searchId={searchId}
            setSearchId={setSearchId}
            handleAddWine={handleAddWine}
            onShowCatalogSelection={() => setShowCatalogSelection(true)}
            onFileUpload={() => { showToast('オーナー権限での一括CSVインポートは現在制限されています。', 'info') }}
            onSaveInventory={handleSaveInventory}
            onDeleteWine={handleDeleteWine}
            fileInputRef={fileInputRef}
            hasMoreWines={!!hasMoreWinesMaster}
            onLoadMoreWines={fetchNextWinesMaster}
            onUpdateWineItem={handleUpdateWineItem}
            isOwner={true}
          />
        </div>
        
        <div className="space-y-6">
          <div className="bg-black/40 p-6 rounded-3xl border border-brand-gold/20 shadow-luxury space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <Settings className="text-brand-gold w-5 h-5" />
              <h2 className="text-xs font-bold uppercase tracking-widest text-brand-gold-dark">基本情報・メニュー設定</h2>
            </div>
            
            <div>
              <label className="text-xs font-bold text-brand-gold/60 uppercase tracking-widest block mb-1">店名</label>
              <div className="w-full bg-white/5 border border-brand-gold/20 rounded-xl px-4 py-2.5 text-sm text-brand-ivory font-sans opacity-70 bg-black/20">
                {store?.name || ''}
              </div>
            </div>
            
            <div>
              <label className="text-xs font-bold text-brand-gold/60 uppercase tracking-widest block mb-1">料理カテゴリー</label>
              <div className="w-full bg-white/5 border border-brand-gold/20 rounded-xl px-4 py-2.5 text-sm text-brand-ivory font-sans opacity-70 bg-black/20">
                {store?.cuisine_type || ''}
              </div>
            </div>
            
            <div>
              <label className="text-xs font-bold text-brand-gold/60 uppercase tracking-widest block mb-1">住所</label>
              <div className="w-full bg-white/5 border border-brand-gold/20 rounded-xl px-4 py-2.5 text-sm text-brand-ivory font-sans opacity-70 bg-black/20">
                {store?.address || ''}
              </div>
            </div>

            <div className="space-y-3 pt-3 border-t border-brand-gold/10">
              <div className="flex items-center justify-between p-2.5 bg-white/5 border border-brand-gold/10 rounded-xl">
                <div className="flex flex-col">
                  <span className="text-[11px] font-bold text-brand-gold-dark uppercase tracking-wider">ペアリングフィルター非表示</span>
                  <span className="text-[9px] text-gray-500 uppercase">「お料理から選ぶ」を隠す</span>
                </div>
                <button 
                  onClick={() => handleUpdateStore()}
                  className={`w-10 h-5 rounded-full transition-all relative ${
                    store?.hidePairingFilter ? 'bg-brand-gold' : 'bg-gray-700'
                  }`}
                >
                  <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${store?.hidePairingFilter ? 'left-5.5' : 'left-0.5'}`} />
                </button>
              </div>

              <div className="flex items-center justify-between p-2.5 bg-white/5 border border-brand-gold/10 rounded-xl">
                <div className="flex flex-col">
                  <span className="text-[11px] font-bold text-brand-gold-dark uppercase tracking-wider">マリアージュ詳細非表示</span>
                  <span className="text-[9px] text-gray-500 uppercase">「最高のマリアージュ」を隠す</span>
                </div>
                <button 
                  onClick={() => handleUpdateStore()}
                  className={`w-10 h-5 rounded-full transition-all relative ${
                    store?.hideWinePairing ? 'bg-brand-gold' : 'bg-gray-700'
                  }`}
                >
                  <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${store?.hideWinePairing ? 'left-5.5' : 'left-0.5'}`} />
                </button>
              </div>

              <div>
                <label className="text-xs font-bold text-brand-gold/60 uppercase tracking-widest block mb-1">予算設定</label>
                <div className="w-full bg-white/5 border border-brand-gold/20 rounded-lg px-3 py-2 text-brand-ivory text-sm font-sans opacity-70 bg-black/20">
                  {Array.isArray(store?.budgetTiers) ? store!.budgetTiers.join(', ') : ''}
                </div>
              </div>
            </div>

            <div className="pt-2 flex gap-2">
              <button 
                onClick={() => {
                  setEditStoreData(store || {});
                  setIsEditingStore(true);
                }}
                className="w-full py-2 bg-white/5 border border-brand-gold/30 text-brand-gold text-xs font-bold uppercase tracking-widest rounded-xl hover:bg-white/10 transition-all flex items-center justify-center gap-2"
              >
                <Edit2 className="w-3.5 h-3.5" /> 店舗設定を編集
              </button>
            </div>
          </div>

          <div className="bg-black/40 p-6 rounded-3xl border border-brand-gold/20 shadow-luxury space-y-4">
            <div className="flex items-center gap-2 border-b border-brand-gold/10 pb-3">
              <QrCode className="text-brand-gold w-5 h-5" />
              <h2 className="text-xs font-bold uppercase tracking-widest text-brand-gold-dark">QRコード & お客様メニュー</h2>
            </div>
            
            <div className="flex flex-col items-center gap-4 py-2">
              <div className="p-4 bg-white rounded-2xl flex items-center justify-center shadow-inner">
                <img 
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(`${getBaseUrl() || window.location.origin}/menu/${sid}`)}`} 
                  alt="Store QR Code" 
                  className="w-36 h-36 object-contain"
                />
              </div>
              
              <p className="text-[11px] text-gray-400 text-center leading-relaxed">
                このQRコードを印刷して店内に掲示し、お客様がマイススマホでスキャンできるようにしてください。
              </p>

              <div className="w-full flex flex-col gap-2">
                <button 
                  onClick={() => window.open(`${getBaseUrl() || window.location.origin}/menu/${sid}`, '_blank')}
                  className="w-full py-3 bg-brand-gold text-brand-wine text-xs font-bold uppercase tracking-widest rounded-xl hover:brightness-110 transition-all flex items-center justify-center gap-2 shadow-md"
                >
                  <ExternalLink className="w-4 h-4" /> お客用メニューを開く
                </button>
                
                <div className="text-center">
                  <span className="text-[9px] font-mono select-all break-all text-brand-gold/50 text-center block max-w-full overflow-hidden truncate">
                    {`${getBaseUrl() || window.location.origin}/menu/${sid}`}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
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
        hasMoreWines={!!hasMoreWinesMaster}
        onLoadMoreWines={fetchNextWinesMaster}
      />
      {renderMasterEditModal()}
    </div>
  );
};
