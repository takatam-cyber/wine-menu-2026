// src/views/OwnerView.tsx
import React, { useState, useEffect, useRef } from 'react';
import { WineMaster, Store, extractPureId } from '../types';
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
import { StoreAnalytics } from '../components/admin/StoreAnalytics';

const PRODUCTION_DOMAIN = import.meta.env.VITE_APP_DOMAIN || "";

const getBaseUrl = () => {
  if (typeof window === 'undefined') return '';
  const origin = window.location.origin;
  if (origin.includes('googleusercontent.com') || origin.includes('localhost') || origin.includes('cloudshell.dev') || (origin.includes('asia-east1.run.app') && origin.includes('-vfs-'))) {
    return PRODUCTION_DOMAIN;
  }
  return origin;
};

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
            pureId: extractPureId(wine.pureId || wine.id, wine.supplier).toUpperCase(),
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
            pureId: extractPureId(wine.pureId || wine.id, wine.supplier).toUpperCase(),
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

      await updateDoc(doc(db, 'stores', sid), {
        updatedAt: new Date().toISOString()
      });

      fetch(`/api/menu/${sid}/invalidate`, { method: 'POST' }).catch(() => {});

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
    const alreadyExists = selectedWines.some(sw => extractPureId(sw.pureId || sw.id, sw.supplier).toUpperCase() === extractPureId(wine?.pureId || wine?.id, wine?.supplier).toUpperCase());

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
          pureId: extractPureId(wine.pureId || wine.id, wine.supplier).toUpperCase(),
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
          pureId: extractPureId(wine.pureId || wine.id, wine.supplier).toUpperCase()
        } as WineMaster;
        const newWinesList = [...currentWinesList, fullyProjectedWine];
        setSelectedWines(newWinesList);
        setSearchId('');
        
        fetch(`/api/menu/${sid}/invalidate`, { method: 'POST' }).catch(() => {});
        // 削除: queryClient.invalidateQueries({ queryKey: ['inventory', sid] });
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
            pureId: extractPureId(wine.pureId || wine.id, wine.supplier).toUpperCase(),
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
          pureId: extractPureId(wine.pureId || wine.id, wine.supplier).toUpperCase(),
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
      
      fetch(`/api/menu/${sid}/invalidate`, { method: 'POST' }).catch(() => {});
      // 削除: queryClient.invalidateQueries({ queryKey: ['inventory', sid] });
      
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
      fetch(`/api/menu/${sid}/invalidate`, { method: 'POST' }).catch(() => {});
      // 削除: queryClient.invalidateQueries({ queryKey: ['inventory', sid] });
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `stores/${sid}/inventory/${compositeId}`);
    }
  };

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
      </header>

      <StoreAnalytics selectedWines={selectedWines} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
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
        
        <div className="space-y-6">
          <div className="bg-black/40 p-6 rounded-3xl border border-brand-gold/20 shadow-luxury space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <Settings className="text-brand-gold w-5 h-5" />
              <h2 className="text-xs font-bold uppercase tracking-widest text-brand-gold-dark">基本情報・メニュー設定</h2>
            </div>
            
            <div>
              <label className="text-xs font-bold text-brand-gold/60 uppercase tracking-widest block mb-1">店名</label>
              <input 
                type="text"
                value={isEditingStore ? editStoreData.name || '' : store?.name || ''}
                onChange={(e) => isEditingStore && setEditStoreData({...editStoreData, name: e.target.value})}
                disabled={!isEditingStore}
                className="w-full bg-white/5 border border-brand-gold/20 rounded-xl px-4 py-2.5 text-sm text-brand-ivory outline-none focus:border-brand-gold disabled:opacity-70 disabled:bg-black/20 font-sans"
              />
            </div>
            
            <div>
              <label className="text-xs font-bold text-brand-gold/60 uppercase tracking-widest block mb-1">料理カテゴリー</label>
              <input 
                type="text"
                value={isEditingStore ? editStoreData.cuisine_type || '' : store?.cuisine_type || ''}
                onChange={(e) => isEditingStore && setEditStoreData({...editStoreData, cuisine_type: e.target.value})}
                disabled={!isEditingStore}
                className="w-full bg-white/5 border border-brand-gold/20 rounded-xl px-4 py-2.5 text-sm text-brand-ivory outline-none focus:border-brand-gold disabled:opacity-70 disabled:bg-black/20 font-sans"
              />
            </div>
            
            <div>
              <label className="text-xs font-bold text-brand-gold/60 uppercase tracking-widest block mb-1">住所</label>
              <input 
                type="text"
                value={isEditingStore ? editStoreData.address || '' : store?.address || ''}
                onChange={(e) => isEditingStore && setEditStoreData({...editStoreData, address: e.target.value})}
                disabled={!isEditingStore}
                className="w-full bg-white/5 border border-brand-gold/20 rounded-xl px-4 py-2.5 text-sm text-brand-ivory outline-none focus:border-brand-gold disabled:opacity-70 disabled:bg-black/20 font-sans"
              />
            </div>

            <div className="space-y-3 pt-3 border-t border-brand-gold/10">
              <div className="flex items-center justify-between p-2.5 bg-white/5 border border-brand-gold/10 rounded-xl">
                <div className="flex flex-col">
                  <span className="text-[11px] font-bold text-brand-gold-dark uppercase tracking-wider">ペアリングフィルター非表示</span>
                  <span className="text-[9px] text-gray-500 uppercase">「お料理から選ぶ」を隠す</span>
                </div>
                <button 
                  onClick={() => isEditingStore && setEditStoreData({...editStoreData, hidePairingFilter: !editStoreData.hidePairingFilter})}
                  disabled={!isEditingStore}
                  className={`w-10 h-5 rounded-full transition-all relative disabled:opacity-50 ${
                    (isEditingStore ? editStoreData.hidePairingFilter : store?.hidePairingFilter) ? 'bg-brand-gold' : 'bg-gray-700'
                  }`}
                >
                  <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${(isEditingStore ? editStoreData.hidePairingFilter : store?.hidePairingFilter) ? 'left-5.5' : 'left-0.5'}`} />
                </button>
              </div>

              <div className="flex items-center justify-between p-2.5 bg-white/5 border border-brand-gold/10 rounded-xl">
                <div className="flex flex-col">
                  <span className="text-[11px] font-bold text-brand-gold-dark uppercase tracking-wider">マリアージュ詳細非表示</span>
                  <span className="text-[9px] text-gray-500 uppercase">「最高のマリアージュ」を隠す</span>
                </div>
                <button 
                  onClick={() => isEditingStore && setEditStoreData({...editStoreData, hideWinePairing: !editStoreData.hideWinePairing})}
                  disabled={!isEditingStore}
                  className={`w-10 h-5 rounded-full transition-all relative disabled:opacity-50 ${
                    (isEditingStore ? editStoreData.hideWinePairing : store?.hideWinePairing) ? 'bg-brand-gold' : 'bg-gray-700'
                  }`}
                >
                  <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${(isEditingStore ? editStoreData.hideWinePairing : store?.hideWinePairing) ? 'left-5.5' : 'left-0.5'}`} />
                </button>
              </div>

              <div>
                <label className="text-xs font-bold text-brand-gold/60 uppercase tracking-widest block mb-1">予算設定 (カンマ区切り)</label>
                <input 
                  type="text"
                  placeholder="5000, 10000, 20000"
                  value={isEditingStore ? (editStoreData.budgetTiers?.join(', ') || '') : (store?.budgetTiers?.join(', ') || '')}
                  onChange={e => {
                    if (isEditingStore) {
                      const tiers = e.target.value.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n));
                      setEditStoreData({...editStoreData, budgetTiers: tiers});
                    }
                  }}
                  disabled={!isEditingStore}
                  className="w-full bg-white/5 border border-brand-gold/20 rounded-lg px-3 py-2 text-brand-ivory text-sm outline-none focus:border-brand-gold disabled:opacity-70 disabled:bg-black/20 font-sans"
                />
              </div>
            </div>

            <div className="pt-2 flex gap-2">
              {isEditingStore ? (
                <>
                  <button 
                    onClick={() => setIsEditingStore(false)}
                    className="flex-1 py-2 text-xs font-bold uppercase tracking-widest text-gray-400 hover:text-white transition-all"
                  >
                    キャンセル
                  </button>
                  <button 
                    onClick={handleUpdateStore}
                    className="flex-1 py-2 bg-brand-gold text-brand-wine text-xs font-bold uppercase tracking-widest rounded-xl hover:brightness-110 transition-all flex items-center justify-center gap-2 shadow-lg"
                  >
                    <Save className="w-3.5 h-3.5" /> 保存
                  </button>
                </>
              ) : (
                <button 
                  onClick={() => {
                    setEditStoreData(store || {});
                    setIsEditingStore(true);
                  }}
                  className="w-full py-2 bg-white/5 border border-brand-gold/30 text-brand-gold text-xs font-bold uppercase tracking-widest rounded-xl hover:bg-white/10 transition-all flex items-center justify-center gap-2"
                >
                  <Edit2 className="w-3.5 h-3.5" /> 店舗設定を編集
                </button>
              )}
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
                このQRコードを印刷して店内に掲示し、お客様がマイスマホでスキャンできるようにしてください。
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
        hasMoreWines={hasMoreWinesMaster}
        onLoadMoreWines={fetchNextWinesMaster}
      />
    </div>
  );
};
