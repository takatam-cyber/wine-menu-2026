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
  const { data: inventoryData } = useInventoryQuery(selectedStoreId);

  const lastLoadedStoreId = useRef<string | null>(null);

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

  // 追記：トースト通知がでたら4秒後に自動消滅させるタイマー
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

  const getWineDocId = (wine: { id: string; supplier?: string; pureId?: string }) => {
    const pure = wine.pureId || wine.id;
    const supplier = (wine.supplier || 'PIEROTH').toUpperCase();
    const supplierPrefix = `${supplier}_`;
    if (pure.startsWith(supplierPrefix)) return pure;
    return `${supplierPrefix}${pure}`;
  };

  const projectWineForPublic = (w: any) => ({
    // 必須識別・テキスト
    id: getWineDocId(w),
    pureId: w.pureId || w.id,
    supplier: (w.supplier || 'PIEROTH').toUpperCase(),
    name_jp: w.name_jp,
    name_en: w.name_en,
    // CRITICAL: Exclude heavy texts for public snapshot to stay under 1MB Firestore limit
    menu_short: '',
    menu_short_en: '',
    ai_explanation: '',
    ai_explanation_en: '',
    
    // 分類・メタデータ
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
    
    // 味わいマトリックス（レーダーチャート・コンシェルジュ用）
    sweetness: w.sweetness || 1,
    body: w.body || 3,
    acidity: w.acidity || 3,
    tannins: w.tannins || 3,
    aroma_intensity: w.aroma_intensity || 3,
    complexity: w.complexity || 3,
    finish: w.finish || 3,
    oak: w.oak || 1,
    // CRITICAL: Exclude heavy detailed text for public snapshot
    aroma_features: '',
    aroma_features_en: '',
    
    // タグ・ペアリング（クイックフィルタ用）
    tags: w.tags || '',
    tags_en: w.tags_en || '',
    pairing: w.pairing || '',
    pairing_en: w.pairing_en || '',
    
    // 店舗固有設定・メディア
    price_bottle: w.price_bottle,
    price_glass: w.price_glass,
    image_url: w.image_url,
    isFeatured: w.isFeatured ?? false,
    promoLabel: w.promoLabel || '',
    isActive: true,
    updatedAt: new Date().toISOString()
  });

  const handleUpdateMaster = async () => {
    if (!editingMasterWine) return;
    try {
      const docId = getWineDocId(editingMasterWine);
      const dataToUpdate: any = {
        ...editMasterData,
        id: docId, // Maintain composite ID consistency
        pureId: editingMasterWine.pureId || editingMasterWine.id
      };
      // Clean undefined properties to prevent Firestore update silent crashes/errors
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
      // Governance Check: allowedSuppliers (Case-insensitive)
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
          id: compositeId, // Composite ID as identifier
          pureId: wine.pureId || wine.id, // Pure ID for reference
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
      
      // Governance Check: allowedSuppliers
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
        ownerId: '', // Explicitly initialize empty ownerId for rules consistency
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
      // 既存のメタデータ（ownerId, repId）を確実に保持しながら更新
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
      
      const CHUNK_SIZE = 450; // Safety margin for batch operations
      
      // 1. Update Master Catalog
      for (let i = 0; i < importedWines.length; i += CHUNK_SIZE) {
        const chunk = importedWines.slice(i, i + CHUNK_SIZE);
        const batch = writeBatch(db);
        
        chunk.forEach(wine => {
          const docId = getWineDocId(wine);
          const wineToSave = { 
            ...wine, 
            id: docId, 
            pureId: wine.pureId || wine.id 
          };
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

        // 2. Update Inventory and Sync Public Menu
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
          
          // SYNC publicMenu snapshot in the FINAL batch operation to ensure atomicity and efficiency
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
      // Use chunking to handle batches > 500 items while maintaining atomicity for inventory items
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

      // 2. DENORMALIZATION: Save the entire rich menu to the store document's top level
      // Trigger updateDoc strictly after the master write batches have committed successfully
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

  // ───【最重要】マスターカタログの編集モーダルを、関数の末尾で一元ハンドリングする ───
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
                  className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest border transition-all flex items-center gap-2 ${showMasterCatalog ? 'bg-brand-wine text-white border-brand-wine' : 'bg-white text-slate-600 border-slate-200 hover:border-brand-wine hover:text-brand-wine'}`}
                >
                  <Database className="w-3.5 h-3.5" />
                  {showMasterCatalog ? 'ダッシュボードへ' : 'マスターを表示'}
                </button>
              </div>
              <p className="text-slate-400 text-xs uppercase tracking-[0.4em] font-bold text-center md:text-left">Sales Representative: {user?.name} • Total Stores: {stores.length}</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 md:gap-4 px-4 md:px-0">
              <button
                 onClick={handleCreateStore}
                 className="flex items-center justify-center gap-2 px-6 md:px-8 py-3 bg-brand-wine text-white rounded-full text-xs font-bold uppercase tracking-widest hover:scale-105 transition-all shadow-md active:scale-95 w-full sm:w-auto"
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
                className="flex items-center justify-center gap-2 px-6 md:px-8 py-3 bg-white border-2 border-slate-200 rounded-full text-xs text-slate-600 font-bold uppercase tracking-widest hover:border-brand-wine hover:text-brand-wine transition-all shadow-sm w-full sm:w-auto"
              >
                <Upload className="w-5 h-5" />
                マスター更新
              </button>
            </div>
          </div>
        </header>

        <div className="max-w-7xl mx-auto px-4 md:px-8">
          {!showMasterCatalog && (
            <div className="bg-white border border-slate-200 rounded-[2rem] p-6 md:p-8 mb-10 shadow-sm backdrop-blur-xl bg-white/80">
              <div className="flex flex-col lg:flex-row gap-6 items-center">
                <div className="relative flex-1 w-full group">
                  <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300 group-focus-within:text-brand-wine transition-colors" />
                  <input 
                    type="text"
                    placeholder="店舗名・住所で検索..."
                    value={storeSearchTerm}
                    onChange={(e) => setStoreSearchTerm(e.target.value)}
                    className="w-full pl-14 pr-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm focus:bg-white focus:border-brand-wine outline-none transition-all shadow-inner focus:shadow-luxury-soft"
                  />
                </div>
                <div className="flex flex-wrap items-center gap-4 w-full lg:w-auto">
                  <div className="flex items-center gap-2 bg-slate-50 p-1 rounded-xl border border-slate-100">
                    <select 
                      value={selectedCuisineFilter}
                      onChange={(e) => setSelectedCuisineFilter(e.target.value)}
                      className="bg-transparent px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 outline-none cursor-pointer hover:text-brand-wine transition-colors"
                    >
                      <option value="all">すべての料理</option>
                      {cuisineTypes.filter(t => t !== 'all').map(type => (
                        <option key={type} value={type}>{type}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-center gap-2 bg-slate-50 p-1 rounded-xl border border-slate-100">
                    <select 
                      value={selectedStatusFilter}
                      onChange={(e) => setSelectedStatusFilter(e.target.value as any)}
                      className="bg-transparent px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 outline-none cursor-pointer hover:text-brand-wine transition-colors"
                    >
                      <option value="all">すべての状態</option>
                      <option value="active">稼働中</option>
                      <option value="inactive">停止中</option>
                    </select>
                  </div>
                  <div className="ml-auto lg:ml-0 flex items-center gap-2 px-4 py-2.5 bg-brand-wine shadow-lg rounded-xl">
                    <span className="text-[10px] font-black uppercase tracking-widest text-white/60">Hits</span>
                    <span className="text-sm font-black text-white">{filteredStores.length}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

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
              stores={filteredStores}
              hasMoreStores={hasMoreStores}
              onLoadMoreStores={handleLoadMoreStores}
              onCreateStore={handleCreateStore}
              onDeleteStore={handleDeleteStore}
              onSelectStore={setSelectedStoreId}
            />
          )}

          {renderMasterEditModal()}
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
              className="text-xs font-bold text-slate-400 uppercase tracking-widest hover:text-brand-wine transition-colors flex items-center gap-1 mb-1 md:mb-2"
            >
              ← ダッシュボードに戻る
            </button>
            {isEditingStore ? (
              <div className="space-y-4 bg-slate-50 p-4 md:p-6 rounded-2xl border border-slate-200 w-full max-w-md animate-in slide-in-from-left duration-300">
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-1">店名</label>
                  <input 
                    type="text"
                    value={editStoreData.name}
                    onChange={e => setEditStoreData({...editStoreData, name: e.target.value})}
                    className="w-full bg-white border border-slate-300 rounded px-3 py-2 text-sm text-slate-900 focus:border-brand-wine outline-none transition-all"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-1">ジャンル</label>
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
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-1">ステータス</label>
                    <button 
                      onClick={() => setEditStoreData({...editStoreData, isActive: !editStoreData.isActive})}
                      className={`w-full py-2 rounded text-xs font-bold uppercase tracking-widest border transition-all ${editStoreData.isActive ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}
                    >
                      {editStoreData.isActive ? '● 公開中' : '○ 停止中'}
                    </button>
                  </div>
                </div>

                {/* New Customization Settings */}
                <div className="space-y-4 pt-4 border-t border-slate-200">
                  <div className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-xl">
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">ペアリングフィルターを非表示</span>
                      <span className="text-xs text-slate-400 uppercase">「お料理から選ぶ」を隠す</span>
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
                      <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">マリアージュ詳細を非表示</span>
                      <span className="text-xs text-slate-400 uppercase">「最高のマリアージュ」を隠す</span>
                    </div>
                    <button 
                      onClick={() => setEditStoreData({...editStoreData, hideWinePairing: !editStoreData.hideWinePairing})}
                      className={`w-12 h-6 rounded-full transition-all relative ${editStoreData.hideWinePairing ? 'bg-brand-wine' : 'bg-slate-200'}`}
                    >
                      <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${editStoreData.hideWinePairing ? 'left-7' : 'left-1'}`} />
                    </button>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-1">予算設定 (カンマ区切り)</label>
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
                    <p className="text-xs text-slate-400 mt-1 uppercase tracking-tighter">例: 5000, 10000, 20000 (数値のみ入力してください)</p>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-1">許可サプライヤー (カンマ区切り)</label>
                    <input 
                      type="text"
                      placeholder="Pieroth, SuppA, SuppB"
                      value={editStoreData.allowedSuppliers?.join(', ') || ''}
                      onChange={e => {
                        const suppliers = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
                        setEditStoreData({...editStoreData, allowedSuppliers: suppliers.length > 0 ? suppliers : undefined});
                      }}
                      className="w-full bg-white border border-slate-300 rounded px-3 py-2 text-sm text-slate-900 focus:border-brand-wine outline-none transition-all"
                    />
                    <p className="text-xs text-slate-400 mt-1 uppercase tracking-tighter">例: Pieroth, OtherSupplier (未設定時は全許可)</p>
                  </div>
                </div>
                <div className="flex flex-col items-center justify-center bg-white p-6 rounded-2xl border border-slate-200 shadow-inner">
                  <div className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">モバイル用QRコード</div>
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
                      className="w-full py-3 bg-brand-wine text-white rounded-xl text-xs font-bold uppercase tracking-widest hover:brightness-125 flex items-center justify-center gap-2 shadow-luxury border border-brand-gold/30"
                    >
                      <Settings className="w-3.5 h-3.5" />
                      店舗オーナーとして管理
                    </button>
                    <button 
                      onClick={() => window.open(`${getBaseUrl()}/menu/${selectedStoreId}`, '_blank')}
                      className="w-full py-3 bg-brand-gold text-brand-wine rounded-xl text-xs font-bold uppercase tracking-widest hover:brightness-110 flex items-center justify-center gap-2 shadow-sm"
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
                      className="w-full py-2 bg-slate-100 text-slate-600 rounded-lg text-xs font-bold uppercase tracking-widest hover:bg-slate-200 transition-all border border-slate-200"
                    >
                      URLをコピー
                    </button>
                    <div className="h-px bg-slate-200 my-2" />
                    <button 
                      onClick={() => handleDeleteStore(selectedStoreId!)}
                      className="w-full py-3 bg-white text-red-500 border border-red-200 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-red-50 transition-all flex items-center justify-center gap-2"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      この店舗を削除する
                    </button>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-1">住所</label>
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
                    className="flex-1 py-2 bg-brand-wine text-white text-xs font-bold uppercase tracking-widest rounded flex items-center justify-center gap-2 hover:bg-opacity-90 transition-all font-bold"
                  >
                    <Save className="w-4 h-4" /> 保存
                  </button>
                  <button 
                    onClick={() => setIsEditingStore(false)}
                    className="px-4 py-2 bg-slate-200 text-slate-700 text-xs font-bold uppercase tracking-widest rounded hover:bg-slate-300 transition-all"
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
                        allowedSuppliers: selectedStore?.allowedSuppliers || [],
                        budgetTiers: selectedStore?.budgetTiers || [],
                        hidePairingFilter: selectedStore?.hidePairingFilter || false,
                        hideWinePairing: selectedStore?.hideWinePairing || false,
                      });
                      setIsEditingStore(true);
                    }}
                    className="p-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-500 hover:text-slate-900 transition-all border border-slate-200"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-slate-500 text-xs uppercase tracking-[0.3em] font-bold flex items-center gap-2 mt-1 md:mt-0">
                  Menu Strategy • {selectedStore?.cuisine_type} 
                  <span className={`w-2.5 h-2.5 rounded-full ${selectedStore?.isActive ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.3)]' : 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.3)]'}`}></span>
                </p>
                <p className="text-slate-400 text-xs mt-1 font-medium italic truncate max-w-xs">{selectedStore?.address}</p>
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
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 md:px-5 py-2 md:py-2.5 bg-white border border-slate-200 text-slate-700 rounded-full text-xs font-bold uppercase tracking-widest hover:border-brand-wine hover:text-brand-wine transition-all shadow-sm"
            >
              <Shield className="w-4 h-4 text-brand-gold shrink-0" />
              <span className="truncate">{selectedStore?.ownerId ? 'オーナー編集' : 'オーナー作成'}</span>
            </button>
            <button
              onClick={() => window.open(`/menu/${selectedStoreId}`, '_blank')}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 md:px-5 py-2 md:py-2.5 bg-brand-wine text-white rounded-full text-xs font-bold uppercase tracking-widest hover:scale-105 transition-all shadow-md"
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

        {/* ─── 修正後：固定位置から、画面右上に浮かび上がるPOPUPトーストへ刷新 ─── */}
        <AnimatePresence>
          {importStatus && (
            <motion.div 
              initial={{ opacity: 0, y: -20, scale: 0.9, x: 20 }}
              animate={{ opacity: 1, y: 0, scale: 1, x: 0 }}
              exit={{ opacity: 0, y: -20, scale: 0.9, x: 20 }}
              className={`fixed top-6 right-6 z-[250] w-full max-w-sm p-4 rounded-2xl flex items-center gap-3 border shadow-[0_20px_50px_rgba(0,0,0,0.18)] backdrop-blur-md ${
                importStatus.type === 'success' 
                  ? 'bg-emerald-50/95 border-emerald-200 text-emerald-800' 
                  : 'bg-rose-50/95 border-rose-200 text-rose-800'
              }`}
            >
              <div className="flex-1">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-60">
                  {importStatus.type === 'success' ? 'SYSTEM SUCCESS' : 'SYSTEM ERROR'}
                </p>
                <p className="text-xs font-bold mt-0.5 tracking-wide leading-relaxed">
                  {importStatus.message}
                </p>
              </div>
              <button 
                onClick={() => setImportStatus(null)} 
                className="p-1.5 hover:bg-black/5 rounded-xl transition-colors opacity-40 hover:opacity-100 shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

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

      {renderMasterEditModal()}
    </div>
  );
};
