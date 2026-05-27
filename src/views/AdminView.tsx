// src/views/AdminView.tsx
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { WineMaster, Store } from '../types';
import { useWines } from '../lib/WineContext';
import { wineRepository } from '../lib/repositories/wineRepository';
import { useStoresQuery } from '../hooks/useStoresQuery';
import { useWinesMasterQuery } from '../hooks/useWinesQuery';
import { useInventoryQuery, useInventoryMutations } from '../hooks/useInventoryQuery';
import { db } from '../lib/firebase';
import { doc, setDoc, updateDoc, deleteDoc, writeBatch } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';
import { initializeApp, deleteApp, getApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import { Plus, Database, Upload, Save, Settings, Edit2, Wine, Trash2, X, Search, ChevronLeft, QrCode, ExternalLink } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useQueryClient } from '@tanstack/react-query';

import { parseWineCSV } from '../lib/csv-parser';
import { StoreGrid } from '../components/admin/StoreGrid';
import { InventoryManager } from '../components/admin/InventoryManager';
import { MasterCatalog } from '../components/admin/MasterCatalog';
import { OwnerAccountForm } from '../components/admin/OwnerAccountForm';
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

export const AdminView: React.FC = () => {
  const { user, showToast, showConfirm } = useWines();
  const queryClient = useQueryClient();
  const { data: storesData, fetchNextPage: fetchNextStores, hasNextPage: hasMoreStores } = useStoresQuery(user);
  const { data: winesMasterData, fetchNextPage: fetchNextWinesMaster, hasNextPage: hasMoreWinesMaster } = useWinesMasterQuery();
  const [masterSearchTerm, setMasterSearchTerm] = useState('');

  const stores = useMemo(() => (storesData?.pages.flatMap(page => page.data) || []).filter(Boolean), [storesData]);
  const wines = useMemo(() => (winesMasterData?.pages.flatMap(page => page.data) || []).filter(Boolean), [winesMasterData]);

  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);
  const { data: inventoryData } = useInventoryQuery(selectedStoreId);
  const { updateStoreMutation } = useInventoryMutations(selectedStoreId || '');

  const [selectedWines, setSelectedWines] = useState<WineMaster[]>([]);
  const [initialWines, setInitialWines] = useState<WineMaster[]>([]);
  const [dataLoadedForStore, setDataLoadedForStore] = useState<string | null>(null);
  const [selectedMasterCatalogIds, setSelectedMasterCatalogIds] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);

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
    const params = new URLSearchParams(window.location.search);
    const storeId = params.get('storeId');
    if (storeId && storeId !== selectedStoreId) setSelectedStoreId(storeId);
  }, []);

  useEffect(() => {
    if (selectedStoreId) {
      const url = new URL(window.location.href);
      if (url.searchParams.get('storeId') !== selectedStoreId) {
        url.searchParams.set('storeId', selectedStoreId);
        window.history.replaceState({}, '', url.toString());
      }
    } else {
      const url = new URL(window.location.href);
      if (url.searchParams.has('storeId')) {
        url.searchParams.delete('storeId');
        window.history.replaceState({}, '', url.toString());
      }
    }
  }, [selectedStoreId]);

  const [storeSearchTerm, setStoreSearchTerm] = useState('');
  const [selectedCuisineFilter, setSelectedCuisineFilter] = useState('all');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  const cuisineTypes = useMemo(() => {
    const types = stores.map(s => String(s?.cuisine_type || '')).filter(t => t && t !== 'all');
    return ['all', ...Array.from(new Set(types)).sort()];
  }, [stores]);

  const filteredStores = useMemo(() => {
    return stores.filter(store => {
      if (!store) return false;
      const nameStr = String(store.name || '').toLowerCase();
      const addressStr = String(store.address || '').toLowerCase();
      const searchStr = String(storeSearchTerm || '').toLowerCase();
      
      const matchesSearch = !searchStr || nameStr.includes(searchStr) || addressStr.includes(searchStr);
      const matchesCuisine = selectedCuisineFilter === 'all' || store.cuisine_type === selectedCuisineFilter;
      const matchesStatus = selectedStatusFilter === 'all' || (selectedStatusFilter === 'active' && store.isActive) || (selectedStatusFilter === 'inactive' && !store.isActive);
      
      return matchesSearch && matchesCuisine && matchesStatus;
    });
  }, [stores, storeSearchTerm, selectedCuisineFilter, selectedStatusFilter]);

  const [searchId, setSearchId] = useState('');
  const [isImporting, setIsImporting] = useState(false);
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
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      cost: wine.cost,
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
      showToast('マスターカタログ情報を更新しました。', 'success');
      setIsEditingMaster(false);
      queryClient.invalidateQueries({ queryKey: ['winesMaster'] });
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

  const handleUpdateWineItem = (wineId: string, updatedFields: Partial<WineMaster>, saveImmediately = false) => {
    if (!selectedStoreId) return;
    
    const nextWines = selectedWines.map(w => w.id === wineId ? { ...w, ...updatedFields } : w);
    setSelectedWines(nextWines);

    if (saveImmediately) {
      const wine = nextWines.find(w => w.id === wineId);
      if (!wine) return;
      const compositeId = getWineDocId(wine);
      (async () => {
        try {
          await setDoc(doc(db, 'stores', selectedStoreId, 'inventory', compositeId), { ...wine, id: compositeId }, { merge: true });
          
          const richPublicMenu = nextWines
            .filter(w => w.visible !== false && w.isActive !== false)
            .map(w => ({ ...w, id: getWineDocId(w) }));

          await updateDoc(doc(db, 'stores', selectedStoreId), { publicMenu: richPublicMenu, updatedAt: new Date().toISOString() });
          
          queryClient.invalidateQueries({ queryKey: ['publicMenu', selectedStoreId] });
          setInitialWines(JSON.parse(JSON.stringify(nextWines))); 
        } catch (error) {
          console.error('Error auto-updating wine inventory item:', error);
        }
      })();
    }
  };

  const handleAddWine = async (wineId?: string) => {
    const idToUse = wineId || searchId;
    let wine = wines.find(w => w.id === idToUse);
    if (!wine) return showToast('該当するワインコードが見つかりません。', 'error');
    
    const compositeId = getWineDocId(wine);
    if (selectedWines.some(sw => getWineDocId(sw) === compositeId)) return showToast('このワインは既にメニューに登録されています。', 'info');
    
    if (selectedStoreId) {
      const allowed = Array.isArray(selectedStore?.allowedSuppliers) 
        ? selectedStore!.allowedSuppliers.map(s => String(s).toUpperCase())
        : ['PIEROTH'];
        
      const wineSupplier = String(wine.supplier || 'PIEROTH').toUpperCase();
      
      if (!allowed.includes('ALL') && !allowed.includes(wineSupplier)) {
        showToast(`この店舗には指定サプライヤー「${wineSupplier}」のワインを登録する権限がありません`, 'error');
        return;
      }

      try {
        const newInventoryItem = {
          ...wine,
          id: compositeId,
          pureId: safeExtractPureId(wine.pureId || wine.id, wine.supplier).toUpperCase(),
          supplier: wineSupplier,
          price_bottle: wine.price_bottle || wine.cost * 3,
          price_glass: wine.price_glass || Math.round((wine.cost * 3 / 6) / 100) * 100,
          glasses_per_bottle: 6,
          stock: 0,
          isActive: true,
          visible: true,
          updatedAt: new Date().toISOString()
        };
        
        await setDoc(doc(db, 'stores', selectedStoreId, 'inventory', compositeId), newInventoryItem);
        const newWinesList = [...selectedWines, newInventoryItem as WineMaster];
        
        setSelectedWines(newWinesList);
        setInitialWines(JSON.parse(JSON.stringify(newWinesList))); 
        setSearchId('');
        
        const richPublicMenu = newWinesList
          .filter(w => w.visible !== false && w.isActive !== false)
          .map(w => ({ ...w, id: getWineDocId(w) }));

        await updateDoc(doc(db, 'stores', selectedStoreId), { publicMenu: richPublicMenu, updatedAt: new Date().toISOString() });
        fetch(`/api/menu/${selectedStoreId}/invalidate`, { method: 'POST' }).catch(() => {});
        queryClient.invalidateQueries({ queryKey: ['publicMenu', selectedStoreId] });
        showToast('セラーへの銘柄追加が完了しました。', 'success');
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, `stores/${selectedStoreId}`);
      }
    }
  };

  const handleBulkAddWines = async () => {
    if (!selectedStoreId || selectedMasterCatalogIds.length === 0) return;
    try {
      let winesToAdd = wines.filter(w => selectedMasterCatalogIds.includes(w.id));
      
      const allowed = Array.isArray(selectedStore?.allowedSuppliers) 
        ? selectedStore!.allowedSuppliers.map(s => String(s).toUpperCase())
        : ['PIEROTH'];

      const unauthorized = winesToAdd.filter(w => {
        const wineSupplier = String(w.supplier || 'PIEROTH').toUpperCase();
        return !allowed.includes('ALL') && !allowed.includes(wineSupplier);
      });

      if (unauthorized.length > 0) {
        const unauthorizedSet = Array.from(new Set(unauthorized.map(w => String(w.supplier || 'PIEROTH').toUpperCase())));
        showToast(`許可されていないサプライヤーが含まれています: ${unauthorizedSet.join(', ')}`, 'error');
        return;
      }

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
          batch.set(doc(db, 'stores', selectedStoreId, 'inventory', compositeId), newInventoryItem);
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

      await updateDoc(doc(db, 'stores', selectedStoreId), { publicMenu: richPublicMenu, updatedAt: new Date().toISOString() });
      
      fetch(`/api/menu/${selectedStoreId}/invalidate`, { method: 'POST' }).catch(() => {});
      queryClient.invalidateQueries({ queryKey: ['publicMenu', selectedStoreId] });
      
      showToast(`${selectedMasterCatalogIds.length}件のワインをセラーに一括導入しました。`, 'success');
      setShowCatalogSelection(false);
      setSelectedMasterCatalogIds([]);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `stores/${selectedStoreId}/bulk`);
    }
  };

  const handleSaveInventory = async () => {
    if (!selectedStoreId) return;
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
            const docRef = doc(db, 'stores', selectedStoreId, 'inventory', compositeId);
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

      await updateDoc(doc(db, 'stores', selectedStoreId), {
        publicMenu: richPublicMenu,
        updatedAt: new Date().toISOString()
      });

      fetch(`/api/menu/${selectedStoreId}/invalidate`, { method: 'POST' }).catch(() => {});
      queryClient.invalidateQueries({ queryKey: ['publicMenu', selectedStoreId] });
      queryClient.invalidateQueries({ queryKey: ['inventory', selectedStoreId] });
      
      setInitialWines(JSON.parse(JSON.stringify(selectedWines)));
      showToast(`一括保存が完了しました（更新: ${totalWriteCount}件）`, 'success');
    } catch (error) {
      console.error('一括保存に失敗しました:', error);
      showToast('セラー情報の保存に失敗しました。', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteWine = async (wineId: string) => {
    if (!selectedStoreId) return;
    showConfirm(
      'このワインをメニューから削除しますか？',
      async () => {
        try {
          await deleteDoc(doc(db, 'stores', selectedStoreId, 'inventory', wineId));
          const filteredList = selectedWines.filter(w => w.id !== wineId);
          setSelectedWines(filteredList);
          setInitialWines(JSON.parse(JSON.stringify(filteredList)));
          
          const richPublicMenu = filteredList
            .filter(w => w.visible !== false && w.isActive !== false)
            .map(w => ({ ...w, id: getWineDocId(w) }));

          await updateDoc(doc(db, 'stores', selectedStoreId), { publicMenu: richPublicMenu, updatedAt: new Date().toISOString() });
          fetch(`/api/menu/${selectedStoreId}/invalidate`, { method: 'POST' }).catch(() => {});
          queryClient.invalidateQueries({ queryKey: ['publicMenu', selectedStoreId] });
          showToast('対象の銘柄を削除しました。', 'success');
        } catch (error) {
          handleFirestoreError(error, OperationType.DELETE, `stores/${selectedStoreId}`);
        }
      },
      '削除すると、店舗のお客様用メニューからもリアルタイムに非表示になります。'
    );
  };

  const handleUpdateStore = async () => {
    if (!selectedStoreId) return;
    try {
      await updateStoreMutation.mutateAsync({
        name: editStoreData.name,
        cuisine_type: editStoreData.cuisine_type,
        address: editStoreData.address,
        hidePairingFilter: editStoreData.hidePairingFilter,
        hideWinePairing: editStoreData.hideWinePairing,
        budgetTiers: editStoreData.budgetTiers,
        allowedSuppliers: editStoreData.allowedSuppliers,
      });

      if (editStoreData.name !== selectedStore?.name && user?.uid) {
        await updateDoc(doc(db, 'users', user.uid), {
          name: editStoreData.name
        });
      }

      fetch(`/api/menu/${selectedStoreId}/invalidate`, { method: 'POST' }).catch(() => {});
      queryClient.invalidateQueries({ queryKey: ['inventory', selectedStoreId] });
      queryClient.invalidateQueries({ queryKey: ['stores'] });
      
      showToast('店舗の基本設定情報を更新しました。', 'success');
      setIsEditingStore(false);
    } catch (error: any) {
      handleFirestoreError(error, OperationType.UPDATE, `stores/${selectedStoreId}`);
    }
  };

  const handleBulkDeleteMasterWines = async () => {
    if (selectedMasterCatalogIds.length === 0) return;
    
    showConfirm(
      `選択された ${selectedMasterCatalogIds.length} 件のワインをマスターから完全に削除しますか？`,
      async () => {
        try {
          const CHUNK_SIZE = 450;
          for (let i = 0; i < selectedMasterCatalogIds.length; i += CHUNK_SIZE) {
            const chunk = selectedMasterCatalogIds.slice(i, i + CHUNK_SIZE);
            const batch = writeBatch(db);
            chunk.forEach(id => {
              batch.delete(doc(db, 'winesMaster', id));
            });
            await batch.commit();
          }

          queryClient.invalidateQueries({ queryKey: ['winesMaster'] });
          setSelectedMasterCatalogIds([]);
          showToast('選択したマスター銘柄を一括削除しました。', 'success');
        } catch (error) {
          console.error('マスターカタログの一括削除に失敗しました:', error);
          showToast('一括削除に失敗しました。', 'error');
        }
      },
      '※この操作は取り消せません。大元の全社共有カタログからデータが完全消去されます。'
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
        ownerId: '',
        cuisine_type: 'フレンチ',
        isActive: true,
        hasAiSommelier: true,
        address: '〒106-0032 東京都港区六本木...',
        budgetTiers: [],
        hidePairingFilter: false,
        hideWinePairing: false,
        allowedSuppliers: ['PIEROTH']
      };
      
      await setDoc(doc(db, 'stores', newStoreId), newStore);
      queryClient.invalidateQueries({ queryKey: ['stores'] });
      showToast('新しい店舗情報を発行・新規開拓しました。', 'success');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  };

  const handleCreateOwner = async () => {
    if (!selectedStoreId || !ownerEmail) return;
    if (!isEditingOwner && (!ownerPassword || ownerPassword.length < 6)) {
      showToast('新規作成時は6文字以上のパスワードが必要です。', 'error');
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
        showToast('オーナーアカウント情報を更新しました。', 'success');
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
          role: 'owner' as const,
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
        showToast('店舗統括用オーナーアカウントを新規発行しました。', 'success');
      }

      setShowOwnerForm(false);
      setIsEditingOwner(false);
      setOwnerEmail('');
      setOwnerPassword('');
      queryClient.invalidateQueries({ queryKey: ['stores'] });
    } catch (error: any) {
      showToast(`操作失敗: ${error.message}`, 'error');
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

  const handleDeleteStore = (storeId: string) => {
    showConfirm(
      'この店舗を完全にシステムから削除してよろしいですか？',
      async () => {
        try {
          await deleteDoc(doc(db, 'stores', storeId));
          showToast('対象店舗を削除しました。', 'success');
          if (selectedStoreId === storeId) {
            setSelectedStoreId(null);
          }
          queryClient.invalidateQueries({ queryKey: ['stores'] });
        } catch (error: any) {
          handleFirestoreError(error, OperationType.DELETE, `stores/${storeId}`);
        }
      },
      '削除すると、店舗のお客様用メニューや蓄積されたセラー在庫データ、QRコードすべてが消失します。'
    );
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsImporting(true);

    try {
      const importedWines = await parseWineCSV(file);
      const CHUNK_SIZE = 450;
      
      const uniqueMap = new Map<string, WineMaster>();
      importedWines.forEach(w => uniqueMap.set(getWineDocId(w), w));
      const uniqueImportedWines = Array.from(uniqueMap.values());

      const newMasterWines = uniqueImportedWines.filter(wine => {
        const compositeId = getWineDocId(wine);
        return !wines.some(existingWine => getWineDocId(existingWine) === compositeId);
      });

      if (newMasterWines.length > 0) {
        for (let i = 0; i < newMasterWines.length; i += CHUNK_SIZE) {
          const chunk = newMasterWines.slice(i, i + CHUNK_SIZE);
          const batch = writeBatch(db);
          
          chunk.forEach(wine => {
            const docId = getWineDocId(wine);
            const wineToSave = { ...wine, id: docId, pureId: wine.pureId || wine.id };
            batch.set(doc(db, 'winesMaster', docId), wineToSave);
          });
          
          await batch.commit();
        }
        queryClient.invalidateQueries({ queryKey: ['winesMaster'] });
      }

      if (selectedStoreId) {
        let winesToAdd = uniqueImportedWines;
        const allowed = Array.isArray(selectedStore?.allowedSuppliers) 
          ? selectedStore!.allowedSuppliers.map(s => String(s).toUpperCase())
          : ['PIEROTH'];
          
        winesToAdd = winesToAdd.filter(w => allowed.includes(String(w.supplier || 'PIEROTH').toUpperCase()));

        const newInventoryWines = winesToAdd.filter(wine => {
          const compositeId = getWineDocId(wine);
          return !selectedWines.some(sw => sw.id === compositeId);
        });

        if (newInventoryWines.length > 0) {
          for (let i = 0; i < newInventoryWines.length; i += CHUNK_SIZE) {
            const chunk = newInventoryWines.slice(i, i + CHUNK_SIZE);
            const batch = writeBatch(db);
            
            chunk.forEach(wine => {
              const compositeId = getWineDocId(wine);
              const invItem = {
                ...wine,
                id: compositeId,
                pureId: safeExtractPureId(wine.pureId || wine.id, wine.supplier).toUpperCase(),
                supplier: String(wine.supplier || 'PIEROTH').toUpperCase(),
                price_bottle: wine.price_bottle || Math.round(wine.cost * 3 / 100) * 100,
                price_glass: wine.price_glass || 0,
                glasses_per_bottle: 6,
                stock: wine.stock || 0,
                isActive: true,
                visible: true,
                updatedAt: new Date().toISOString()
              };
              batch.set(doc(db, 'stores', selectedStoreId, 'inventory', compositeId), invItem, { merge: true });
            });
            
            await batch.commit();
          }
          
          const mergedWinesList = [...selectedWines];
          newInventoryWines.forEach(wine => {
            const compositeId = getWineDocId(wine);
            mergedWinesList.push({
              ...wine,
              id: compositeId,
              pureId: safeExtractPureId(wine.pureId || wine.id, wine.supplier).toUpperCase(),
              price_bottle: wine.price_bottle || Math.round(wine.cost * 3 / 100) * 100,
              price_glass: wine.price_glass || 0,
              glasses_per_bottle: 6,
              stock: wine.stock || 0,
              isActive: true,
              visible: true,
            } as WineMaster);
          });

          setSelectedWines(mergedWinesList);
          setInitialWines(JSON.parse(JSON.stringify(mergedWinesList)));
          
          const richPublicMenu = mergedWinesList
            .filter(w => w.visible !== false && w.isActive !== false)
            .map(w => ({ ...w, id: getWineDocId(w) }));

          await updateDoc(doc(db, 'stores', selectedStoreId), { publicMenu: richPublicMenu, updatedAt: new Date().toISOString() });
          fetch(`/api/menu/${selectedStoreId}/invalidate`, { method: 'POST' }).catch(() => {});
          queryClient.invalidateQueries({ queryKey: ['publicMenu', selectedStoreId] });
        }
      }

      showToast(`${uniqueImportedWines.length}件のCSV処理が正常完了しました。`, 'success');
    } catch (error: any) {
      showToast(`インポートに失敗しました: ${error.message}`, 'error');
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const toggleMasterSelection = (id: string) => {
    setSelectedMasterCatalogIds(prev => prev.includes(id) ? prev.filter(mid => mid !== id) : [...prev, id]);
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
                    className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm text-slate-900 outline-none focus:border-brand-wine"
                    value={editMasterData.grape_en || ''}
                    onChange={e => {
                      setEditMasterData({...editMasterData, grape_en: e.target.value});
                    }}
                  />
                </div>
                <div className="md:col-span-1">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-2">仕入れ価格 (税別)</label>
                  <input 
                    type="number"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 outline-none focus:border-brand-wine"
                    value={editMasterData.cost || 0}
                    onChange={e => setEditMasterData({...editMasterData, cost: parseInt(e.target.value) || 0})}
                  />
                </div>
                <div className="md:col-span-1">
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
      <header className="bg-white border-b border-slate-200 px-4 md:px-8 py-6 md:py-10 mb-6 md:mb-8 z-20 shadow-sm">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center justify-center md:justify-start gap-4 mb-1 md:mb-2 text-center md:text-left">
              <h1 className="serif text-2xl md:text-4xl text-slate-900">
                {showMasterCatalog ? 'マスターカタログ' : '営業統括ダッシュボード'}
              </h1>
              <button 
                onClick={() => {
                  setSelectedMasterCatalogIds([]); 
                  setShowMasterCatalog(!showMasterCatalog);
                }}
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
        {!showMasterCatalog && !selectedStoreId && (
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
                    <option value="active">稼動中</option>
                    <option value="inactive">停止中</option>
                  </select>
                </div>
                <div className="col-span-full lg:col-span-1 flex items-center gap-2 px-4 py-2.5 bg-brand-wine shadow-lg rounded-xl">
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
            onStartEditingMaster={startEditingMaster}
            selectedMasterCatalogIds={selectedMasterCatalogIds}
            setSelectedMasterCatalogIds={setSelectedMasterCatalogIds}
            onBulkDeleteWines={handleBulkDeleteMasterWines}
            hasMoreWines={!!hasMoreWinesMaster}
            onLoadMoreWines={handleLoadMoreWines}
          />
        ) : selectedStoreId ? (
          <div className="space-y-8 animate-in fade-in duration-500">
            <div className="flex items-center gap-4 mb-6">
              <button 
                onClick={() => setSelectedStoreId(null)}
                className="px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-full text-xs font-bold uppercase tracking-widest hover:border-brand-wine hover:text-brand-wine transition-all flex items-center gap-2"
              >
                <ChevronLeft className="w-4 h-4" />
                店舗一覧へ戻る
              </button>
              <h2 className="serif text-2xl md:text-3xl text-slate-900">{selectedStore?.name}</h2>
              <span className={`text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full ${selectedStore?.isActive ? 'bg-green-50 text-green-600 border border-green-100' : 'bg-red-50 text-red-600 border border-red-100'}`}>
                {selectedStore?.isActive ? '稼働中' : '停止中'}
              </span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2">
                <InventoryManager 
                  selectedStore={selectedStore}
                  selectedStoreId={selectedStoreId as string}
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
                  hasMoreWines={!!hasMoreWinesMaster}
                  onLoadMoreWines={handleLoadMoreWines}
                  onUpdateWineItem={handleUpdateWineItem}
                  isOwner={false} // Adminなので発注機能は非表示
                />
              </div>
              <div className="space-y-6">
                <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Settings className="text-brand-wine w-5 h-5" />
                    <h2 className="text-xs font-bold uppercase tracking-widest text-slate-800">基本情報設定</h2>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-1">店名</label>
                    <input 
                      type="text"
                      value={isEditingStore ? editStoreData.name || '' : selectedStore?.name || ''}
                      onChange={(e) => isEditingStore && setEditStoreData({...editStoreData, name: e.target.value})}
                      disabled={!isEditingStore}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-brand-wine disabled:opacity-70 disabled:bg-slate-100"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-1">料理カテゴリー</label>
                    <input 
                      type="text"
                      value={isEditingStore ? editStoreData.cuisine_type || '' : selectedStore?.cuisine_type || ''}
                      onChange={(e) => isEditingStore && setEditStoreData({...editStoreData, cuisine_type: e.target.value})}
                      disabled={!isEditingStore}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-brand-wine disabled:opacity-70 disabled:bg-slate-100"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-1">住所</label>
                    <input 
                      type="text"
                      value={isEditingStore ? editStoreData.address || '' : selectedStore?.address || ''}
                      onChange={(e) => isEditingStore && setEditStoreData({...editStoreData, address: e.target.value})}
                      disabled={!isEditingStore}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-brand-wine disabled:opacity-70 disabled:bg-slate-100"
                    />
                  </div>

                  <div className="space-y-4 pt-4 border-t border-slate-100">
                    <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-100 rounded-xl">
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">ペアリングフィルターを非表示</span>
                        <span className="text-xs text-slate-500 uppercase">「お料理から選ぶ」を隠す</span>
                      </div>
                      <button 
                        onClick={() => isEditingStore && setEditStoreData({...editStoreData, hidePairingFilter: !editStoreData.hidePairingFilter})}
                        disabled={!isEditingStore}
                        className={`w-12 h-6 rounded-full transition-all relative disabled:opacity-50 ${
                          (isEditingStore ? editStoreData.hidePairingFilter : selectedStore?.hidePairingFilter) ? 'bg-green-500' : 'bg-slate-300'
                        }`}
                      >
                        <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${(isEditingStore ? editStoreData.hidePairingFilter : selectedStore?.hidePairingFilter) ? 'left-7' : 'left-1'}`} />
                      </button>
                    </div>

                    <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-100 rounded-xl">
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">マリアージュ詳細を非表示</span>
                        <span className="text-xs text-slate-500 uppercase">「最高のマリアージュ」を隠す</span>
                      </div>
                      <button 
                        onClick={() => isEditingStore && setEditStoreData({...editStoreData, hideWinePairing: !editStoreData.hideWinePairing})}
                        disabled={!isEditingStore}
                        className={`w-12 h-6 rounded-full transition-all relative disabled:opacity-50 ${
                          (isEditingStore ? editStoreData.hideWinePairing : selectedStore?.hideWinePairing) ? 'bg-green-500' : 'bg-slate-300'
                        }`}
                      >
                        <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${(isEditingStore ? editStoreData.hideWinePairing : selectedStore?.hideWinePairing) ? 'left-7' : 'left-1'}`} />
                      </button>
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-1">予算設定 (カンマ区切り)</label>
                      <input 
                        type="text"
                        placeholder="5000, 10000, 20000"
                        value={isEditingStore 
                          ? (Array.isArray(editStoreData.budgetTiers) ? editStoreData.budgetTiers.join(', ') : String(editStoreData.budgetTiers || '')) 
                          : (Array.isArray(selectedStore?.budgetTiers) ? selectedStore!.budgetTiers.join(', ') : String(selectedStore?.budgetTiers || ''))}
                        onChange={e => {
                          const tiers = e.target.value.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n));
                          setEditStoreData({...editStoreData, budgetTiers: tiers});
                        }}
                        disabled={!isEditingStore}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-900 text-sm outline-none focus:border-brand-wine disabled:opacity-70 disabled:bg-slate-100"
                      />
                      <p className="text-xs text-slate-400 mt-1 uppercase tracking-tighter">例: 5000, 10000, 20000 (数値のみ入力してください)</p>
                    </div>

                    <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-100 rounded-xl">
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">他社サプライヤーの許可</span>
                        <span className="text-xs text-slate-500 uppercase">ピーロート以外の銘柄登録を許可</span>
                      </div>
                      <button 
                        onClick={() => {
                          if (isEditingStore) {
                            const currentAllowed = editStoreData.allowedSuppliers || selectedStore?.allowedSuppliers || ['PIEROTH'];
                            const nextAllowed = currentAllowed.includes('ALL')
                              ? currentAllowed.filter(s => s !== 'ALL')
                              : [...currentAllowed, 'ALL'];
                            setEditStoreData({ ...editStoreData, allowedSuppliers: nextAllowed });
                          }
                        }}
                        disabled={!isEditingStore}
                        className={`w-12 h-6 rounded-full transition-all relative disabled:opacity-50 ${
                          (isEditingStore 
                            ? editStoreData.allowedSuppliers?.includes('ALL') 
                            : selectedStore?.allowedSuppliers?.includes('ALL')) 
                            ? 'bg-green-500' 
                            : 'bg-slate-300'
                        }`}
                      >
                        <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${
                          (isEditingStore 
                            ? editStoreData.allowedSuppliers?.includes('ALL') 
                            : selectedStore?.allowedSuppliers?.includes('ALL')) 
                            ? 'left-7' 
                            : 'left-1'
                        }`} />
                      </button>
                    </div>

                  </div>

                  <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">公開ステータス</span>
                    <button 
                      onClick={() => isEditingStore && setEditStoreData({...editStoreData, isActive: !editStoreData.isActive})}
                      disabled={!isEditingStore}
                      className={`w-12 h-6 rounded-full transition-all relative disabled:opacity-50 ${
                        (isEditingStore ? editStoreData.isActive : selectedStore?.isActive) 
                          ? 'bg-green-500' 
                          : 'bg-slate-300'
                      }`}
                    >
                      <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${
                        (isEditingStore ? editStoreData.isActive : selectedStore?.isActive) 
                          ? 'left-7' 
                          : 'left-1'
                      }`} />
                    </button>
                  </div>
                  <div className="pt-4 flex gap-2">
                    {isEditingStore ? (
                      <>
                        <button 
                          onClick={() => setIsEditingStore(false)}
                          className="flex-1 py-2 text-xs font-bold uppercase tracking-widest text-slate-500 hover:bg-slate-50 rounded-xl transition-all"
                        >
                          キャンセル
                        </button>
                        <button 
                          onClick={handleUpdateStore}
                          className="flex-1 py-2 bg-brand-wine text-white text-xs font-bold uppercase tracking-widest rounded-xl hover:shadow-lg hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2"
                        >
                          <Save className="w-3.5 h-3.5" /> 保存
                        </button>
                      </>
                    ) : (
                      <button 
                        onClick={() => {
                          setEditStoreData(selectedStore || {});
                          setIsEditingStore(true);
                        }}
                        className="w-full py-2 bg-slate-100 text-brand-wine text-xs font-bold uppercase tracking-widest rounded-xl hover:bg-brand-wine hover:text-white transition-all flex items-center justify-center gap-2"
                      >
                        <Edit2 className="w-3.5 h-3.5" /> 店舗情報を編集
                      </button>
                    )}
                  </div>
                </div>

                <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
                  <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                    <QrCode className="text-brand-wine w-5 h-5" />
                    <h2 className="text-xs font-bold uppercase tracking-widest text-slate-800">QRコード & お客様メニュー</h2>
                  </div>
                  
                  {selectedStoreId ? (
                    <div className="flex flex-col items-center gap-4 py-2">
                      <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-center shadow-inner">
                        <img 
                          src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(`${getBaseUrl() || window.location.origin}/menu/${selectedStoreId}`)}`} 
                          alt="Store QR Code" 
                          className="w-36 h-36 object-contain"
                        />
                      </div>
                      
                      <p className="text-[11px] text-slate-400 text-center leading-relaxed">
                        このQRコードを印刷して店内に掲示し、お客様がマイスマホでスキャンできるようにしてください。
                      </p>

                      <div className="w-full flex flex-col gap-2">
                        <button 
                          onClick={() => window.open(`${getBaseUrl() || window.location.origin}/menu/${selectedStoreId}`, '_blank')}
                          className="w-full py-3 bg-brand-wine text-white text-xs font-bold uppercase tracking-widest rounded-xl hover:bg-brand-wine/90 hover:shadow-lg transition-all flex items-center justify-center gap-2"
                        >
                          <ExternalLink className="w-4 h-4" /> お客用メニューを開く
                        </button>
                        
                        <div className="text-center">
                          <span className="text-[9px] font-mono select-all break-all text-slate-400 text-center block max-w-full overflow-hidden truncate">
                            {`${getBaseUrl() || window.location.origin}/menu/${selectedStoreId}`}
                          </span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 py-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                      店舗を選択すると、QRコードとメニューURLが生成されます。
                    </p>
                  )}
                </div>

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
            
            <CatalogSelector 
              isOpen={showCatalogSelection}
              onClose={() => setShowCatalogSelection(false)}
              selectedStore={selectedStore}
              wines={wines}
              masterSearchTerm={masterSearchTerm}
              setMasterSearchTerm={setMasterSearchTerm}
              selectedWines={selectedWines}
              selectedMasterIds={selectedMasterCatalogIds} 
              toggleMasterSelection={toggleMasterSelection}
              handleBulkAddWines={handleBulkAddWines}
              hasMoreWines={!!hasMoreWinesMaster}
              onLoadMoreWines={handleLoadMoreWines}
            />
          </div>
        ) : (
          <StoreGrid 
            stores={filteredStores}
            hasMoreStores={!!hasMoreStores}
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
};
