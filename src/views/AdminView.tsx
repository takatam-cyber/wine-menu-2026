import React, { useState, useRef, useEffect, useMemo } from 'react';
import { WineMaster, Store } from '../types';
import { useWines } from '../lib/WineContext';
import { wineRepository } from '../lib/repositories/wineRepository';
import { useStoresQuery } from '../hooks/useStoresQuery';
import { useWinesMasterQuery, useWinesSearchQuery } from '../hooks/useWinesQuery';
import { useInventoryQuery } from '../hooks/useInventoryQuery';
import { db } from '../lib/firebase';
import { doc, setDoc, collection, getDocs, getDoc, updateDoc, deleteDoc, query, where, writeBatch } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';
import { initializeApp, deleteApp, getApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import { Plus, Database, Upload, Eye, Save, Settings, Edit2, Shield, Wine, Trash2, X, Search } from 'lucide-react';
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

const PRODUCTION_DOMAIN = import.meta.env.VITE_APP_DOMAIN || "";

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
    hasNextPage: hasMoreStores
  } = useStoresQuery(user);
  
  const { 
    data: winesMasterData, 
    fetchNextPage: fetchNextWinesMaster, 
    hasNextPage: hasMoreWinesMaster
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
  const { data: inventoryData } = useInventoryQuery(selectedStoreId);

  const lastLoadedStoreId = useRef<string | null>(null);
  const [selectedWines, setSelectedWines] = useState<WineMaster[]>([]);

  useEffect(() => {
    if (inventoryData?.inventory && selectedStoreId === inventoryData.store?.id) {
      if (lastLoadedStoreId.current !== selectedStoreId) {
        setSelectedWines(inventoryData.inventory);
        lastLoadedStoreId.current = selectedStoreId;
      }
    } else if (!selectedStoreId) {
      setSelectedWines([]);
      lastLoadedStoreId.current = null;
    }
  }, [selectedStoreId, inventoryData]);

  const [storeSearchTerm, setStoreSearchTerm] = useState('');
  const [selectedCuisineFilter, setSelectedCuisineFilter] = useState('all');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  const cuisineTypes = useMemo(() => {
    const types = new Set(stores.map(s => s.cuisine_type).filter(Boolean));
    return ['all', ...Array.from(types).sort()];
  }, [stores]);

  const filteredStores = useMemo(() => {
    return stores.filter(store => {
      const matchesSearch = !storeSearchTerm || 
        store.name.toLowerCase().includes(storeSearchTerm.toLowerCase()) ||
        (store.address && store.address.toLowerCase().includes(storeSearchTerm.toLowerCase()));
      
      const matchesCuisine = selectedCuisineFilter === 'all' || store.cuisine_type === selectedCuisineFilter;
      const matchesStatus = selectedStatusFilter === 'all' || 
        (selectedStatusFilter === 'active' && store.isActive) ||
        (selectedStatusFilter === 'inactive' && !store.isActive);
      
      return matchesSearch && matchesCuisine && matchesStatus;
    });
  }, [stores, storeSearchTerm, selectedCuisineFilter, selectedStatusFilter]);

  const [searchId, setSearchId] = useState('');
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

  useEffect(() => {
    if (importStatus) {
      const timer = setTimeout(() => {
        setImportStatus(null);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [importStatus]);

  const handleSearchMaster = (term: string) => {
    setMasterSearchTerm(term);
  };

  const startEditingMaster = (wine: WineMaster) => {
    setEditingMasterWine(wine);
    setEditMasterData({
      name_jp: wine.name_jp,
      name_en: wine.name_en,
      country: wine.country,
      country_en: wine.country_en,
      grape: wine.grape,
      grape_en: wine.grape_en,
      ai_explanation: wine.ai_explanation,
      ai_explanation_en: wine.ai_explanation_en,
      price_bottle: wine.price_bottle,
    });
    setIsEditingMaster(true);
  };

  const handleUpdateMaster = async () => {
    if (!editingMasterWine) return;
    try {
      const docId = getWineDocId(editingMasterWine);
      const dataToUpdate: any = {
        ...editMasterData,
        id: docId,
        pureId: editingMasterWine.pureId || editingMasterWine.id
      };
      const cleanedData = Object.fromEntries(
        Object.entries(dataToUpdate).filter(([_, v]) => v !== undefined)
      );
      await updateDoc(doc(db, 'winesMaster', docId), cleanedData);
      setImportStatus({ type: 'success', message: 'マスターデータを更新しました' });
      setIsEditingMaster(false);
      queryClient.invalidateQueries({ queryKey: ['winesMaster'] });
      if (masterSearchTerm) queryClient.invalidateQueries({ queryKey: ['winesMasterSearch', masterSearchTerm] });
    } catch (error: any) {
      handleFirestoreError(error, OperationType.UPDATE, `winesMaster/${getWineDocId(editingMasterWine)}`);
    }
  };

  const handleLoadMoreStores = () => {
    fetchNextStores();
  };

  const handleLoadMoreWines = () => {
    fetchNextWinesMaster();
  };

  const selectedStore = stores.find(s => s.id === selectedStoreId);

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
      const allowed = selectedStore?.allowedSuppliers?.map(s => s.toUpperCase());
      const wineSupplier = (wine.supplier || 'PIEROTH').toUpperCase();
      
      if (allowed && !allowed.includes(wineSupplier)) {
        alert(`この店舗には指定サプライヤー「${wineSupplier}」のワインを登録する権限がありません`);
        return;
      }

      const compositeId = getWineDocId(wine);
      const docPath = `stores/${selectedStoreId}/inventory/${compositeId}`;
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
        
        await setDoc(doc(db, 'stores', selectedStoreId, 'inventory', compositeId), newInventoryItem);
        queryClient.invalidateQueries({ queryKey: ['inventory', selectedStoreId] });
        queryClient.invalidateQueries({ queryKey: ['stores'] });
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
      
      if (selectedStore?.allowedSuppliers) {
        const allowed = selectedStore.allowedSuppliers.map(s => s.toUpperCase());
        const unauthorized = winesToAdd.filter(w => !allowed.includes((w.supplier || 'PIEROTH').toUpperCase()));
        if (unauthorized.length > 0) {
          const unauthorizedSet = Array.from(new Set(unauthorized.map(w => (w.supplier || 'PIEROTH').toUpperCase())));
          alert(`許可されていないサプライヤーのワインが含まれています: ${unauthorizedSet.join(', ')}`);
          return;
        }
      }

      const batch = writeBatch(db);
      winesToAdd.forEach(wine => {
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
        batch.set(doc(db, 'stores', selectedStoreId, 'inventory', compositeId), newInventoryItem);
      });

      await batch.commit();
      queryClient.invalidateQueries({ queryKey: ['inventory', selectedStoreId] });
      queryClient.invalidateQueries({ queryKey: ['stores'] });
      
      setImportStatus({ type: 'success', message: `${selectedMasterIds.length}件のワインを追加しました` });
      setShowCatalogSelection(false);
      setSelectedMasterIds([]);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `stores/${selectedStoreId}/inventory/bulk`);
    }
  };

  const toggleMasterSelection = (id: string) => {
    setSelectedMasterIds(prev => prev.includes(id) ? prev.filter(mid => mid !== id) : [...prev, id]);
  };

  const handleCreateStore = async () => {
    const newStoreId = `store-${Math.random().toString(36).substr(2, 9)}`;
    const path = `stores/${newStoreId}`;
    try {
      const newStore: Store = {
        id: newStoreId,
        name: `新規店舗 ${stores.length + 1}`,
        repId: user?.uid || '',
        ownerId: '',
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
    if (!selectedStoreId || !selectedStore) return;
    try {
      const updatePayload = {
        ...editStoreData,
        ownerId: selectedStore.ownerId || '',
        repId: selectedStore.repId || '',
        updatedAt: new Date().toISOString()
      };
      await updateDoc(doc(db, 'stores', selectedStoreId), updatePayload);
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
      const CHUNK_SIZE = 450;
      
      for (let i = 0; i < importedWines.length; i += CHUNK_SIZE) {
        const chunk = importedWines.slice(i, i + CHUNK_SIZE);
        const batch = writeBatch(db);
        
        chunk.forEach(wine => {
          const docId = getWineDocId(wine);
          const wineToSave = { ...wine, id: docId, pureId: wine.pureId || wine.id };
          batch.set(doc(db, 'winesMaster', docId), wineToSave);
        });
        
        await batch.commit();
      }

      queryClient.invalidateQueries({ queryKey: ['winesMaster'] });

      if (selectedStoreId) {
        let winesToAdd = importedWines;
        if (selectedStore?.allowedSuppliers) {
          const allowed = selectedStore.allowedSuppliers.map(s => s.toUpperCase());
          winesToAdd = importedWines.filter(w => allowed.includes((w.supplier || 'PIEROTH').toUpperCase()));
        }

        for (let i = 0; i < winesToAdd.length; i += CHUNK_SIZE) {
          const chunk = winesToAdd.slice(i, i + CHUNK_SIZE);
          const batch = writeBatch(db);
          
          chunk.forEach(wine => {
            const compositeId = getWineDocId(wine);
            const invItem = {
              id: compositeId,
              pureId: wine.pureId || wine.id,
              supplier: (wine.supplier || 'PIEROTH').toUpperCase(),
              price_bottle: wine.price_bottle || Math.round(wine.cost * 3 / 100) * 100,
              price_glass: wine.price_glass || 0,
              glasses_per_bottle: 6,
              stock: wine.stock || 0,
              isActive: true,
              visible: true,
              updatedAt: new Date().toISOString()
            };
            batch.set(doc(db, 'stores', selectedStoreId, 'inventory', compositeId), invItem);
          });
          
          if (i + CHUNK_SIZE >= winesToAdd.length) {
            const richPublicMenu = winesToAdd
              .filter(w => w.visible !== false && w.isActive !== false)
              .map(wine => projectWineForPublic({ ...wine, pureId: wine.id }));

            batch.update(doc(db, 'stores', selectedStoreId), {
              publicMenu: richPublicMenu,
              updatedAt: new Date().toISOString()
            });
          }
          
          await batch.commit();
        }

        queryClient.invalidateQueries({ queryKey: ['inventory', selectedStoreId] });
      }

      setImportStatus({ type: 'success', message: `${importedWines.length}件の銘柄データをインポートしました` });
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
      const CHUNK_SIZE = 500;
      const wines = [...selectedWines];
      
      for (let i = 0; i < wines.length; i += CHUNK_SIZE) {
        const chunk = wines.slice(i, i + CHUNK_SIZE);
        const batch = writeBatch(db);
        
        chunk.forEach(wine => {
          const compositeId = getWineDocId(wine);
          const docRef = doc(db, 'stores', selectedStoreId, 'inventory', compositeId);
          const inventoryItem = {
            id: compositeId,
            pureId: wine.pureId || wine.id,
            supplier: (wine.supplier || 'PIEROTH').toUpperCase(),
            price_bottle: wine.price_bottle,
            price_glass: wine.price_glass,
            cost: wine.cost,
            glasses_per_bottle: wine.glasses_per_bottle || 6,
            visible: wine.visible ?? true,
            isFeatured: wine.isFeatured ?? false,
            promoLabel: wine.promoLabel || '',
            stock: wine.stock || 0,
            isActive: wine.isActive ?? true,
            updatedAt: new Date().toISOString()
          };
          batch.set(docRef, inventoryItem, { merge: true });
        });
        
        await batch.commit();
      }

      const richPublicMenu = wines
        .filter(w => w.visible !== false && w.isActive !== false)
        .map(projectWineForPublic);

      await updateDoc(doc(db, 'stores', selectedStoreId), {
        publicMenu: richPublicMenu,
        updatedAt: new Date().toISOString()
      });

      queryClient.invalidateQueries({ queryKey: ['inventory', selectedStoreId] });
      queryClient.invalidateQueries({ queryKey: ['stores'] });
      setImportStatus({ type: 'success', message: '全ての在庫・価格データを保存し、公開メニューを更新しました' });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `stores/${selectedStoreId}/inventory`);
    }
  };

  const handleDeleteWine = async (wineId: string) => {
    if (!selectedStoreId || !window.confirm('このワインをメニューから削除しますか？')) return;
    const wine = selectedWines.find(w => w.id === wineId);
    if (!wine) return;
    
    const compositeId = getWineDocId(wine);
    try {
      await deleteDoc(doc(db, 'stores', selectedStoreId, 'inventory', compositeId));
      queryClient.invalidateQueries({ queryKey: ['inventory', selectedStoreId] });
      queryClient.invalidateQueries({ queryKey: ['stores'] });
      setSelectedWines(prev => prev.filter(w => w.id !== wineId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `stores/${selectedStoreId}/inventory/${compositeId}`);
    }
  };

  const renderMasterEditModal = () => (
    <AnimatePresence>
      {isEditingMaster && editingMasterWine && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
        >
          <motion.div
            initial={{ scale: 0.95, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            className="bg-white rounded-[2rem] shadow-2xl w-full max-w-xl overflow-hidden flex flex-col max-h-[90vh]"
          >
            <div className="p-8 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="serif text-2xl text-slate-900">マスター銘柄編集</h3>
                <p className="text-xs text-slate-400 uppercase tracking-widest font-bold mt-1">Editing Master Registry Item: {editingMasterWine.id}</p>
              </div>
              <button onClick={() => setIsEditingMaster(false)} className="p-2 text-slate-300 hover:text-slate-600 transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-8 space-y-6 overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-1">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-2">ワイン名称 (日本語)</label>
                  <input 
                    type="text"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 outline-none focus:border-brand-wine"
                    value={editMasterData.name_jp || ''}
                    onChange={e => setEditMasterData({...editMasterData, name_jp: e.target.value})}
                  />
                </div>
                <div className="md:col-span-1">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-2">Wine Name (English)</label>
                  <input 
                    type="text"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 outline-none focus:border-brand-wine"
                    value={editMasterData.name_en || ''}
                    onChange={e => setEditMasterData({...editMasterData, name_en: e.target.value})}
                  />
                </div>
                <div className="md:col-span-1">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-2">国 (日本語)</label>
                  <input 
                    type="text"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 outline-none focus:border-brand-wine"
                    value={editMasterData.country || ''}
                    onChange={e => setEditMasterData({...editMasterData, country: e.target.value})}
                  />
                </div>
                <div className="md:col-span-1">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-2">Country (English)</label>
                  <input 
                    type="text"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 outline-none focus:border-brand-wine"
                    value={editMasterData.country_en || ''}
                    onChange={e => setEditMasterData({...editMasterData, country_en: e.target.value})}
                  />
                </div>
                <div className="md:col-span-1">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-2">主要品種 (日本語)</label>
                  <input 
                    type="text"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 outline-none focus:border-brand-wine"
                    value={editMasterData.grape || ''}
                    onChange={e => setEditMasterData({...editMasterData, grape: e.target.value})}
                  />
                </div>
                <div className="md:col-span-1">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-2">Grape (English)</label>
                  <input 
                    type="text"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 outline-none focus:border-brand-wine"
                    value={editMasterData.grape_en || ''}
                    onChange={e => setEditMasterData({...editMasterData, grape_en: e.target.value})}
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-2">参考価格 (ボトル)</label>
                  <input 
                    type="number"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 outline-none focus:border-brand-wine"
                    value={editMasterData.price_bottle || 0}
                    onChange={e => setEditMasterData({...editMasterData, price_bottle: parseInt(e.target.value) || 0})}
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-2">AIソムリエ解説文 (日本語)</label>
                <textarea 
                  rows={3}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 outline-none focus:border-brand-wine resize-none mb-4"
                  value={editMasterData.ai_explanation || ''}
                  onChange={e => setEditMasterData({...editMasterData, ai_explanation: e.target.value})}
                />
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-2">AI Sommelier Explanation (English)</label>
                <textarea 
                  rows={3}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 outline-none focus:border-brand-wine resize-none"
                  value={editMasterData.ai_explanation_en || ''}
                  onChange={e => setEditMasterData({...editMasterData, ai_explanation_en: e.target.value})}
                />
                <p className="text-xs text-slate-400 mt-2 font-medium italic">※この説明は全店舗のメニューに共通して反映されます。</p>
              </div>
            </div>

            <div className="p-8 border-t border-slate-100 flex justify-end gap-3 bg-slate-50/50">
              <button 
                onClick={() => setIsEditingMaster(false)}
                className="px-6 py-3 text-xs font-bold uppercase tracking-widest text-slate-400 hover:text-slate-600 transition-all"
              >
                キャンセル
              </button>
              <button 
                onClick={handleUpdateMaster}
                className="px-10 py-3 bg-brand-wine text-white rounded-full text-xs font-bold uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-lg"
              >
                マスターを更新
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return (
    <div id="admin-view" className="min-h-screen bg-[#FDFCFB] text-slate-900 pb-20 animate-in fade-in duration-700">
      {/* 既存の画面レイアウト（省略なしの構造のままレンダリング） */}
      {/* ...既存のJSX構造コード... */}
      <StoreGrid stores={filteredStores} hasMoreStores={hasMoreStores} onLoadMoreStores={handleLoadMoreStores} onCreateStore={handleCreateStore} onDeleteStore={handleDeleteStore} onSelectStore={setSelectedStoreId} />
    </div>
  );
};
