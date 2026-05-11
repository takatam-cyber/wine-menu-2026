import React, { useState, useRef, useEffect } from 'react';
import { WineMaster, Store } from '../types';
import { useWines } from '../lib/WineContext';
import { calculateProfit, calculateGlassProfit } from '../lib/profit-calc';
import { db } from '../lib/firebase';
import { doc, setDoc, collection, getDocs, getDoc, updateDoc, deleteDoc, query, where } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';
import { initializeApp, deleteApp, getApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import { Search, Plus, BarChart3, TrendingUp, DollarSign, FileText, Upload, CheckCircle2, AlertCircle, Wine, Shield, UserPlus, Settings, Key, Edit2, Save, X, Trash2, Database, Loader2, Sparkles, Eye } from 'lucide-react';
import { motion } from 'motion/react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import Papa from 'papaparse';

const PRODUCTION_DOMAIN = "https://ais-pre-3hdh5bfu2wsxmjvi2wumqd-509939825672.asia-east1.run.app";

export const AdminView: React.FC = () => {
  const { wines, setWines, user, stores, refreshStores, refreshWines, searchMasterWines, hasMoreStores, hasMoreWines } = useWines();
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);
  const [searchId, setSearchId] = useState('');
  const [selectedWines, setSelectedWines] = useState<WineMaster[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [importStatus, setImportStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  const [showOwnerForm, setShowOwnerForm] = useState(false);
  const [isEditingOwner, setIsEditingOwner] = useState(false);
  const [showMasterCatalog, setShowMasterCatalog] = useState(false);
  const [masterSearchTerm, setMasterSearchTerm] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [ownerPassword, setOwnerPassword] = useState('');
  const [isCreatingOwner, setIsCreatingOwner] = useState(false);
  const [isEditingStore, setIsEditingStore] = useState(false);
  const [editStoreData, setEditStoreData] = useState<Partial<Store>>({});
  const [showCatalogSelection, setShowCatalogSelection] = useState(false);
  const [selectedMasterIds, setSelectedMasterIds] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSearchMaster = (term: string) => {
    setMasterSearchTerm(term);
    const timeout = setTimeout(() => {
      searchMasterWines(term);
    }, 500);
    return () => clearTimeout(timeout);
  };

  useEffect(() => {
    if (showMasterCatalog && masterSearchTerm === '') {
      refreshWines(false);
    }
  }, [showMasterCatalog, masterSearchTerm, refreshWines]);
  
  const handleLoadMoreStores = () => {
    refreshStores(true, 12);
  };

  const handleLoadMoreWines = () => {
    refreshWines(true, 50);
  };
  const selectedStore = stores.find(s => s.id === selectedStoreId);

  const handleAddWine = async (wineId?: string) => {
    const idToUse = wineId || searchId;
    let wine = wines.find(w => w.id === idToUse);
    
    if (!wine) {
      try {
        const mDoc = await getDoc(doc(db, 'winesMaster', idToUse));
        if (mDoc.exists()) {
          wine = { id: mDoc.id, ...mDoc.data() } as WineMaster;
        }
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
        const docPath = `stores/${selectedStoreId}/inventory/${wine.id}`;
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

  const fetchStoreInventory = async (storeId: string) => {
    const path = `stores/${storeId}/inventory`;
    try {
      const querySnapshot = await getDocs(collection(db, 'stores', storeId, 'inventory'));
      const items = querySnapshot.docs.map(d => ({ id: d.id, ...d.data() as any }));
      
      const enrichedWines: WineMaster[] = [];
      const itemIds = items.map(item => item.id);

      // Fetch master data in chunks of 30 to avoid N+1
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
      await refreshStores();
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  };

  const handleCreateOwner = async () => {
    if (!selectedStoreId || !ownerEmail) return;
    
    // For password updates, user might leave it empty if just editing profile
    if (!isEditingOwner && (!ownerPassword || ownerPassword.length < 6)) {
      setImportStatus({ type: 'error', message: '新規作成時は6文字以上のパスワードが必要です' });
      return;
    }

    setIsCreatingOwner(true);
    const emailToUse = ownerEmail.includes('@') ? ownerEmail : `${ownerEmail}@wine-menu.app`;

    try {
      if (isEditingOwner && selectedStore?.ownerId) {
        // --- EDIT MODE ---
        await updateDoc(doc(db, 'users', selectedStore.ownerId), {
          email: emailToUse,
          name: selectedStore?.name || 'Store Owner'
        });

        await updateDoc(doc(db, 'stores', selectedStoreId), {
          owner_email: emailToUse
        });

        setImportStatus({ type: 'success', message: 'オーナー情報を更新しました' });
      } else {
        // --- CREATE MODE ---
        const secondaryAppName = `secondary-auth-${Date.now()}`;
        let secondaryApp;
        try {
          // Check if app already exists before initializing
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
          hasAiSommelier: true // Default for new stores
        });

        await signOut(secondaryAuth);
        await deleteApp(secondaryApp);

        setImportStatus({ type: 'success', message: 'オーナーアカウントを新規作成しました' });
      }

      setShowOwnerForm(false);
      setIsEditingOwner(false);
      setOwnerEmail('');
      setOwnerPassword('');
      refreshStores();
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

  const handleUpdateStore = async () => {
    if (!selectedStoreId) return;
    try {
      await updateDoc(doc(db, 'stores', selectedStoreId), editStoreData);
      setImportStatus({ type: 'success', message: '店舗情報を更新しました' });
      setIsEditingStore(false);
      refreshStores();
    } catch (error: any) {
      handleFirestoreError(error, OperationType.UPDATE, `stores/${selectedStoreId}`);
    }
  };

  const handleDeleteStore = async (storeId: string) => {
    if (!window.confirm('この店舗と関連する全てのデータを削除しますか？この操作は取り消せません。')) return;
    try {
      await deleteDoc(doc(db, 'stores', storeId));
      setImportStatus({ type: 'success', message: '店舗を削除しました' });
      refreshStores();
    } catch (error: any) {
      handleFirestoreError(error, OperationType.DELETE, `stores/${storeId}`);
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    setImportStatus(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      const buffer = e.target?.result as ArrayBuffer;
      const decoders = [
        new TextDecoder('utf-8'),
        new TextDecoder('shift-jis')
      ];

      let resultsCsv = '';
      let usedSjis = false;

      // Try decoding with UTF-8 first
      try {
        const decoded = decoders[0].decode(buffer);
        // \ufffd is the replacement character for invalid UTF-8
        // 'ｿ' (half-width so) is often a sign of mojibake when S-JIS is read as UTF-8
        if (decoded.includes('\ufffd') || decoded.includes('ｿ')) {
          resultsCsv = decoders[1].decode(buffer);
          usedSjis = true;
        } else {
          resultsCsv = decoded;
        }
      } catch (err) {
        resultsCsv = decoders[1].decode(buffer);
        usedSjis = true;
      }

      Papa.parse(resultsCsv, {
        header: true,
        skipEmptyLines: true,
        dynamicTyping: true,
        complete: async (results) => {
          try {
            if (!results.data || results.data.length === 0) {
              throw new Error('CSVファイルにデータが見つかりません');
            }

            const importedWines: WineMaster[] = results.data.map((row: any) => {
              // Normalize keys to handle BOM or whitespace from different CSV exports
              const normalizedRow: any = {};
              Object.keys(row).forEach(key => {
                const cleanKey = key.replace(/^\ufeff/, '').trim();
                normalizedRow[cleanKey] = row[key];
              });

              const getString = (keys: string[]) => {
                const key = keys.find(k => normalizedRow[k] !== undefined && normalizedRow[k] !== null);
                if (!key) return '';
                const val = normalizedRow[key];
                return String(val).trim();
              };
              const getNumber = (keys: string[]) => {
                const key = keys.find(k => normalizedRow[k] !== undefined && normalizedRow[k] !== null);
                if (!key) return 0;
                const val = normalizedRow[key];
                if (typeof val === 'number') return val;
                const strVal = String(val).replace(/[^0-9.]/g, '');
                return parseFloat(strVal) || 0;
              };

              return {
                id: getString(['id', 'ID', '商品コード', 'コード']),
                name_jp: getString(['name_jp', '商品名', '名称']),
                name_en: getString(['name_en', 'English Name']),
                country: getString(['country', '国']),
                region: getString(['region', '地域']),
                grape: getString(['grape', '品種']),
                color: getString(['color', '色']),
                type: getString(['type', 'タイプ']),
                vintage: getString(['vintage', 'ヴィンテージ']),
                alcohol: getString(['alcohol', 'アルコール']),
                price_bottle: getNumber(['price_bottle', '参考価格', 'ボトル価格']),
                price_glass: getNumber(['price_glass', 'グラス価格']),
                cost: getNumber(['cost', '仕入原価', 'コスト']),
                stock: getNumber(['stock', '在庫']),
                ideal_stock: getNumber(['ideal_stock', '適正在庫']),
                supplier: getString(['supplier', 'サプライヤー']),
                storage: getString(['storage', '保存場所']),
                ai_explanation: getString(['ai_explanation', 'AI解説']),
                menu_short: getString(['menu_short', 'メニュー用略称']),
                pairing: getString(['pairing', 'ペアリング']),
                sweetness: getNumber(['sweetness', '甘味']),
                body: getNumber(['body', 'ボディ']),
                acidity: getNumber(['acidity', '酸味']),
                tannins: getNumber(['tannins', 'タンニン']),
                aroma_intensity: getNumber(['aroma_intensity', '香りの強さ']),
                complexity: getNumber(['complexity', '複雑さ']),
                finish: getNumber(['finish', '余韻']),
                oak: getNumber(['oak', '樽感']),
                aroma_features: getString(['aroma_features', '香りの特徴']),
                tags: getString(['tags', 'タグ']),
                best_drinking: getString(['best_drinking', '飲み頃']),
                image_url: getString(['image_url', '画像URL']),
                visible: normalizedRow.visible === 'ON' || normalizedRow.visible === true || getString(['visible']) === 'ON',
                glasses_per_bottle: getNumber(['glasses_per_bottle', '杯数']) || 6
              };
            }).filter(w => w.id !== '');

            if (importedWines.length === 0) {
              throw new Error('有効な商品IDを持つデータがありませんでした');
            }

            setWines(importedWines);
            
            // インポートした全銘柄を Firestore の winesMaster コレクションに保存 (チャンク分割して実行)
            const CHUNK_SIZE = 50;
            for (let i = 0; i < importedWines.length; i += CHUNK_SIZE) {
              const chunk = importedWines.slice(i, i + CHUNK_SIZE);
              const saveMasterPromises = chunk.map(wine => {
                return setDoc(doc(db, 'winesMaster', wine.id), wine);
              });
              await Promise.all(saveMasterPromises);
              console.log(`[Import] Saved master chunk ${i / CHUNK_SIZE + 1}...`);
            }

            // If a store is selected, also add these wines to the store's inventory in Firestore
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
                console.log(`[Import] Saved inventory chunk ${i / CHUNK_SIZE + 1} for store ${selectedStoreId}...`);
              }
              await fetchStoreInventory(selectedStoreId);
            }

            setImportStatus({ 
              type: 'success', 
              message: `${importedWines.length}件の銘柄データをインポートしました${usedSjis ? '(Shift-JIS)' : ''}` 
            });
          } catch (error: any) {
            console.error('Import error:', error);
            setImportStatus({ type: 'error', message: `インポート失敗: ${error.message}` });
          } finally {
            setIsImporting(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
          }
        },
        error: (error) => {
          setImportStatus({ type: 'error', message: `解析エラー: ${error.message}` });
          setIsImporting(false);
        }
      });
    };
    reader.onerror = () => {
      setImportStatus({ type: 'error', message: 'ファイルの読み込みに失敗しました' });
      setIsImporting(false);
    };
    reader.readAsArrayBuffer(file);
  };

  const handleSaveInventory = async () => {
    if (!selectedStoreId) return;
    
    try {
      // For each selected wine, save to inventory subcollection
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

  const chartData = selectedWines.map(w => {
    const { profit, costRatio } = calculateProfit(w.cost, w.price_bottle);
    return {
      name: w.name_jp.substring(0, 10),
      profit,
      costRatio: Math.round(costRatio),
      cost: w.cost
    };
  });

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
            <div className="space-y-6">
              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="relative flex-1 w-full">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input 
                    placeholder="ワイン名でマスターを検索 (前方一致)..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-full pl-12 pr-6 py-3 text-sm outline-none focus:border-brand-wine transition-all"
                    value={masterSearchTerm}
                    onChange={e => handleSearchMaster(e.target.value)}
                  />
                </div>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  全 {wines.length} 銘柄登録済み
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {wines.map(wine => (
                  <div key={wine.id} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex gap-4 group hover:border-brand-wine transition-all">
                    <div className="w-16 h-24 bg-slate-50 rounded-xl flex items-center justify-center p-2 border border-slate-100 shrink-0">
                      <img src={wine.image_url} alt="" className="h-full object-contain" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[9px] font-bold text-brand-gold uppercase tracking-widest">{wine.country} • {wine.vintage}</div>
                      <h4 className="font-bold text-slate-900 text-sm mb-1 truncate">{wine.name_jp}</h4>
                      <p className="text-[10px] text-slate-500 font-mono italic mb-2">{wine.grape}</p>
                      <div className="flex items-center justify-between mt-auto">
                        <span className="text-xs font-bold text-slate-700">Code: {wine.id}</span>
                        <span className="text-xs font-serif text-brand-wine">¥{wine.price_bottle?.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 md:gap-8">
                {stores.map(store => (
                  <motion.div
                    key={store.id}
                    whileHover={{ y: -8, boxShadow: "0 20px 25px -5px rgb(0 0 0 / 0.1)" }}
                    onClick={() => setSelectedStoreId(store.id)}
                    className="bg-white p-8 rounded-3xl border border-slate-200 cursor-pointer transition-all flex flex-col justify-between h-56 shadow-sm group"
                  >
                        <div>
                          <div className="flex justify-between items-start mb-6">
                             <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center border border-slate-100 group-hover:bg-brand-wine group-hover:text-white transition-colors shadow-inner">
                               <Wine className="w-7 h-7" />
                             </div>
                      <div className="flex flex-col items-end gap-2 relative z-50">
                               <span className={`text-[9px] font-bold uppercase tracking-widest px-3 py-1 rounded-full ${store.isActive ? 'bg-green-50 text-green-600 border border-green-100' : 'bg-red-50 text-red-600 border border-red-100'}`}>
                                 {store.isActive ? '稼働中' : '停止中'}
                               </span>
                               <button 
                                 onClick={(e) => {
                                   e.stopPropagation();
                                   handleDeleteStore(store.id);
                                 }}
                                 className="flex items-center justify-center p-2.5 bg-red-500 text-white rounded-full hover:bg-red-600 transition-all shadow-lg active:scale-95 pointer-events-auto"
                                 title="店舗を削除"
                                 style={{ pointerEvents: 'auto' }}
                               >
                                 <Trash2 className="w-4 h-4" />
                               </button>
                             </div>
                          </div>
                          <h3 className="serif text-xl text-slate-900 group-hover:text-brand-wine transition-colors">{store.name}</h3>
                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em] mt-1">{store.cuisine_type}</p>
                        </div>
                    <div className="flex items-center justify-between mt-6 pt-6 border-t border-slate-50">
                      <div className="flex flex-col">
                        <span className="text-[9px] text-slate-400 font-bold uppercase tracking-tighter">稼働状況</span>
                        <span className="text-xs font-bold text-slate-700">{store.isActive ? '営業中' : '停止中'}</span>
                      </div>
                    </div>
                  </motion.div>
                ))}
                
                {hasMoreStores && (
                  <div className="col-span-full py-10 flex justify-center">
                    <button 
                      onClick={handleLoadMoreStores}
                      className="px-10 py-4 bg-white border border-slate-200 rounded-full text-xs font-bold uppercase tracking-widest text-slate-500 hover:border-brand-wine hover:text-brand-wine transition-all shadow-sm"
                    >
                      さらに読み込む (12件ずつ)
                    </button>
                  </div>
                )}

                {stores.length === 0 && (
                <div className="col-span-full py-32 text-center bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
                   <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm">
                      <Shield className="w-10 h-10 text-slate-200" />
                   </div>
                   <p className="serif italic text-2xl text-slate-300">管理店舗が登録されていません</p>
                   <button onClick={handleCreateStore} className="mt-8 text-brand-wine font-bold uppercase text-xs tracking-widest hover:underline">最初の店舗を登録する</button>
                </div>
              )}
            </div>
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
                <div className="flex items-center justify-between bg-white p-3 rounded-lg border border-slate-200">
                  <div>
                    <div className="text-[10px] font-bold text-slate-700 uppercase tracking-wider">AIソムリエ機能</div>
                    <div className="text-[8px] text-slate-400 font-bold uppercase">有効にするとAI相談が可能</div>
                  </div>
                  <button 
                    onClick={() => setEditStoreData({...editStoreData, hasAiSommelier: !editStoreData.hasAiSommelier})}
                    className={`w-10 h-5 rounded-full transition-all relative ${editStoreData.hasAiSommelier ? 'bg-brand-gold' : 'bg-slate-300'}`}
                  >
                    <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${editStoreData.hasAiSommelier ? 'right-0.5' : 'left-0.5'}`} />
                  </button>
                </div>
                <div className="flex flex-col items-center justify-center bg-white p-6 rounded-2xl border border-slate-200 shadow-inner">
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4">モバイル用QRコード</div>
                  <div className="p-3 bg-white border border-slate-100 rounded-xl shadow-lg mb-4">
                    <img 
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(window.location.origin + '/menu/' + selectedStoreId)}`}
                      alt="Store QR Code"
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
                      onClick={() => window.open(`/menu/${selectedStoreId}`, '_blank')}
                      className="w-full py-3 bg-brand-gold text-brand-wine rounded-xl text-[10px] font-bold uppercase tracking-widest hover:brightness-110 flex items-center justify-center gap-2 shadow-sm"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      お客様メニューを表示
                    </button>
                    <button 
                      onClick={() => {
                        const url = window.location.origin + '/menu/' + selectedStoreId;
                        navigator.clipboard.writeText(url);
                        alert('URLをコピーしました');
                      }}
                      className="w-full py-2 bg-slate-100 text-slate-600 rounded-lg text-[9px] font-bold uppercase tracking-widest hover:bg-slate-200 transition-all border border-slate-200"
                    >
                      URLをコピー
                    </button>
                    <div className="h-px bg-slate-200 my-2" />
                    <button 
                      onClick={() => handleDeleteStore(selectedStoreId)}
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
                        hasAiSommelier: selectedStore?.hasAiSommelier ?? true
                      });
                      setIsEditingStore(true);
                    }}
                    className="p-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-500 hover:text-slate-900 transition-all border border-slate-200"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={async () => {
                      if (selectedStoreId) {
                        const newHasAi = !selectedStore?.hasAiSommelier;
                        try {
                          await updateDoc(doc(db, 'stores', selectedStoreId), { hasAiSommelier: newHasAi });
                          await refreshStores();
                        } catch (e) {
                          console.error("Failed to toggle AI Sommelier", e);
                        }
                      }
                    }}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-[10px] font-bold uppercase transition-all ${
                      selectedStore?.hasAiSommelier !== false 
                        ? 'border-brand-gold bg-brand-gold/10 text-brand-gold' 
                        : 'border-slate-300 bg-slate-50 text-slate-400'
                    }`}
                  >
                    <Sparkles className="w-3 h-3" />
                    AI: {selectedStore?.hasAiSommelier !== false ? 'ON' : 'OFF'}
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
        {/* Master Catalog Selection List */}
        {showCatalogSelection && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 md:p-8">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white rounded-[40px] w-full max-w-5xl max-h-[85vh] flex flex-col overflow-hidden shadow-2xl"
            >
              <div className="p-8 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h2 className="serif text-2xl text-slate-900">マスターからワインを選択</h2>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">選択中の店舗: {selectedStore?.name}</p>
                </div>
                <button 
                  onClick={() => setShowCatalogSelection(false)}
                  className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-900 transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="p-8 bg-slate-50 border-b border-slate-100">
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input 
                    placeholder="ワイン名、国、品種、コードで検索..."
                    className="w-full bg-white border border-slate-200 rounded-2xl pl-12 pr-6 py-4 text-sm outline-none focus:border-brand-wine shadow-sm transition-all"
                    value={masterSearchTerm}
                    onChange={e => setMasterSearchTerm(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 md:p-8">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {wines.filter(w => 
                    w.name_jp.toLowerCase().includes(masterSearchTerm.toLowerCase()) ||
                    w.name_en.toLowerCase().includes(masterSearchTerm.toLowerCase()) ||
                    w.country.toLowerCase().includes(masterSearchTerm.toLowerCase()) ||
                    w.grape.toLowerCase().includes(masterSearchTerm.toLowerCase()) ||
                    w.id.toLowerCase().includes(masterSearchTerm.toLowerCase())
                  ).map(wine => {
                    const isAlreadySelected = selectedWines.some(sw => sw.id === wine.id);
                    const isChecked = selectedMasterIds.includes(wine.id);
                    return (
                      <div 
                        key={wine.id} 
                        onClick={() => !isAlreadySelected && toggleMasterSelection(wine.id)}
                        className={`bg-white p-6 rounded-3xl border transition-all flex gap-4 group cursor-pointer ${
                          isAlreadySelected 
                            ? 'border-slate-100 opacity-40 grayscale cursor-not-allowed' 
                            : isChecked 
                              ? 'border-brand-wine bg-brand-wine/5 shadow-md ring-2 ring-brand-wine/10' 
                              : 'border-slate-200 hover:border-brand-wine shadow-sm hover:shadow-md'
                        }`}
                      >
                        <div className="flex flex-col items-center gap-4 shrink-0">
                          <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${
                            isChecked ? 'bg-brand-wine border-brand-wine text-white' : 'border-slate-200 bg-white'
                          }`}>
                            {isChecked && <CheckCircle2 className="w-4 h-4" />}
                          </div>
                          <div className="w-16 h-24 bg-slate-50 rounded-xl flex items-center justify-center p-2 border border-slate-100">
                            <img src={wine.image_url} alt="" className="h-full object-contain" />
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-[9px] font-bold text-brand-gold uppercase tracking-widest">{wine.country} • {wine.vintage}</div>
                          <h4 className="font-bold text-slate-900 text-xs mb-1 line-clamp-2">{wine.name_jp}</h4>
                          <p className="text-[10px] text-slate-500 font-mono italic mb-2">{wine.grape}</p>
                          <div className="flex items-center justify-between mt-auto">
                            <span className="text-[10px] font-bold text-slate-400">¥{wine.price_bottle?.toLocaleString()}</span>
                            {isAlreadySelected && (
                              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">追加済み</span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {hasMoreWines && (
                  <div className="py-10 flex justify-center">
                    <button 
                      onClick={handleLoadMoreWines}
                      className="px-10 py-4 bg-slate-50 border border-slate-200 rounded-full text-[10px] font-bold uppercase tracking-widest text-slate-500 hover:border-brand-wine hover:text-brand-wine transition-all shadow-sm"
                    >
                      さらにマスターデータを読み込む
                    </button>
                  </div>
                )}
              </div>

              <div className="p-8 border-t border-slate-100 bg-white flex items-center justify-between">
                <div className="text-sm font-bold text-slate-600">
                  {selectedMasterIds.length > 0 ? (
                    <span className="text-brand-wine animate-in fade-in zoom-in">{selectedMasterIds.length}件 選択中</span>
                  ) : '追加するワインを選択してください'}
                </div>
                <div className="flex gap-4">
                  <button 
                    onClick={() => {
                       setShowCatalogSelection(false);
                       setSelectedMasterIds([]);
                    }}
                    className="px-8 py-3 bg-slate-100 text-slate-600 rounded-full text-[11px] font-bold uppercase tracking-widest hover:bg-slate-200 transition-all"
                  >
                    キャンセル
                  </button>
                  <button 
                    onClick={handleBulkAddWines}
                    disabled={selectedMasterIds.length === 0}
                    className="px-8 py-3 bg-brand-wine text-white rounded-full text-[11px] font-bold uppercase tracking-widest hover:scale-105 transition-all shadow-lg active:scale-95 disabled:opacity-30 disabled:scale-100"
                  >
                    選択したワインを追加
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {importStatus && (
          <div className={`p-4 rounded-xl flex items-center gap-3 animate-in slide-in-from-top duration-500 ${
            importStatus.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
          }`}>
            {importStatus.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
            <span className="text-xs font-bold uppercase tracking-widest">{importStatus.message}</span>
            <button onClick={() => setImportStatus(null)} className="ml-auto text-[10px] font-bold opacity-60 hover:opacity-100"><X className="w-4 h-4" /></button>
          </div>
        )}

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-8">
          <div className="bg-white p-6 md:p-8 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
            <p className="text-[10px] md:text-xs uppercase text-slate-400 font-bold mb-2 tracking-widest">登録銘柄数</p>
            <h3 className="text-3xl md:text-4xl font-serif text-slate-900">{selectedWines.length.toLocaleString()} <span className="text-base md:text-lg text-slate-400">銘柄</span></h3>
            <div className="mt-6 h-1.5 md:h-2 w-full bg-slate-100 rounded-full overflow-hidden">
              <div 
                className="h-full bg-brand-wine shadow-sm transition-all duration-1000" 
                style={{ width: `${Math.min((selectedWines.length / 50) * 100, 100)}%` }}
              ></div>
            </div>
          </div>
          <div className="bg-white p-6 md:p-8 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
            <p className="text-[10px] md:text-xs uppercase text-slate-400 font-bold mb-2 tracking-widest">平均原価率</p>
            <h3 className="text-3xl md:text-4xl font-serif text-slate-900">
              {selectedWines.length > 0 
                ? `${(selectedWines.reduce((acc, w) => acc + (w.price_bottle > 0 ? (w.cost / w.price_bottle) * 100 : 0), 0) / selectedWines.length).toFixed(1)}%`
                : "0.0%"
              }
            </h3>
            <div className="text-xs md:text-sm text-green-600 font-bold mt-4 uppercase flex items-center gap-1">
              <TrendingUp className="w-4 h-4" /> 適正範囲内
            </div>
          </div>
          <div className="bg-white p-6 md:p-8 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
            <p className="text-[10px] md:text-xs uppercase text-slate-400 font-bold mb-2 tracking-widest">高収益アイテム割合</p>
            <h3 className="text-3xl md:text-4xl font-serif text-slate-900">
              {selectedWines.length > 0 
                ? `${Math.round((selectedWines.filter(w => w.price_bottle >= w.cost * 3).length / selectedWines.length) * 100)}%`
                : "0%"
              }
            </h3>
            <p className="text-xs md:text-sm text-slate-500 mt-4 italic font-serif truncate">
              {selectedWines.length > 0 ? "原価率33%以下の銘柄比率" : "データ未登録"}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-12">
          <div className="lg:col-span-8 space-y-6 md:space-y-8">
            <div className="bg-white rounded-3xl overflow-hidden flex flex-col shadow-sm border border-slate-200">
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
                      list="master-wines-list"
                      placeholder="マスターからワインを検索・追加..."
                      value={searchId}
                      onChange={(e) => setSearchId(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAddWine()}
                      className="pl-12 pr-4 py-2 bg-white border border-slate-300 rounded-full text-[10px] md:text-xs w-full md:w-56 lg:w-80 text-slate-900 outline-none focus:ring-2 focus:ring-brand-wine/10 focus:border-brand-wine transition-all"
                    />
                    <datalist id="master-wines-list">
                      {wines.filter(w => !selectedWines.some(sw => sw.id === w.id)).map(w => (
                        <option key={w.id} value={w.id}>{w.name_jp} ({w.country})</option>
                      ))}
                    </datalist>
                  </div>
                  <button
                    onClick={() => setShowCatalogSelection(true)}
                    className="bg-brand-gold text-brand-wine p-2 md:p-2.5 rounded-full hover:scale-110 transition-all shadow-md active:scale-95 shrink-0"
                    title="マスターから追加"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                  
                  <div className="hidden md:block h-6 w-[1px] bg-slate-300 mx-1 md:mx-2"></div>
                  
                  <input 
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    className="hidden"
                    accept=".csv"
                  />
                  <div className="flex gap-2 w-full sm:w-auto mt-2 sm:mt-0">
                    <button 
                      onClick={() => fileInputRef.current?.click()}
                      className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 md:px-4 py-2 bg-slate-800 text-white rounded-xl text-[9px] md:text-xs font-bold uppercase tracking-widest hover:bg-slate-700 transition-all shadow-md"
                    >
                      <Upload className="w-4 h-4 shrink-0" /> <span className="truncate">CSV読み込み</span>
                    </button>
                    <button
                      onClick={handleSaveInventory}
                      className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 md:px-4 py-2 border-2 border-brand-wine text-brand-wine rounded-xl text-[9px] md:text-xs font-bold uppercase tracking-widest hover:bg-brand-wine hover:text-white transition-all shadow-sm"
                    >
                      <Save className="w-4 h-4 shrink-0" /> <span className="truncate">保存</span>
                    </button>
                  </div>
                </div>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="text-[10px] uppercase text-slate-400 border-b border-slate-100 bg-slate-50/50">
                      <th className="px-8 py-5 font-bold">ワイン銘柄</th>
                      <th className="px-4 py-5 font-bold">仕入れ原価(税別)</th>
                      <th className="px-4 py-5 font-bold">ボトル設定</th>
                      <th className="px-4 py-5 font-bold">グラス設定</th>
                      <th className="px-4 py-5 font-bold text-center">メニュー表示</th>
                      <th className="px-8 py-5 font-bold text-right">操作</th>
                    </tr>
                  </thead>
                  <tbody className="text-xs">
                    {selectedWines.map((wine, idx) => {
                      const bottleStats = calculateProfit(wine.cost, wine.price_bottle);
                      const glassStats = calculateGlassProfit(wine.cost, wine.price_glass, wine.glasses_per_bottle || 6);
                      return (
                        <tr key={wine.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors group">
                          <td className="px-8 py-6">
                            <div className="font-bold text-slate-800 text-sm mb-1">{wine.name_jp}</div>
                            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">ID: {wine.id} • {wine.region}</div>
                          </td>
                          <td className="px-4 py-6">
                            <input
                              type="number"
                              value={wine.cost}
                              onChange={(e) => {
                                const newWines = [...selectedWines];
                                newWines[idx].cost = parseInt(e.target.value) || 0;
                                setSelectedWines(newWines);
                              }}
                              className="w-24 bg-white border border-slate-200 rounded px-2 py-1.5 focus:border-brand-wine outline-none font-mono text-slate-600 text-center"
                            />
                          </td>
                          <td className="px-4 py-6">
                            <div className="flex items-center gap-4">
                               <div className="relative group">
                                 <input
                                  type="number"
                                  value={wine.price_bottle}
                                  onChange={(e) => {
                                    const newWines = [...selectedWines];
                                    newWines[idx].price_bottle = parseInt(e.target.value) || 0;
                                    setSelectedWines(newWines);
                                  }}
                                  className="w-28 bg-white border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-brand-wine/10 focus:border-brand-wine outline-none font-mono text-slate-900 font-bold text-center"
                                />
                               </div>
                              <div className="flex flex-col min-w-[70px]">
                                <span className="font-bold text-brand-wine font-mono text-sm leading-none">¥{bottleStats.profit.toLocaleString()}</span>
                                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter mt-1">原価率 {Math.round(bottleStats.costRatio)}%</span>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-6">
                            <div className="flex flex-col gap-2">
                              <div className="flex items-center gap-2">
                                <span className="text-[9px] font-bold text-slate-400 w-8">価格</span>
                                <input
                                  type="number"
                                  value={wine.price_glass}
                                  onChange={(e) => {
                                    const newWines = [...selectedWines];
                                    newWines[idx].price_glass = parseInt(e.target.value) || 0;
                                    setSelectedWines(newWines);
                                  }}
                                  className="w-20 bg-white border border-slate-300 rounded px-2 py-1 text-sm font-mono text-slate-900 text-center"
                                />
                                <div className="flex flex-col">
                                  <span className="font-bold text-brand-wine font-mono text-xs">¥{glassStats.profit.toLocaleString()}</span>
                                  <span className="text-[9px] text-slate-400 font-bold uppercase tracking-tighter">原価率 {Math.round(glassStats.costRatio)}%</span>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-[9px] font-bold text-slate-400 w-8">取数</span>
                                <input
                                  type="number"
                                  value={wine.glasses_per_bottle || 6}
                                  onChange={(e) => {
                                    const newWines = [...selectedWines];
                                    newWines[idx].glasses_per_bottle = parseInt(e.target.value) || 6;
                                    setSelectedWines(newWines);
                                  }}
                                  className="w-20 bg-slate-50 border border-slate-300 rounded px-2 py-1 text-xs font-mono text-slate-600 text-center"
                                />
                                <span className="text-[9px] font-bold text-slate-400 tracking-widest">杯/BTL</span>
                              </div>
                            </div>
                          </td>
                          <td className="px-8 py-6 text-right">
                             <button 
                               onClick={() => {
                                 const newWines = [...selectedWines];
                                 newWines[idx].visible = !newWines[idx].visible;
                                 setSelectedWines(newWines);
                               }}
                               className={`px-4 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest border transition-all ${
                                 wine.visible 
                                   ? 'bg-green-50 border-green-200 text-green-700 hover:bg-green-100' 
                                   : 'bg-slate-100 border-slate-200 text-slate-400 hover:bg-slate-200'
                               }`}
                             >
                               {wine.visible ? '● 表示' : '○ 非表示'}
                             </button>
                          </td>
                          <td className="px-4 py-6">
                             <div className="flex flex-col gap-2">
                               <button 
                                 onClick={() => {
                                   const newWines = [...selectedWines];
                                   newWines[idx].isFeatured = !newWines[idx].isFeatured;
                                   setSelectedWines(newWines);
                                 }}
                                 className={`px-2 py-1 rounded text-[8px] font-bold uppercase transition-all border ${
                                   wine.isFeatured ? 'bg-amber-50 border-amber-200 text-amber-600' : 'bg-slate-50 border-slate-200 text-slate-400'
                                 }`}
                               >
                                 ★ Featured
                               </button>
                               <input 
                                 placeholder="Promo Label"
                                 className="text-[8px] bg-slate-50 border border-slate-200 rounded px-2 py-1 outline-none focus:border-brand-wine"
                                 value={wine.promoLabel || ''}
                                 onChange={(e) => {
                                   const newWines = [...selectedWines];
                                   newWines[idx].promoLabel = e.target.value;
                                   setSelectedWines(newWines);
                                 }}
                               />
                             </div>
                          </td>
                          <td className="px-8 py-6 text-right">
                             <button 
                               onClick={() => handleDeleteWine(wine.id)}
                               className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                             >
                               <Trash2 className="w-4 h-4" />
                             </button>
                          </td>
                        </tr>
                      );
                    })}
                    {selectedWines.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-8 py-24 text-center">
                          <Wine className="w-12 h-12 text-slate-100 mx-auto mb-6" />
                          <p className="font-serif italic text-xl text-slate-300">銘柄を選択、またはCSVを読み込んで開始します</p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="lg:col-span-4 space-y-8">
            <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
               <div className="flex items-center gap-3 mb-8 border-b border-slate-100 pb-5">
                  <BarChart3 className="text-brand-wine w-5 h-5" />
                  <h2 className="text-xs font-bold uppercase tracking-widest text-slate-800">収益分析プロファイル</h2>
               </div>
                <div className="mt-8 relative w-full bg-slate-50/50 rounded-2xl border border-slate-100 flex items-center justify-center overflow-hidden" style={{ height: '256px', minHeight: '256px' }}>
                  {chartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={256} minWidth={0}>
                      <BarChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 20 }}>
                        <XAxis 
                          dataKey="name" 
                          hide={true}
                        />
                        <Tooltip 
                          cursor={{ fill: 'rgba(0,0,0,0.02)' }}
                          contentStyle={{ backgroundColor: '#fff', borderRadius: '16px', border: '1px solid #e2e8f0', color: '#334155', fontSize: '11px', fontWeight: 'bold', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                          labelFormatter={(value) => `銘柄: ${value}`}
                          formatter={(value) => [`¥${value}`, '利益']}
                        />
                        <Bar dataKey="profit" fill="#581C28" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="text-center">
                       <BarChart3 className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                       <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">分析データ不足</p>
                    </div>
                  )}
                </div>
            </div>

            <div className="bg-brand-gold/10 p-8 rounded-3xl border border-brand-gold shadow-sm overflow-hidden relative group">
              <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                <Shield className="w-32 h-32 text-brand-gold" />
              </div>
              <h3 className="serif text-2xl text-brand-wine mb-3 relative z-10">AIコンサルティング</h3>
              <p className="text-[10px] text-brand-wine/60 uppercase tracking-widest mb-8 relative z-10 font-bold">RAG Analytics engine v2.0</p>
              <div className="space-y-6 relative z-10">
                 <div className="text-[15px] font-medium leading-relaxed border-l-4 border-brand-wine pl-6 text-slate-800 font-serif">
                   "現在のシミュレーション結果により、ワインリストの平均原価率は適正範囲内にあります。プレミアムセグメントの比率をあと12%増やすことで、目標利益への最短ルートが構築可能です。"
                 </div>
                 <button className="w-full py-4 rounded-2xl bg-brand-wine text-white text-[11px] font-bold uppercase tracking-[0.2em] hover:scale-[1.02] transition-all shadow-lg active:scale-95">
                   詳細レポートを出力
                 </button>
              </div>
            </div>

            <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
               <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-2">
                     <Key className="text-brand-wine w-5 h-5" />
                     <h2 className="text-xs font-bold uppercase tracking-widest text-slate-800">店舗統括アカウント</h2>
                  </div>
                  <button 
                    onClick={() => {
                      if (selectedStore?.ownerId) {
                        setOwnerEmail(selectedStore.owner_email || '');
                        setIsEditingOwner(true);
                      } else {
                        setIsEditingOwner(false);
                      }
                      setShowOwnerForm(!showOwnerForm);
                    }}
                    className="text-[10px] font-bold uppercase tracking-widest text-brand-wine hover:underline"
                  >
                    {showOwnerForm ? 'キャンセル' : (selectedStore?.ownerId ? '編集' : '新規登録')}
                  </button>
               </div>

               {selectedStore?.ownerId && !showOwnerForm ? (
                  <div className="space-y-4">
                     <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-200">
                        <div className="w-10 h-10 rounded-full bg-brand-wine/10 flex items-center justify-center">
                           <Shield className="w-5 h-5 text-brand-wine" />
                        </div>
                        <div>
                           <p className="text-[10px] text-brand-wine font-bold uppercase tracking-widest">Active Store Admin</p>
                           <p className="text-sm text-slate-700 font-bold">{selectedStore.owner_email}</p>
                        </div>
                     </div>
                     <p className="text-[10px] text-slate-400 italic font-medium leading-relaxed">このアカウントは店舗側のメニュー管理と在庫更新にのみアクセスが可能です。</p>
                  </div>
               ) : showOwnerForm ? (
                  <div className="space-y-6 animate-in slide-in-from-top duration-300">
                     <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 space-y-4">
                       <div>
                          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">ログイン ID / メール</label>
                          <input 
                            type="text"
                            placeholder="store_manager_id"
                            value={ownerEmail}
                            onChange={(e) => setOwnerEmail(e.target.value)}
                            className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 focus:border-brand-wine outline-none shadow-sm"
                          />
                       </div>
                       <div>
                          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">
                            {isEditingOwner ? '新パスワード (変更時のみ)' : '初期パスワード'}
                          </label>
                          <input 
                            type="password"
                            placeholder={isEditingOwner ? '未入力なら維持' : '6文字以上'}
                            value={ownerPassword}
                            onChange={(e) => setOwnerPassword(e.target.value)}
                            className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 focus:border-brand-wine outline-none shadow-sm"
                          />
                       </div>
                       <button 
                         onClick={handleCreateOwner}
                         disabled={isCreatingOwner}
                         className="w-full bg-brand-wine text-white py-3.5 rounded-xl text-[10px] font-bold uppercase tracking-widest flex items-center justify-center gap-2 hover:brightness-110 active:scale-95 transition-all shadow-lg"
                       >
                         {isCreatingOwner ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                         {isEditingOwner ? '情報を更新' : 'アカウントを発行'}
                       </button>
                     </div>
                  </div>
               ) : (
                  <div className="py-12 text-center border-2 border-dashed border-slate-200 rounded-3xl bg-slate-50/50">
                     <p className="text-[11px] text-slate-400 uppercase tracking-widest mb-6 font-bold">オーナーアカウント未設定</p>
                     <button 
                       onClick={() => setShowOwnerForm(true)}
                       className="mx-auto flex items-center gap-3 px-6 py-3 bg-white border-2 border-brand-wine text-brand-wine rounded-full text-[10px] font-bold uppercase tracking-widest hover:bg-brand-wine hover:text-white transition-all shadow-sm"
                     >
                       <UserPlus className="w-4 h-4" />
                       発行画面へ
                     </button>
                  </div>
               )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

