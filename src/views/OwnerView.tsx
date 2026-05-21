import React, { useState, useEffect } from 'react';
import { WineMaster, Store } from '../types';
import { Wine, Camera, MessageSquare, Save, Eye, EyeOff, Loader2, X, Trash2, Plus, Search, Edit2, CheckCircle2, AlertCircle, Sparkles } from 'lucide-react';
import { useWines } from '../lib/WineContext';
import { db } from '../lib/firebase';
import { collection, getDocs, doc, getDoc, updateDoc, deleteDoc, setDoc, writeBatch } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';
import { useQueryClient } from '@tanstack/react-query';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts';
import { calculateProfit } from '../lib/profit-calc';
import { motion, AnimatePresence } from 'motion/react';
import { wineRepository } from '../lib/repositories/wineRepository';
import { useStoresQuery } from '../hooks/useStoresQuery';
import { useInventoryQuery, useInventoryMutations } from '../hooks/useInventoryQuery';
import { useWinesMasterQuery } from '../hooks/useWinesQuery';

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

  const { data: masterWinesData } = useWinesMasterQuery();
  const masterWines = masterWinesData?.pages.flatMap(p => p.data) || [];

  const [showAddModal, setShowAddModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isEditingStore, setIsEditingStore] = useState(false);
  const [editStoreData, setEditStoreData] = useState<Partial<Store>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [editingWineId, setEditingWineId] = useState<string | null>(null);

  const [invSupplierFilter, setInvSupplierFilter] = useState<string>('all');
  const [invCountryFilter, setInvCountryFilter] = useState<string>('all');
  const [invColorFilter, setInvColorFilter] = useState<string>('all');
  const [invSearchTerm, setInvSearchTerm] = useState('');

  const invCountries = React.useMemo(() => {
    const set = new Set(inventory.map(w => w.country).filter(Boolean));
    return Array.from(set).sort();
  }, [inventory]);

  const filteredInventory = React.useMemo(() => {
    return inventory.filter(w => {
      const search = invSearchTerm.toLowerCase();
      const matchesSearch = !search || 
        w.name_jp.toLowerCase().includes(search) ||
        w.name_en.toLowerCase().includes(search) ||
        (w.region || '').toLowerCase().includes(search) ||
        (w.grape || '').toLowerCase().includes(search) ||
        w.id.toLowerCase().includes(search);

      const s = (w.supplier || 'PIEROTH').toUpperCase();
      const matchesSupplier = invSupplierFilter === 'all' || s === invSupplierFilter;
      const matchesCountry = invCountryFilter === 'all' || w.country === invCountryFilter;
      const matchesColor = invColorFilter === 'all' || (w.color || '').toLowerCase() === invColorFilter.toLowerCase();

      return matchesSearch && matchesSupplier && matchesCountry && matchesColor;
    });
  }, [inventory, invSearchTerm, invSupplierFilter, invCountryFilter, invColorFilter]);

  useEffect(() => {
    if (store) {
      setEditStoreData(store);
    }
  }, [store]);

  const getWineDocId = (wine: { id: string; supplier?: string; pureId?: string }) => {
    const pure = wine.pureId || wine.id;
    const supplier = (wine.supplier || 'PIEROTH').toUpperCase();
    const supplierPrefix = `${supplier}_`;
    if (pure.startsWith(supplierPrefix)) return pure;
    return `${supplierPrefix}${pure}`;
  };

  const [editWineData, setEditWineData] = useState<{
    price_bottle: number;
    price_glass: number;
    stock: number;
    glasses_per_bottle: number;
    visible: boolean;
    isFeatured: boolean;
    promoLabel: string;
  }>({ 
    price_bottle: 0, 
    price_glass: 0, 
    stock: 0,
    glasses_per_bottle: 6,
    visible: true,
    isFeatured: false,
    promoLabel: ''
  });

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

  const sid = selectedStoreId;

  const projectWineForPublic = (w: any) => ({
    id: getWineDocId(w),
    pureId: w.pureId || w.id,
    supplier: (w.supplier || 'PIEROTH').toUpperCase(),
    name_jp: w.name_jp,
    name_en: w.name_en,
    menu_short: '',
    menu_short_en: '',
    ai_explanation: '',
    ai_explanation_en: '',
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
    aroma_features: '',
    aroma_features_en: '',
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

  const handleSaveAllInventory = async () => {
    if (!sid || inventory.length === 0) return;
    setIsSaving(true);
    try {
      const mergedInventory = inventory.map(w => {
        if (editingWineId && w.id === editingWineId) {
          return {
            ...w,
            price_bottle: editWineData.price_bottle,
            price_glass: editWineData.price_glass,
            stock: editWineData.stock,
            glasses_per_bottle: editWineData.glasses_per_bottle,
            visible: editWineData.visible,
            isFeatured: editWineData.isFeatured,
            promoLabel: editWineData.promoLabel
          };
        }
        return w;
      });

      const richPublicMenu = mergedInventory
        .filter(w => w.visible !== false && w.isActive !== false)
        .map(projectWineForPublic);

      // 【バグ修正】 500件上限を超えるクラッシュを防ぐためチャンク分割書き込みを実装
      const CHUNK_SIZE = 450;
      for (let i = 0; i < mergedInventory.length; i += CHUNK_SIZE) {
        const chunk = mergedInventory.slice(i, i + CHUNK_SIZE);
        const batch = writeBatch(db);
        
        chunk.forEach(wine => {
          const compositeId = getWineDocId(wine);
          const itemRef = doc(db, 'stores', sid, 'inventory', compositeId);
          batch.set(itemRef, {
            id: compositeId,
            pureId: wine.pureId || wine.id,
            supplier: (wine.supplier || 'PIEROTH').toUpperCase(),
            price_bottle: wine.price_bottle || 0,
            price_glass: wine.price_glass || 0,
            stock: wine.stock || 0,
            glasses_per_bottle: wine.glasses_per_bottle || 6,
            visible: wine.visible ?? true,
            isFeatured: wine.isFeatured ?? false,
            promoLabel: wine.promoLabel || '',
            isActive: wine.isActive ?? true,
            updatedAt: new Date().toISOString()
          }, { merge: true });
        });

        if (i + CHUNK_SIZE >= mergedInventory.length) {
          batch.update(doc(db, 'stores', sid), { publicMenu: richPublicMenu });
        }
        await batch.commit();
      }
     
      alert('すべてのセラー情報を一括保存しました。');
      setEditingWineId(null);
      queryClient.invalidateQueries({ queryKey: ['inventory', sid] });
      queryClient.invalidateQueries({ queryKey: ['stores'] });
    } catch (error) {
      console.error('一括保存に失敗しました:', error);
      alert('一括保存に失敗しました。');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleActive = async (wineId: string, currentStatus: boolean) => {
    if (!sid) return;
    const currentData = queryClient.getQueryData<{ store: any, inventory: any[] }>(['inventory', sid]);
    if (!currentData) return;

    const wine = currentData.inventory.find(w => w.id === wineId);
    if (!wine) return;
    const compositeId = getWineDocId(wine);

    const nextInventorySnapshot = currentData.inventory.map(w =>
      getWineDocId(w) === compositeId ? { ...w, isActive: !currentStatus } : w
    );
    queryClient.setQueryData(['inventory', sid], { ...currentData, inventory: nextInventorySnapshot });

    try {
      const batch = writeBatch(db);
      const itemRef = doc(db, 'stores', sid, 'inventory', compositeId);
      batch.update(itemRef, { isActive: !currentStatus, updatedAt: new Date().toISOString() });

      const richPublicMenu = nextInventorySnapshot
        .filter(w => w.visible !== false && w.isActive !== false)
        .map(projectWineForPublic);

      batch.update(doc(db, 'stores', sid), { publicMenu: richPublicMenu });
      await batch.commit();
      queryClient.invalidateQueries({ queryKey: ['inventory', sid] });
      queryClient.invalidateQueries({ queryKey: ['stores'] });
    } catch (error) {
      console.error('Error toggling active status:', error);
      queryClient.invalidateQueries({ queryKey: ['inventory', sid] });
    }
  };

  const handleDeleteWine = async (wineId: string) => {
    if (!sid || !window.confirm('このワインをメニューから削除しますか？')) return;
    const currentData = queryClient.getQueryData<{ store: any, inventory: any[] }>(['inventory', sid]);
    if (!currentData) return;

    const wine = currentData.inventory.find(w => w.id === wineId);
    if (!wine) return;
    const compositeId = getWineDocId(wine);
    
    const nextInventorySnapshot = currentData.inventory.filter(w => getWineDocId(w) !== compositeId);
    queryClient.setQueryData(['inventory', sid], { ...currentData, inventory: nextInventorySnapshot });

    try {
      const batch = writeBatch(db);
      batch.delete(doc(db, 'stores', sid, 'inventory', compositeId));

      const richPublicMenu = nextInventorySnapshot
        .filter(w => w.visible !== false && w.isActive !== false)
        .map(projectWineForPublic);

      batch.update(doc(db, 'stores', sid), { publicMenu: richPublicMenu });
      await batch.commit();
      queryClient.invalidateQueries({ queryKey: ['inventory', sid] });
      queryClient.invalidateQueries({ queryKey: ['stores'] });
    } catch (error) {
      console.error('Error deleting wine:', error);
      queryClient.invalidateQueries({ queryKey: ['inventory', sid] });
    }
  };

  const handleAddWine = async (masterWine: WineMaster) => {
    if (!sid) return;
    const compositeId = getWineDocId(masterWine);
    
    const currentData = queryClient.getQueryData<{ store: any, inventory: any[] }>(['inventory', sid]);
    const inventoryBase = currentData?.inventory || [];

    const newItem = {
      id: compositeId,
      pureId: masterWine.pureId || masterWine.id,
      supplier: (masterWine.supplier || 'PIEROTH').toUpperCase(),
      isActive: true,
      visible: true,
      price_bottle: masterWine.price_bottle || 0,
      price_glass: masterWine.price_glass || 0,
      glasses_per_bottle: 6,
      stock: 0,
      updatedAt: new Date().toISOString()
    };

    const nextInventorySnapshot = [...inventoryBase, { ...masterWine, ...newItem }];
    if (currentData) {
      queryClient.setQueryData(['inventory', sid], { ...currentData, inventory: nextInventorySnapshot });
    }

    try {
      const batch = writeBatch(db);
      batch.set(doc(db, 'stores', sid, 'inventory', compositeId), newItem);

      const richPublicMenu = nextInventorySnapshot
        .filter(w => w.visible !== false && w.isActive !== false)
        .map(projectWineForPublic);

      batch.update(doc(db, 'stores', sid), { publicMenu: richPublicMenu });
      await batch.commit();
      queryClient.invalidateQueries({ queryKey: ['inventory', sid] });
      queryClient.invalidateQueries({ queryKey: ['stores'] });
      setShowAddModal(false);
    } catch (error) {
      console.error('Error adding wine:', error);
      queryClient.invalidateQueries({ queryKey: ['inventory', sid] });
    }
  };

  const startEditingWine = (wine: WineMaster) => {
    setEditingWineId(wine.id);
    setEditWineData({
      price_bottle: wine.price_bottle,
      price_glass: wine.price_glass,
      stock: wine.stock || 0,
      glasses_per_bottle: wine.glasses_per_bottle || 6,
      visible: wine.visible !== false,
      isFeatured: wine.isFeatured || false,
      promoLabel: wine.promoLabel || ''
    });
  };

  const handleToggleFeatured = async (wineId: string, currentFeatured: boolean) => {
    if (!sid) return;
    const currentData = queryClient.getQueryData<{ store: any, inventory: any[] }>(['inventory', sid]);
    if (!currentData) return;

    const wine = currentData.inventory.find(w => w.id === wineId);
    if (!wine) return;
    const compositeId = getWineDocId(wine);

    const nextInventorySnapshot = currentData.inventory.map(w =>
      getWineDocId(w) === compositeId ? { ...w, isFeatured: !currentFeatured } : w
    );
    queryClient.setQueryData(['inventory', sid], { ...currentData, inventory: nextInventorySnapshot });

    try {
      const batch = writeBatch(db);
      const itemRef = doc(db, 'stores', sid, 'inventory', compositeId);
      batch.update(itemRef, { isFeatured: !currentFeatured, updatedAt: new Date().toISOString() });

      const richPublicMenu = nextInventorySnapshot
        .filter(w => w.visible !== false && w.isActive !== false)
        .map(projectWineForPublic);

      batch.update(doc(db, 'stores', sid), { publicMenu: richPublicMenu });
      await batch.commit();
      queryClient.invalidateQueries({ queryKey: ['inventory', sid] });
      queryClient.invalidateQueries({ queryKey: ['stores'] });
    } catch (error) {
      console.error('Error toggling featured status:', error);
      queryClient.invalidateQueries({ queryKey: ['inventory', sid] });
    }
  };

  const filteredMasterWines = masterWines.filter(w => 
    !inventory.some(inv => getWineDocId(inv) === getWineDocId(w)) &&
    (w.name_jp.toLowerCase().includes(searchTerm.toLowerCase()) || 
     w.name_en.toLowerCase().includes(searchTerm.toLowerCase()) ||
     w.id.toLowerCase().includes(searchTerm.toLowerCase()))
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
    <div id="owner-view" className="max-w-4xl mx-auto px-4 py-8 md:py-12 space-y-8 animate-in fade-in duration-700">
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

                {/* New Customization Settings */}
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
        <div className="flex items-center gap-3">
          <button
            onClick={handleSaveAllInventory}
            disabled={isSaving}
            className="bg-transparent border border-brand-gold/50 text-brand-gold hover:bg-brand-gold/10 px-6 py-3 rounded-full text-xs font-bold uppercase tracking-widest flex items-center gap-2 transition-all active:scale-95 shadow-md disabled:opacity-40"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            変更を一括保存
          </button>
          <button 
            onClick={() => setShowAddModal(true)}
            className="bg-brand-gold text-brand-wine px-6 py-3 rounded-full text-xs font-bold uppercase tracking-widest flex items-center gap-2 hover:scale-105 transition-all shadow-luxury active:scale-95"
          >
            <Plus className="w-5 h-5" />
            ワインを追加
          </button>
        </div>
      </header>

      {/* Analytics Dashboard */}
      {inventory.length > 0 && (
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 glass-panel p-6 rounded-3xl border border-brand-gold/10 relative overflow-hidden">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-xs font-bold text-brand-gold-dark uppercase tracking-widest">収益分析：銘柄別利益（ボトル）</h3>
                <p className="text-xs text-gray-500 mt-1 uppercase">利益の高い上位8銘柄を表示</p>
              </div>
            </div>
            <div className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={inventory.map(w => ({ name: w.name_jp.slice(0, 10), profit: w.price_bottle - w.cost })).sort((a,b) => b.profit - a.profit).slice(0, 8)}>
                  <XAxis 
                    dataKey="name" 
                    stroke="#D4AF37" 
                    fontSize={8} 
                    tickLine={false} 
                    axisLine={false}
                    tick={{ fill: '#D4AF37', opacity: 0.6 }}
                  />
                  <YAxis 
                    stroke="#D4AF37" 
                    fontSize={8} 
                    tickLine={false} 
                    axisLine={false} 
                    tickFormatter={(val) => `¥${val/1000}k`}
                    tick={{ fill: '#D4AF37', opacity: 0.6 }}
                  />
                  <Tooltip 
                    cursor={{ fill: 'rgba(212,175,55,0.05)' }}
                    contentStyle={{ 
                      backgroundColor: '#1A0505', 
                      border: '1px solid rgba(212,175,55,0.3)', 
                      borderRadius: '12px', 
                      fontSize: '10px',
                      boxShadow: '0 10px 30px rgba(0,0,0,0.5)'
                    }}
                    itemStyle={{ color: '#D4AF37', fontWeight: 'bold' }}
                    labelStyle={{ color: '#fff', marginBottom: '4px', opacity: 0.6 }}
                    formatter={(value: any) => [`¥${value.toLocaleString()}`, '推定利益']}
                  />
                  <Bar dataKey="profit" name="利益" fill="url(#barGradient)" radius={[6, 6, 0, 0]}>
                    <defs>
                      <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#D4AF37" />
                        <stop offset="100%" stopColor="#8E6E1D" />
                      </linearGradient>
                    </defs>
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="glass-panel p-6 rounded-3xl border border-brand-gold/10 flex flex-col justify-between">
            <div>
              <h3 className="text-xs font-bold text-brand-gold-dark uppercase tracking-widest">原価率別・銘柄構成</h3>
              <p className="text-xs text-gray-500 mt-1 uppercase">平均原価率: {inventory.length > 0 ? Math.round(inventory.reduce((acc, w) => acc + (w.cost / w.price_bottle * 100), 0) / inventory.length) : 0}%</p>
            </div>
            <div className="h-[200px] flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={[
                      { name: '40%以上', value: inventory.filter(w => (w.cost/w.price_bottle) > 0.4).length },
                      { name: '30-40%', value: inventory.filter(w => (w.cost/w.price_bottle) > 0.3 && (w.cost/w.price_bottle) <= 0.4).length },
                      { name: '30%未満', value: inventory.filter(w => (w.cost/w.price_bottle) <= 0.3).length },
                    ]}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    <Cell fill="#7E1D1D" /> {/* Heavy Wine Color */}
                    <Cell fill="#D4AF37" /> {/* Gold */}
                    <Cell fill="#2F4F4F" /> {/* Dark Slate */}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-bold uppercase tracking-tighter">
                 <span className="text-brand-gold-dark">ポテンシャル：</span>
                 <span className="text-brand-dark/60">{inventory.filter(w => w.price_bottle > w.cost * 3).length}件の高収益アイテムを検知</span>
              </div>
            </div>
          </div>
        </section>
      )}

      <div className="grid gap-6">
        <div className="bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-luxury-soft space-y-4">
          <div className="flex flex-col lg:flex-row gap-4 items-center">
            <div className="relative flex-1 w-full group">
              <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 group-focus-within:text-brand-wine transition-colors" />
              <input 
                placeholder="在庫内を検索 (ワイン名、産地、品種)..."
                className="w-full bg-slate-50 border border-slate-100 rounded-2xl pl-12 pr-6 py-3.5 text-xs outline-none focus:bg-white focus:border-brand-wine transition-all"
                value={invSearchTerm}
                onChange={e => setInvSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
              <select 
                value={invSupplierFilter}
                onChange={e => setInvSupplierFilter(e.target.value)}
                className="flex-1 lg:flex-none h-12 bg-slate-50 border border-slate-100 rounded-xl px-4 text-[10px] font-black uppercase tracking-widest text-slate-500 outline-none focus:border-brand-wine cursor-pointer"
              >
                <option value="all">サプライヤー</option>
                <option value="PIEROTH">PIEROTH</option>
                <option value="OTHER">OTHER</option>
              </select>
              <select 
                value={invCountryFilter}
                onChange={e => setInvCountryFilter(e.target.value)}
                className="flex-1 lg:flex-none h-12 bg-slate-50 border border-slate-100 rounded-xl px-4 text-[10px] font-black uppercase tracking-widest text-slate-500 outline-none focus:border-brand-wine cursor-pointer"
              >
                <option value="all">すべての国</option>
                {invCountries.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <select 
                value={invColorFilter}
                onChange={e => setInvColorFilter(e.target.value)}
                className="flex-1 lg:flex-none h-12 bg-slate-50 border border-slate-100 rounded-xl px-4 text-[10px] font-black uppercase tracking-widest text-slate-500 outline-none focus:border-brand-wine cursor-pointer"
              >
                <option value="all">すべての色</option>
                <option value="赤">赤</option>
                <option value="白">白</option>
                <option value="泡">泡</option>
                <option value="ロゼ">ロゼ</option>
              </select>
            </div>
          </div>
          <div className="flex items-center justify-between px-2">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-brand-gold-dark flex items-center gap-2">
              <Wine className="w-3 h-3" />
              稼働中のワインリスト ({filteredInventory.length} / {inventory.length})
            </h3>
            <span className="text-[10px] text-slate-400 uppercase font-black tracking-tighter italic">
              In-Memory Sync: Active
            </span>
          </div>
        </div>
        
        {inventory.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center border-2 border-dashed border-white/5 rounded-3xl bg-black/20">
            <Wine className="w-12 h-12 text-brand-gold/10 mb-4" />
            <p className="text-gray-500 text-xs uppercase tracking-widest">現在メニューにワインがありません</p>
            <p className="text-gray-500 text-xs uppercase tracking-widest mt-2">{selectedStoreId}</p>
            <button onClick={() => setShowAddModal(true)} className="text-brand-gold text-xs font-bold uppercase tracking-widest mt-4 hover:underline">最初のワインを追加する</button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Header row for desktop */}
            <div className="hidden md:flex items-center px-6 py-2 text-xs font-extrabold text-brand-gold/40 uppercase tracking-[0.3em] border-b border-brand-gold/10">
              <div className="flex-1">ワイン情報 / 品種</div>
              <div className="w-24 text-center">ボトル価格</div>
              <div className="w-24 text-center">グラス価格</div>
              <div className="w-16 text-center">在庫</div>
              <div className="w-24 text-center">粗利率</div>
              <div className="w-32 text-right">アクション</div>
            </div>

            <div className="grid gap-3">
              {filteredInventory.map((wine) => {
                const margin = Math.round((wine.price_bottle - wine.cost) / wine.price_bottle * 100);
                const isLowMargin = margin < 30;
                const isHidden = wine.visible === false || wine.isActive === false;
                const isOutOfStock = wine.stock === 0;

                return (
                  <div key={wine.id} className={`glass-panel p-3 md:p-4 rounded-xl shadow-luxury flex flex-col md:flex-row items-center group transition-all gap-4 border ${isHidden ? 'opacity-50 grayscale-[0.5]' : ''} ${editingWineId === wine.id ? 'border-brand-gold bg-brand-gold/5 shadow-luxury-gold' : 'border-brand-gold/5 hover:border-brand-gold/30'} ${isLowMargin ? 'bg-rose-500/5 border-rose-500/20' : ''}`}>
                    <div className="flex items-center gap-4 flex-1 w-full min-w-0">
                      <div className={`w-10 h-14 bg-black/40 flex items-center justify-center p-1 rounded-lg relative border shrink-0 overflow-hidden ${isOutOfStock ? 'border-rose-500' : 'border-white/5'}`}>
                        <img 
                          src={wine.image_url} 
                          alt="" 
                          loading="lazy"
                          className="w-full h-full object-contain relative z-10 scale-125" 
                        />
                        {isOutOfStock && (
                          <div className="absolute inset-0 bg-rose-500/20 backdrop-blur-[1px] flex items-center justify-center z-20">
                            <AlertCircle className="w-5 h-5 text-rose-500" />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-0.5">
                          <div className="font-bold text-brand-ivory text-sm md:text-base leading-tight truncate">{wine.name_jp}</div>
                          {isHidden && <EyeOff className="w-3 h-3 text-slate-500 shrink-0" />}
                          {isOutOfStock && <span className="bg-rose-500 text-white text-[8px] font-black uppercase px-1.5 py-0.5 rounded-full tracking-widest shrink-0">要発注</span>}
                          {isLowMargin && <span className="bg-brand-wine text-white text-[8px] font-black uppercase px-1.5 py-0.5 rounded-full tracking-widest shrink-0">Alert</span>}
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="text-xs text-brand-gold/60 font-mono tracking-widest uppercase truncate">
                            {wine.grape} • {wine.vintage}
                          </div>
                          {(wine.supplier || 'PIEROTH').toUpperCase() === 'OTHER' && (
                            <span className="text-[9px] font-black text-slate-400 border border-slate-400/30 px-1 rounded uppercase tracking-tighter">Other</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between w-full md:w-auto gap-4 md:gap-0">
                      {editingWineId === wine.id ? (
                        <div className="flex flex-wrap md:flex-nowrap items-center gap-3 w-full">
                          <div className="w-24">
                            <label className="text-[10px] font-extrabold text-brand-gold/60 uppercase tracking-widest block mb-1">ボトル価格</label>
                            <input 
                              type="number"
                              className="w-full bg-white/5 border border-brand-gold/30 rounded px-2.5 py-1.5 text-xs text-brand-ivory outline-none focus:border-brand-gold font-mono text-center shadow-inner"
                              value={editWineData.price_bottle}
                              onChange={e => setEditWineData({...editWineData, price_bottle: parseInt(e.target.value) || 0}) }
                            />
                          </div>
                          <div className="w-24">
                            <label className="text-[10px] font-extrabold text-brand-gold/60 uppercase tracking-widest block mb-1">グラス価格</label>
                            <input 
                              type="number"
                              className="w-full bg-white/5 border border-brand-gold/30 rounded px-2.5 py-1.5 text-xs text-brand-ivory outline-none focus:border-brand-gold font-mono text-center shadow-inner"
                              value={editWineData.price_glass}
                              onChange={e => setEditWineData({...editWineData, price_glass: parseInt(e.target.value) || 0}) }
                            />
                          </div>
                          <div className="w-20">
                            <label className="text-[10px] font-extrabold text-brand-gold/60 uppercase tracking-widest block mb-1">グラス杯数</label>
                            <input
                              type="number"
                              className="w-full bg-white/5 border border-brand-gold/30 rounded px-2.5 py-1.5 text-xs text-brand-ivory outline-none focus:border-brand-gold font-mono text-center shadow-inner"
                              value={editWineData.glasses_per_bottle}
                              onChange={e => setEditWineData({...editWineData, glasses_per_bottle: parseInt(e.target.value) || 6}) }
                            />
                          </div>
                          <div className="w-16">
                            <label className="text-[10px] font-extrabold text-brand-gold/60 uppercase tracking-widest block mb-1">在庫数</label>
                            <input 
                              type="number"
                              className="w-full bg-white/5 border border-brand-gold/30 rounded px-2.5 py-1.5 text-xs text-brand-ivory outline-none focus:border-brand-gold font-mono text-center shadow-inner"
                              value={editWineData.stock}
                              onChange={e => setEditWineData({...editWineData, stock: parseInt(e.target.value) || 0}) }
                            />
                          </div>
                          <div className="hidden md:flex flex-col items-center justify-center w-24">
                             <label className="text-[10px] font-extrabold text-brand-gold/60 uppercase tracking-widest block mb-1">粗利率</label>
                             <div className={`text-xs font-bold font-mono py-1.5 ${isLowMargin ? 'text-rose-500' : 'text-emerald-500'}`}>
                               {margin}%
                             </div>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center w-full md:w-auto gap-2 md:gap-0">
                          <div className="w-24 text-center">
                            <div className="text-xs text-brand-gold/40 md:hidden uppercase tracking-widest mb-0.5">ボトル</div>
                            <div className="text-xs text-brand-ivory font-bold">¥{wine.price_bottle?.toLocaleString()}</div>
                          </div>
                          <div className="w-24 text-center">
                            <div className="text-xs text-brand-gold/40 md:hidden uppercase tracking-widest mb-0.5">グラス</div>
                            <div className="text-xs text-brand-ivory font-bold">¥{wine.price_glass?.toLocaleString()}</div>
                          </div>
                          <div className="w-16 text-center">
                            <div className="text-xs text-brand-gold/40 md:hidden uppercase tracking-widest mb-0.5">在庫</div>
                            <div className={`text-xs font-bold ${wine.stock === 0 ? 'text-rose-500' : 'text-brand-gold'}`}>{wine.stock}</div>
                          </div>
                          <div className="w-24 text-center flex flex-col items-center">
                            <div className="text-xs text-brand-gold/40 md:hidden uppercase tracking-widest mb-0.5">粗利</div>
                            <div className={`text-xs font-black ${isLowMargin ? 'text-rose-500' : 'text-emerald-500'}`}>
                              {margin}%
                            </div>
                            {isLowMargin && <div className="text-xs text-rose-500 uppercase font-black tracking-widest bg-rose-500/10 px-1 rounded">Alert</div>}
                          </div>
                        </div>
                      )}

                      <div className="flex items-center gap-2 shrink-0 md:ml-4">
                        {editingWineId === wine.id ? (
                          <button 
                            onClick={async () => {
                              if (!sid) return;
                              
                              const currentData = queryClient.getQueryData<{ store: any, inventory: any[] }>(['inventory', sid]);
                              if (!currentData) return;

                              const nextInventorySnapshot = currentData.inventory.map(w => 
                                getWineDocId(w) === getWineDocId(wine) ? { ...w, ...editWineData } : w
                              );
                              queryClient.setQueryData(['inventory', sid], { ...currentData, inventory: nextInventorySnapshot });

                              try {
                                const batch = writeBatch(db);
                                // バグ根治: AdminViewと完全に一致させるために getWineDocId を使用
                                const targetDocId = getWineDocId(wine);
                                const itemRef = doc(db, 'stores', sid, 'inventory', targetDocId);
                                
                                const updateData = {
                                  price_bottle: editWineData.price_bottle,
                                  price_glass: editWineData.price_glass,
                                  stock: editWineData.stock,
                                  glasses_per_bottle: editWineData.glasses_per_bottle, // 連動性確保
                                  visible: editWineData.visible,
                                  isFeatured: editWineData.isFeatured,
                                  promoLabel: editWineData.promoLabel,
                                  updatedAt: new Date().toISOString()
                                };

                                batch.set(itemRef, updateData, { merge: true });

                                const richPublicMenu = nextInventorySnapshot
                                  .filter(w => w.visible !== false && w.isActive !== false)
                                  .map(projectWineForPublic);

                                batch.update(doc(db, 'stores', sid), { publicMenu: richPublicMenu });

                                await batch.commit();
                                queryClient.invalidateQueries({ queryKey: ['inventory', sid] });
                                queryClient.invalidateQueries({ queryKey: ['stores'] });
                                setEditingWineId(null);
                              } catch (error) {
                                      console.error('Error saving wine changes:', error);
                                queryClient.invalidateQueries({ queryKey: ['inventory', sid] });
                              }
                            }}
                            className="bg-brand-gold text-brand-wine px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-widest hover:brightness-110 shadow-lg"
                          >
                            終了
                          </button>
                        ) : (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleToggleFeatured(wine.id, wine.isFeatured || false)}
                              className={`p-2 rounded-lg transition-all ${
                                wine.isFeatured ? 'text-amber-500 bg-amber-500/10' : 'text-gray-600 hover:text-brand-gold'
                              }`}
                              title="メニューのおすすめに設定"
                            >
                              <Sparkles className={`w-3.5 h-3.5 ${wine.isFeatured ? 'fill-current' : ''}`} />
                            </button>
                            <button
                              onClick={() => startEditingWine(wine)}
                              className="p-2 text-brand-gold/40 hover:text-brand-gold transition-colors"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleToggleActive(wine.id, wine.isActive || false)}
                              className={`p-2 rounded-lg transition-all ${
                                wine.isActive ? 'text-brand-gold' : 'text-gray-600'
                              }`}
                            >
                              {wine.isActive ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                            </button>
                            <button
                              onClick={() => handleDeleteWine(wine.id)}
                              className="p-2 text-brand-wine/40 hover:text-rose-500 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <AnimatePresence>
        {/* Add Wine Modal */}
        {showAddModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] md:p-4 flex items-end md:items-center justify-center bg-black/80 backdrop-blur-md"
          >
            <motion.div
              initial={{ scale: 0.95, y: 100 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 100 }}
              className="bg-brand-wine border border-brand-gold/20 rounded-t-3xl md:rounded-3xl shadow-luxury w-full max-w-2xl h-[85vh] md:h-[80vh] flex flex-col"
            >
              <div className="p-6 md:p-8 border-b border-brand-gold/20 flex items-center justify-between bg-black/40">
                <div>
                  <h2 className="serif text-2xl text-brand-gold">マスターから選択</h2>
                  <p className="text-xs text-gray-400 uppercase tracking-widest mt-1">Pieroth Master Wine List</p>
                </div>
                <button onClick={() => setShowAddModal(false)} className="p-2 text-brand-gold/40 hover:text-brand-gold transition-colors">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="px-6 md:px-8 py-4 border-b border-brand-gold/10">
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-gold/40" />
                  <input 
                    placeholder="ワイン名、産地、銘柄コードで検索..."
                    className="w-full bg-white/5 border border-brand-gold/20 rounded-full pl-12 pr-6 py-2.5 text-sm text-brand-ivory outline-none focus:border-brand-gold transition-all"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-3 custom-scrollbar">
                {filteredMasterWines.length === 0 ? (
                  <div className="py-20 text-center opacity-30 italic serif text-brand-gold/60">
                    該当するワインが見つかりません
                  </div>
                ) : (
                  filteredMasterWines.map(w => (
                    <div key={w.id} className="bg-white/5 border border-white/5 rounded-2xl p-4 flex items-center justify-between group hover:border-brand-gold/30 hover:bg-white/10 transition-all">
                      <div className="flex items-center gap-4 flex-1">
                        <div className="w-12 h-16 bg-black/40 rounded-lg flex items-center justify-center p-2 border border-white/10 shrink-0">
                          <img 
                            src={w.image_url} 
                            alt="" 
                            loading="lazy"
                            className="h-full object-contain" 
                          />
                        </div>
                        <div className="min-w-0">
                          <div className="text-brand-ivory font-bold text-sm truncate">{w.name_jp}</div>
                          <div className="text-xs text-brand-gold/60 uppercase font-mono mt-1">
                            {w.country} • {w.vintage} • Code: {w.id}
                          </div>
                        </div>
                      </div>
                      <button 
                        onClick={() => handleAddWine(w)}
                        className="ml-4 p-3 bg-brand-gold text-brand-wine rounded-xl hover:scale-110 active:scale-95 transition-all shadow-md flex items-center gap-2 text-xs font-bold uppercase tracking-widest"
                      >
                        <Plus className="w-4 h-4" />
                        追加
                      </button>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
