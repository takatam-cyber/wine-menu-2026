import React, { useState, useRef, useEffect, useMemo } from 'react';
import { WineMaster, Store } from '../types';
import { useWines } from '../lib/WineContext';
import { wineRepository } from '../lib/repositories/wineRepository';
import { useStoresQuery } from '../hooks/useStoresQuery';
import { useWinesMasterQuery, useWinesSearchQuery } from '../hooks/useWinesQuery';
import { db } from '../lib/firebase';
import { doc, setDoc, collection, getDocs, getDoc, updateDoc, deleteDoc, query, where } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';
import { initializeApp, deleteApp, getApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import { Plus, Database, Upload, Eye, Save, Settings, Edit2, Shield, Wine, Trash2, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useQueryClient } from '@tanstack/react-query';

// New Components and Utils
import { parseWineCSV } from '../lib/csv-parser';
import { StoreGrid } from '../components/admin/StoreGrid';
import { InventoryManager } from '../components/admin/InventoryManager';
import { MasterCatalog } from '../components/admin/MasterCatalog';
import { StoreAnalytics } from '../components/admin/StoreAnalytics';
import { OwnerAccountForm } from '../components/admin/OwnerAccountForm';
import { CatalogSelector } from '../components/admin/CatalogSelector';

const PRODUCTION_DOMAIN = import.meta.env.VITE_APP_DOMAIN || "https://ais-pre-3hdh5bfu2wsxmjvi2wumqd-509939825672.asia-east1.run.app";

const getBaseUrl = () => {
  if (typeof window === 'undefined') return '';
  const origin = window.location.origin;
  if (origin.includes('googleusercontent.com') || origin.includes('localhost') || origin.includes('cloudshell.dev') || (origin.includes('asia-east1.run.app') && origin.includes('-vfs-'))) {
    return PRODUCTION_DOMAIN;
  }
  return origin;
};

export const AdminView: React.FC = () => {
  const { user } = useWines();
  const queryClient = useQueryClient();
  
  // React Query Hooks
  const { 
    data: storesData, 
    fetchNextPage: fetchNextStores, 
    hasNextPage: hasMoreStores,
    refetch: refetchStores
  } = useStoresQuery(user);
  
  const { 
    data: winesMasterData, 
    fetchNextPage: fetchNextWinesMaster, 
    hasNextPage: hasMoreWinesMaster,
    refetch: refetchWinesMaster
  } = useWinesMasterQuery();

  const [masterSearchTerm, setMasterSearchTerm] = useState('');
  const { data: searchResults } = useWinesSearchQuery(masterSearchTerm);

  // Flattened Data
  const stores = useMemo(() => storesData?.pages.flatMap(page => page.data) || [], [storesData]);
  const wines = useMemo(() => {
    if (masterSearchTerm && searchResults) return searchResults;
    return winesMasterData?.pages.flatMap(page => page.data) || [];
  }, [winesMasterData, masterSearchTerm, searchResults]);

  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);
  const [searchId, setSearchId] = useState('');
  const [selectedWines, setSelectedWines] = useState<WineMaster[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [importStatus, setImportStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  const [showOwnerForm, setShowOwnerForm] = useState(false);
  const [isEditingOwner, setIsEditingOwner] = useState(false);
  const [showMasterCatalog, setShowMasterCatalog] = useState(false);
  const [ownerEmail, setOwnerEmail] = useState('');
  const [ownerPassword, setOwnerPassword] = useState('');
  const [isCreatingOwner, setIsCreatingOwner] = useState(false);
  const [isEditingStore, setIsEditingStore] = useState(false);
  const [isEditingMaster, setIsEditingMaster] = useState(false);
  const [editingMasterWine, setEditingMasterWine] = useState<WineMaster | null>(null);
  const [editMasterData, setEditMasterData] = useState<Partial<WineMaster>>({});
  const [editStoreData, setEditStoreData] = useState<Partial<Store>>({});
  const [showCatalogSelection, setShowCatalogSelection] = useState(false);
  const [selectedMasterIds, setSelectedMasterIds] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const storeId = params.get('storeId');
    if (storeId) {
      setSelectedStoreId(storeId);
    }
  }, []);

  const handleSearchMaster = (term: string) => {
    setMasterSearchTerm(term);
  };

  const startEditingMaster = (wine: WineMaster) => {
    setEditingMasterWine(wine);
    setEditMasterData({
      name_jp: wine.name_jp,
      ai_explanation: wine.ai_explanation,
      price_bottle: wine.price_bottle,
      grape: wine.grape
    });
    setIsEditingMaster(true);
  };

  const handleUpdateMaster = async () => {
    if (!editingMasterWine) return;
    try {
      await updateDoc(doc(db, 'winesMaster', editingMasterWine.id), editMasterData);
      setImportStatus({ type: 'success', message: 'マスターデータを更新しました' });
      setIsEditingMaster(false);
      queryClient.invalidateQueries({ queryKey: ['winesMaster'] });
      if (masterSearchTerm) queryClient.invalidateQueries({ queryKey: ['winesMasterSearch', masterSearchTerm] });
    } catch (error: any) {
      handleFirestoreError(error, OperationType.UPDATE, `winesMaster/${editingMasterWine.id}`);
    }
  };

  const handleLoadMoreStores = () => {
    fetchNextStores();
  };

  const handleLoadMoreWines = () => {
    fetchNextWinesMaster();
  };

  const selectedStore = stores.find(s => s.id === selectedStoreId);

  const fetchStoreInventory = async (storeId: string) => {
    const path = `stores/${storeId}/inventory`;
    try {
      const querySnapshot = await getDocs(collection(db, 'stores', storeId, 'inventory'));
      const items = querySnapshot.docs.map(d => ({ id: d.id, ...d.data() as any }));
      
      const enrichedWines: WineMaster[] = [];
      const itemIds = items.map(item => item.id);

      for (let i = 0; i < itemIds.length; i += 30) {
        const chunk = itemIds.slice(i, i + 30);
        const q = query(collection(db, 'winesMaster'), where('__name__', 'in', chunk));
        const masterSnaps = await getDocs(q);
        
        masterSnaps.forEach(docSnap => {
          const masterData = docSnap.data() as WineMaster;
          const invItem = items.find(item => item.id === docSnap.id);
          if (invItem) {
            enrichedWines.push({ 
              ...masterData, 
              id: docSnap.id,
              price_bottle: invItem.price_bottle ?? masterData.price_bottle,
              price_glass: invItem.price_glass ?? masterData.price_glass,
              cost: invItem.cost ?? masterData.cost,
              glasses_per_bottle: invItem.glasses_per_bottle ?? 6,
              visible: invItem.visible ?? masterData.visible ?? true,
              isFeatured: invItem.isFeatured ?? masterData.isFeatured ?? false,
              promoLabel: invItem.promoLabel || masterData.promoLabel || ''
            });
          }
        });
      }
      
      setSelectedWines(enrichedWines);
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, path);
    }
  };

  useEffect(() => {
    if (selectedStoreId) {
      fetchStoreInventory(selectedStoreId);
    }
  }, [selectedStoreId]);

  const handleAddWine = async (wineId?: string) => {
    const idToUse = wineId || searchId;
    let wine = wines.find(w => w.id === idToUse);
    
    if (!wine) {
      try {
        wine = await wineRepository.getWineById(idToUse) || undefined;
      } catch (e) {
        console.error("Master wine fetch error:", e);
      }
    }

    if (wine && selectedStoreId && !selectedWines.find(sw => sw.id === idToUse)) {
      const docPath = `stores/${selectedStoreId}/inventory/${wine.id}`;
      try {
        const newInventoryItem = {
          id: wine.id,
          price_bottle: wine.price_bottle || wine.cost * 3,
          price_glass: wine.price_glass || Math.round((wine.cost * 3 / 6) / 100) * 100,
          cost: wine.cost,
          glasses_per_bottle: 6,
          stock: 0,
          isActive: true,
          visible: true,
          updatedAt: new Date().toISOString()
        };
        
        await setDoc(doc(db, 'stores', selectedStoreId, 'inventory', wine.id), newInventoryItem);
        await fetchStoreInventory(selectedStoreId);
        setSearchId('');
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, docPath);
      }
    }
  };

  const handleBulkAddWines = async () => {
    if (!selectedStoreId || selectedMasterIds.length === 0) return;
    
    try {
      const winesToAdd = wines.filter(w => selectedMasterIds.includes(w.id));
      const savePromises = winesToAdd.map(wine => {
        const newInventoryItem = {
          id: wine.id,
          price_bottle: wine.price_bottle || wine.cost * 3,
          price_glass: wine.price_glass || Math.round((wine.cost * 3 / 6) / 100) * 100,
          cost: wine.cost,
          glasses_per_bottle: 6,
          stock: 0,
          isActive: true,
          visible: true,
          updatedAt: new Date().toISOString()
        };
        return setDoc(doc(db, 'stores', selectedStoreId, 'inventory', wine.id), newInventoryItem);
      });

      await Promise.all(savePromises);
      await fetchStoreInventory(selectedStoreId);
      
      setImportStatus({ type: 'success', message: `${selectedMasterIds.length}件のワインを追加しました` });
      setShowCatalogSelection(false);
      setSelectedMasterIds([]);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `stores/${selectedStoreId}/inventory/bulk`);
    }
  };

  const toggleMasterSelection = (id: string) => {
    setSelectedMasterIds(prev => 
      prev.includes(id) ? prev.filter(mid => mid !== id) : [...prev, id]
    );
  };

  const handleCreateStore = async () => {
    const newStoreId = `store-${Math.random().toString(36).substr(2, 9)}`;
    const path = `stores/${newStoreId}`;
    try {
      const newStore: Store = {
        id: newStoreId,
        name: `新規店舗 ${stores.length + 1}`,
        repId: user?.uid || '',
        cuisine_type: 'フレンチ',
        isActive: true,
        hasAiSommelier: true,
        address: '〒106-0032 東京都港区六本木...'
      };
      
      await setDoc(doc(db, 'stores', newStoreId), newStore);
      queryClient.invalidateQueries({ queryKey: ['stores'] });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  };

  const handleCreateOwner = async () => {
    if (!selectedStoreId || !ownerEmail) return;
    if (!isEditingOwner && (!ownerPassword || ownerPassword.length < 6)) {
      setImportStatus({ type: 'error', message: '新規作成時は6文字以上のパスワードが必要です' });
      return;
    }

    setIsCreatingOwner(true);
    const emailToUse = ownerEmail.includes('@') ? ownerEmail : `${ownerEmail}@wine-menu.app`;

    try {
      if (isEditingOwner && selectedStore?.ownerId) {
        await updateDoc(doc(db, 'users', selectedStore.ownerId), {
          email: emailToUse,
          name: selectedStore?.name || 'Store Owner'
        });
        await updateDoc(doc(db, 'stores', selectedStoreId), {
          owner_email: emailToUse
        });
        setImportStatus({ type: 'success', message: 'オーナー情報を更新しました' });
      } else {
        const secondaryAppName = `secondary-auth-${Date.now()}`;
        let secondaryApp;
        try {
          secondaryApp = getApp(secondaryAppName);
        } catch (e) {
          secondaryApp = initializeApp(firebaseConfig, secondaryAppName);
        }
        const secondaryAuth = getAuth(secondaryApp);
        const userCredential = await createUserWithEmailAndPassword(secondaryAuth, emailToUse, ownerPassword);
        const ownerUid = userCredential.user.uid;

        const userProfile = {
          uid: ownerUid,
          email: emailToUse,
          name: selectedStore?.name || 'Store Owner',
          role: 'owner',
          storeId: selectedStoreId
        };
        await setDoc(doc(db, 'users', ownerUid), userProfile);
        await updateDoc(doc(db, 'stores', selectedStoreId), {
          ownerId: ownerUid,
          owner_email: emailToUse,
          hasAiSommelier: true
        });
        await signOut(secondaryAuth);
        await deleteApp(secondaryApp);
        setImportStatus({ type: 'success', message: 'オーナーアカウントを新規作成しました' });
      }

      setShowOwnerForm(false);
      setIsEditingOwner(false);
      setOwnerEmail('');
      setOwnerPassword('');
      queryClient.invalidateQueries({ queryKey: ['stores'] });
    } catch (error: any) {
      console.error('Error handling owner:', error);
      let message = error.message;
      if (error.code === 'auth/operation-not-allowed') {
        message = 'Firebase Consoleで「メール/パスワード認証」を有効にしてください。';
      } else if (error.code === 'auth/email-already-in-use') {
        message = 'このメールアドレスは既に登録されています。';
      }
      setImportStatus({ type: 'error', message: `操作失敗: ${message}` });
    } finally {
      setIsCreatingOwner(false);
    }
  };

  const toggleOwnerEditMode = () => {
    if (selectedStore?.ownerId) {
      setOwnerEmail(selectedStore.owner_email || '');
      setIsEditingOwner(true);
    } else {
      setIsEditingOwner(false);
    }
    setShowOwnerForm(!showOwnerForm);
  };

  const handleUpdateStore = async () => {
    if (!selectedStoreId) return;
    try {
      await updateDoc(doc(db, 'stores', selectedStoreId), editStoreData);
      setImportStatus({ type: 'success', message: '店舗情報を更新しました' });
      setIsEditingStore(false);
      queryClient.invalidateQueries({ queryKey: ['stores'] });
    } catch (error: any) {
      handleFirestoreError(error, OperationType.UPDATE, `stores/${selectedStoreId}`);
    }
  };

  const handleDeleteStore = async (storeId: string) => {
    try {
      await deleteDoc(doc(db, 'stores', storeId));
      setImportStatus({ type: 'success', message: '店舗を削除しました' });
      if (selectedStoreId === storeId) {
        setSelectedStoreId(null);
      }
      queryClient.invalidateQueries({ queryKey: ['stores'] });
    } catch (error: any) {
      handleFirestoreError(error, OperationType.DELETE, `stores/${storeId}`);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    setImportStatus(null);

    try {
      const importedWines = await parseWineCSV(file);
      
      const CHUNK_SIZE = 50;
      for (let i = 0; i < importedWines.length; i += CHUNK_SIZE) {
        const chunk = importedWines.slice(i, i + CHUNK_SIZE);
        const saveMasterPromises = chunk.map(wine => {
          return setDoc(doc(db, 'winesMaster', wine.id), wine);
        });
        await Promise.all(saveMasterPromises);
      }

      queryClient.invalidateQueries({ queryKey: ['winesMaster'] });

      if (selectedStoreId) {
        for (let i = 0; i < importedWines.length; i += CHUNK_SIZE) {
          const chunk = importedWines.slice(i, i + CHUNK_SIZE);
          const saveInvPromises = chunk.map(wine => {
            const invItem = {
              id: wine.id,
              price_bottle: wine.price_bottle || Math.round(wine.cost * 3 / 100) * 100,
              price_glass: wine.price_glass || 0,
              glasses_per_bottle: 6,
              stock: wine.stock || 0,
              isActive: true,
              visible: true,
              updatedAt: new Date().toISOString()
            };
            return setDoc(doc(db, 'stores', selectedStoreId, 'inventory', wine.id), invItem);
          });
          await Promise.all(saveInvPromises);
        }
        await fetchStoreInventory(selectedStoreId);
      }

      setImportStatus({ 
        type: 'success', 
        message: `${importedWines.length}件の銘柄データをインポートしました` 
      });
    } catch (error: any) {
      console.error('Import error:', error);
      setImportStatus({ type: 'error', message: `インポート失敗: ${error.message}` });
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSaveInventory = async () => {
    if (!selectedStoreId) return;
    try {
      const savePromises = selectedWines.map(wine => {
        const docRef = doc(db, 'stores', selectedStoreId, 'inventory', wine.id);
        const inventoryItem = {
          id: wine.id,
          price_bottle: wine.price_bottle,
          price_glass: wine.price_glass,
          cost: wine.cost,
          glasses_per_bottle: wine.glasses_per_bottle || 6,
          visible: wine.visible ?? true,
          isFeatured: wine.isFeatured ?? false,
          promoLabel: wine.promoLabel || '',
          stock: 0,
          isActive: true,
          updatedAt: new Date().toISOString()
        };
        return setDoc(docRef, inventoryItem);
      });
      await Promise.all(savePromises);
      setImportStatus({ type: 'success', message: '全ての在庫・価格データを保存しました' });
      setSelectedStoreId(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `stores/${selectedStoreId}/inventory`);
    }
  };

  const handleDeleteWine = async (wineId: string) => {
    if (!selectedStoreId || !window.confirm('このワインをメニューから削除しますか？')) return;
    try {
      await deleteDoc(doc(db, 'stores', selectedStoreId, 'inventory', wineId));
      setSelectedWines(prev => prev.filter(w => w.id !== wineId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `stores/${selectedStoreId}/inventory/${wineId}`);
    }
  };

  if (!selectedStoreId) {
    return (
      <div id="admin-view" className="min-h-screen bg-[#FDFCFB] text-slate-900 pb-20 animate-in fade-in duration-700">
        <header className="bg-white border-b border-slate-200 px-4 md:px-8 py-6 md:py-10 mb-6 md:mb-8 z-20 shadow-sm">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <div className="flex items-center justify-center md:justify-start gap-4 mb-1 md:mb-2 text-center md:text-left">
                <h1 className="serif text-2xl md:text-4xl text-slate-900">
                  {showMasterCatalog ? 'マスターカタログ' : '営業統括ダッシュボード'}
                </h1>
                <button 
                  onClick={() => setShowMasterCatalog(!showMasterCatalog)}
                  className={`px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest border transition-all flex items-center gap-2 ${showMasterCatalog ? 'bg-brand-wine text-white border-brand-wine' : 'bg-white text-slate-600 border-slate-200 hover:border-brand-wine hover:text-brand-wine'}`}
                >
                  <Database className="w-3.5 h-3.5" />
                  {showMasterCatalog ? 'ダッシュボードへ' : 'マスターを表示'}
                </button>
              </div>
              <p className="text-slate-400 text-[9px] md:text-[10px] uppercase tracking-[0.4em] font-bold text-center md:text-left">Sales Representative: {user?.name} • Total Stores: {stores.length}</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 md:gap-4 px-4 md:px-0">
              <button
                 onClick={handleCreateStore}
                 className="flex items-center justify-center gap-2 px-6 md:px-8 py-3 bg-brand-wine text-white rounded-full text-[10px] md:text-[11px] font-bold uppercase tracking-widest hover:scale-105 transition-all shadow-md active:scale-95 w-full sm:w-auto"
              >
                <Plus className="w-5 h-5" />
                新規店舗を開拓
              </button>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                accept=".csv"
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center justify-center gap-2 px-6 md:px-8 py-3 bg-white border-2 border-slate-200 rounded-full text-[10px] md:text-[11px] text-slate-600 font-bold uppercase tracking-widest hover:border-brand-wine hover:text-brand-wine transition-all shadow-sm w-full sm:w-auto"
              >
                <Upload className="w-5 h-5" />
                マスター更新
              </button>
            </div>
          </div>
        </header>

        <div className="max-w-7xl mx-auto px-4 md:px-8">
          {showMasterCatalog ? (
            <MasterCatalog 
              wines={wines}
              masterSearchTerm={masterSearchTerm}
              onSearchMaster={handleSearchMaster}
              isEditingMaster={isEditingMaster}
              editingMasterWine={editingMasterWine}
              editMasterData={editMasterData}
              setEditMasterData={setEditMasterData}
              onStartEditingMaster={startEditingMaster}
              onUpdateMaster={handleUpdateMaster}
              onCancelEditMaster={() => setIsEditingMaster(false)}
            />
          ) : (
            <StoreGrid 
              stores={stores}
              hasMoreStores={hasMoreStores}
              onLoadMoreStores={handleLoadMoreStores}
              onCreateStore={handleCreateStore}
              onDeleteStore={handleDeleteStore}
              onSelectStore={setSelectedStoreId}
            />
          )}
        </div>
      </div>
    );
  }

  return (
    <div id="admin-view" className="min-h-screen bg-[#FDFCFB] text-slate-900 pb-20 animate-in fade-in duration-700">
      <header className="bg-white border-b border-slate-200 px-4 md:px-8 py-6 md:py-8 mb-6 md:mb-8 sticky top-0 z-20 shadow-sm">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex flex-col gap-1">
            <button 
              onClick={() => setSelectedStoreId(null)}
              className="text-[9px] md:text-[10px] font-bold text-slate-400 uppercase tracking-widest hover:text-brand-wine transition-colors flex items-center gap-1 mb-1 md:mb-2"
            >
              ← ダッシュボードに戻る
            </button>
            {isEditingStore ? (
              <div className="space-y-4 bg-slate-50 p-4 md:p-6 rounded-2xl border border-slate-200 w-full max-w-md animate-in slide-in-from-left duration-300">
                <div>
                  <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block mb-1">店名</label>
                  <input 
                    type="text"
                    value={editStoreData.name}
                    onChange={e => setEditStoreData({...editStoreData, name: e.target.value})}
                    className="w-full bg-white border border-slate-300 rounded px-3 py-2 text-sm text-slate-900 focus:border-brand-wine outline-none transition-all"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block mb-1">ジャンル</label>
                    <select 
                      value={editStoreData.cuisine_type}
                      onChange={e => setEditStoreData({...editStoreData, cuisine_type: e.target.value})}
                      className="w-full bg-white border border-slate-300 rounded px-3 py-2 text-sm text-slate-900 focus:border-brand-wine outline-none"
                    >
                      <option value="フレンチ">フレンチ</option>
                      <option value="イタリアン">イタリアン</option>
                      <option value="和食">和食</option>
                      <option value="中華">中華</option>
                      <option value="ステーキハウス">ステーキハウス</option>
                      <option value="バー/ラウンジ">バー/ラウンジ</option>
                      <option value="ナイトクラブ/ラウンジ">ナイトクラブ/ラウンジ</option>
                      <option value="ブライダル/ウェディング">ブライダル/ウェディング</option>
                      <option value="ホテル/バンケット">ホテル/バンケット</option>
                      <option value="ビストロ/カフェ">ビストロ/カフェ</option>
                      <option value="バル/居酒屋">バル/居酒屋</option>
                      <option value="その他">その他</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block mb-1">ステータス</label>
                    <button 
                      onClick={() => setEditStoreData({...editStoreData, isActive: !editStoreData.isActive})}
                      className={`w-full py-2 rounded text-[10px] font-bold uppercase tracking-widest border transition-all ${editStoreData.isActive ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}
                    >
                      {editStoreData.isActive ? '● 公開中' : '○ 停止中'}
                    </button>
                  </div>
                </div>

                {/* New Customization Settings */}
                <div className="space-y-4 pt-4 border-t border-slate-200">
                  <div className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-xl">
                    <div className="flex flex-col">
                      <span className="text-[10px] font-bold text-slate-700 uppercase tracking-wider">ペアリングフィルターを非表示</span>
                      <span className="text-[8px] text-slate-400 uppercase">「お料理から選ぶ」を隠す</span>
                    </div>
                    <button 
                      onClick={() => setEditStoreData({...editStoreData, hidePairingFilter: !editStoreData.hidePairingFilter})}
                      className={`w-12 h-6 rounded-full transition-all relative ${editStoreData.hidePairingFilter ? 'bg-brand-wine' : 'bg-slate-200'}`}
                    >
                      <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${editStoreData.hidePairingFilter ? 'left-7' : 'left-1'}`} />
                    </button>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-xl">
                    <div className="flex flex-col">
                      <span className="text-[10px] font-bold text-slate-700 uppercase tracking-wider">マリアージュ詳細を非表示</span>
                      <span className="text-[8px] text-slate-400 uppercase">「最高のマリアージュ」を隠す</span>
                    </div>
                    <button 
                      onClick={() => setEditStoreData({...editStoreData, hideWinePairing: !editStoreData.hideWinePairing})}
                      className={`w-12 h-6 rounded-full transition-all relative ${editStoreData.hideWinePairing ? 'bg-brand-wine' : 'bg-slate-200'}`}
                    >
                      <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${editStoreData.hideWinePairing ? 'left-7' : 'left-1'}`} />
                    </button>
                  </div>

                  <div>
                    <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block mb-1">予算設定 (カンマ区切り)</label>
                    <input 
                      type="text"
                      placeholder="5000, 10000, 20000"
                      value={editStoreData.budgetTiers?.join(', ') || ''}
                      onChange={e => {
                        const tiers = e.target.value.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n));
                        setEditStoreData({...editStoreData, budgetTiers: tiers});
                      }}
                      className="w-full bg-white border border-slate-300 rounded px-3 py-2 text-sm text-slate-900 focus:border-brand-wine outline-none transition-all"
                    />
                    <p className="text-[8px] text-slate-400 mt-1 uppercase tracking-tighter">例: 5000, 10000, 20000 (数値のみ入力してください)</p>
                  </div>
                </div>
                <div className="flex flex-col items-center justify-center bg-white p-6 rounded-2xl border border-slate-200 shadow-inner">
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4">モバイル用QRコード</div>
                  <div className="p-3 bg-white border border-slate-100 rounded-xl shadow-lg mb-4">
                    <img 
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(getBaseUrl() + '/menu/' + selectedStoreId)}`}
                      alt="Store QR Code"
                      referrerPolicy="no-referrer"
                      className="w-48 h-48"
                    />
                  </div>
                  <div className="flex flex-col gap-2 w-full">
                    <button 
                      onClick={() => window.location.href = `/owner?storeId=${selectedStoreId}`}
                      className="w-full py-3 bg-brand-wine text-white rounded-xl text-[10px] font-bold uppercase tracking-widest hover:brightness-125 flex items-center justify-center gap-2 shadow-luxury border border-brand-gold/30"
                    >
                      <Settings className="w-3.5 h-3.5" />
                      店舗オーナーとして管理
                    </button>
                    <button 
                      onClick={() => window.open(`${getBaseUrl()}/menu/${selectedStoreId}`, '_blank')}
                      className="w-full py-3 bg-brand-gold text-brand-wine rounded-xl text-[10px] font-bold uppercase tracking-widest hover:brightness-110 flex items-center justify-center gap-2 shadow-sm"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      お客様メニューを表示
                    </button>
                    <button 
                      onClick={() => {
                        const url = getBaseUrl() + '/menu/' + selectedStoreId;
                        navigator.clipboard.writeText(url);
                        alert('URLをコピーしました');
                      }}
                      className="w-full py-2 bg-slate-100 text-slate-600 rounded-lg text-[9px] font-bold uppercase tracking-widest hover:bg-slate-200 transition-all border border-slate-200"
                    >
                      URLをコピー
                    </button>
                    <div className="h-px bg-slate-200 my-2" />
                    <button 
                      onClick={() => handleDeleteStore(selectedStoreId!)}
                      className="w-full py-3 bg-white text-red-500 border border-red-200 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-red-50 transition-all flex items-center justify-center gap-2"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      この店舗を削除する
                    </button>
                  </div>
                </div>
                <div>
                  <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block mb-1">住所</label>
                  <input 
                    type="text"
                    value={editStoreData.address}
                    onChange={e => setEditStoreData({...editStoreData, address: e.target.value})}
                    className="w-full bg-white border border-slate-300 rounded px-3 py-2 text-sm text-slate-900 focus:border-brand-wine outline-none"
                  />
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={handleUpdateStore}
                    className="flex-1 py-2 bg-brand-wine text-white text-[10px] font-bold uppercase tracking-widest rounded flex items-center justify-center gap-2 hover:bg-opacity-90 transition-all font-bold"
                  >
                    <Save className="w-4 h-4" /> 保存
                  </button>
                  <button 
                    onClick={() => setIsEditingStore(false)}
                    className="px-4 py-2 bg-slate-200 text-slate-700 text-[10px] font-bold uppercase tracking-widest rounded hover:bg-slate-300 transition-all"
                  >
                    キャンセル
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3">
                  <h1 className="serif text-2xl md:text-3xl text-slate-900">{selectedStore?.name}</h1>
                  <button 
                    onClick={() => {
                      setEditStoreData({
                        name: selectedStore?.name,
                        cuisine_type: selectedStore?.cuisine_type || 'フレンチ',
                        address: selectedStore?.address,
                        isActive: selectedStore?.isActive,
                      });
                      setIsEditingStore(true);
                    }}
                    className="p-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-500 hover:text-slate-900 transition-all border border-slate-200"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-slate-500 text-[10px] md:text-xs uppercase tracking-[0.3em] font-bold flex items-center gap-2 mt-1 md:mt-0">
                  Menu Strategy • {selectedStore?.cuisine_type} 
                  <span className={`w-2.5 h-2.5 rounded-full ${selectedStore?.isActive ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.3)]' : 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.3)]'}`}></span>
                </p>
                <p className="text-slate-400 text-[10px] md:text-xs mt-1 font-medium italic truncate max-w-xs">{selectedStore?.address}</p>
              </>
            )}
          </div>
          <div className="flex flex-wrap gap-2 md:gap-4">
            <button
              onClick={() => {
                if (selectedStore?.ownerId) {
                  setOwnerEmail(selectedStore.owner_email || '');
                  setIsEditingOwner(true);
                  setShowOwnerForm(true);
                } else {
                  setIsEditingOwner(false);
                  setShowOwnerForm(true);
                }
              }}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 md:px-5 py-2 md:py-2.5 bg-white border border-slate-200 text-slate-700 rounded-full text-[10px] md:text-xs font-bold uppercase tracking-widest hover:border-brand-wine hover:text-brand-wine transition-all shadow-sm"
            >
              <Shield className="w-4 h-4 text-brand-gold shrink-0" />
              <span className="truncate">{selectedStore?.ownerId ? 'オーナー編集' : 'オーナー作成'}</span>
            </button>
            <button
              onClick={() => window.open(`/menu/${selectedStoreId}`, '_blank')}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 md:px-5 py-2 md:py-2.5 bg-brand-wine text-white rounded-full text-[10px] md:text-xs font-bold uppercase tracking-widest hover:scale-105 transition-all shadow-md"
            >
              <Wine className="w-4 h-4 shrink-0" />
              <span className="truncate">お客様メニュー</span>
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 md:px-8 space-y-8 md:space-y-12">
        <CatalogSelector 
          isOpen={showCatalogSelection}
          onClose={() => setShowCatalogSelection(false)}
          selectedStore={selectedStore}
          wines={wines}
          masterSearchTerm={masterSearchTerm}
          setMasterSearchTerm={setMasterSearchTerm}
          selectedWines={selectedWines}
          selectedMasterIds={selectedMasterIds}
          toggleMasterSelection={toggleMasterSelection}
          handleBulkAddWines={handleBulkAddWines}
          hasMoreWines={hasMoreWinesMaster}
          onLoadMoreWines={handleLoadMoreWines}
        />

        {importStatus && (
          <div className={`p-4 rounded-xl flex items-center gap-3 animate-in slide-in-from-top duration-500 z-50 ${
            importStatus.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
          }`}>
            <span className="text-xs font-bold uppercase tracking-widest">{importStatus.message}</span>
            <button onClick={() => setImportStatus(null)} className="ml-auto text-[10px] font-bold opacity-60 hover:opacity-100"><X className="w-4 h-4" /></button>
          </div>
        )}

        {/* Analytics Section */}
        <StoreAnalytics selectedWines={selectedWines} />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-12">
          <div className="lg:col-span-8">
            <InventoryManager 
              selectedStore={selectedStore}
              selectedStoreId={selectedStoreId!}
              selectedWines={selectedWines}
              setSelectedWines={setSelectedWines}
              masterWines={wines}
              searchId={searchId}
              setSearchId={setSearchId}
              handleAddWine={handleAddWine}
              onShowCatalogSelection={() => setShowCatalogSelection(true)}
              onFileUpload={handleFileUpload}
              onSaveInventory={handleSaveInventory}
              onDeleteWine={handleDeleteWine}
              fileInputRef={fileInputRef}
              hasMoreWines={hasMoreWinesMaster}
              onLoadMoreWines={handleLoadMoreWines}
            />
          </div>

          <div className="lg:col-span-4">
            <OwnerAccountForm 
              selectedStore={selectedStore}
              ownerEmail={ownerEmail}
              setOwnerEmail={setOwnerEmail}
              ownerPassword={ownerPassword}
              setOwnerPassword={setOwnerPassword}
              isCreatingOwner={isCreatingOwner}
              isEditingOwner={isEditingOwner}
              onHandleCreateOwner={handleCreateOwner}
              showOwnerForm={showOwnerForm}
              setShowOwnerForm={setShowOwnerForm}
              onToggleEditMode={toggleOwnerEditMode}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
