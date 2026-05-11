import React, { useState, useEffect } from 'react';
import { WineMaster, Store } from '../types';
import { useWines } from '../lib/WineContext';
import { generateStaffTalkScript, generateSocialPost } from '../lib/ai-service';
import { db } from '../lib/firebase';
import { collection, getDocs, doc, getDoc, updateDoc, deleteDoc, setDoc } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';
import { Wine, Camera, MessageSquare, Save, Eye, EyeOff, Loader2, Sparkles, X, Trash2, Plus, Search, Edit2, CheckCircle2, AlertCircle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts';
import { calculateProfit } from '../lib/profit-calc';
import { motion, AnimatePresence } from 'motion/react';

export const OwnerView: React.FC = () => {
  const { wines, user, stores } = useWines();
  const [inventory, setInventory] = useState<WineMaster[]>([]);
  const [store, setStore] = useState<Store | null>(null);
  const [selectedStoreId, setSelectedStoreId] = useState(new URLSearchParams(window.location.search).get('storeId') || user?.storeId || '');
  const [selectedWine, setSelectedWine] = useState<WineMaster | null>(null);
  const [aiResult, setAiResult] = useState<{ talk: string; social: string } | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isEditingStore, setIsEditingStore] = useState(false);
  const [editStoreData, setEditStoreData] = useState<Partial<Store>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [editingWineId, setEditingWineId] = useState<string | null>(null);
  const [editWineData, setEditWineData] = useState<{ price_bottle: number; price_glass: number; stock: number; visible: boolean; isFeatured: boolean; promoLabel: string }>({ 
    price_bottle: 0, 
    price_glass: 0, 
    stock: 0,
    visible: true,
    isFeatured: false,
    promoLabel: ''
  });
  const [isAnalysing, setIsAnalysing] = useState(false);
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  // Handle case where admin/rep arrives without storeId or with a new one
  useEffect(() => {
    const urlSid = new URLSearchParams(window.location.search).get('storeId');
    if (urlSid) {
      setSelectedStoreId(urlSid);
    } else if (user?.storeId) {
      setSelectedStoreId(user.storeId);
    } else if (stores.length > 0 && (user?.role === 'admin' || user?.role === 'rep')) {
      // Default to first store for admins if none selected
      if (!selectedStoreId) setSelectedStoreId(stores[0].id);
    }
  }, [stores, user]);

  const sid = selectedStoreId;

  // Auto-save logic
  useEffect(() => {
    if (!editingWineId || !sid) return;

    const timer = setTimeout(async () => {
      setAutoSaveStatus('saving');
      try {
        await updateDoc(doc(db, 'stores', sid, 'inventory', editingWineId), {
          price_bottle: editWineData.price_bottle,
          price_glass: editWineData.price_glass,
          stock: editWineData.stock,
          visible: editWineData.visible,
          isFeatured: editWineData.isFeatured,
          promoLabel: editWineData.promoLabel,
          updatedAt: new Date().toISOString()
        });
        setInventory(prev => prev.map(w => w.id === editingWineId ? { ...w, ...editWineData } : w));
        setAutoSaveStatus('saved');
        setTimeout(() => setAutoSaveStatus('idle'), 2000);
      } catch (error) {
        console.error("Auto-save error:", error);
        setAutoSaveStatus('error');
      }
    }, 2000); // 2 second debounce

    return () => clearTimeout(timer);
  }, [editWineData, editingWineId, sid]);

  const fetchData = async () => {
    if (!sid) {
       setLoading(false);
       return;
    }

    try {
      // Fetch Store Info
      const storeDoc = await getDoc(doc(db, 'stores', sid));
      if (storeDoc.exists()) {
        const storeData = { id: storeDoc.id, ...storeDoc.data() } as Store;
        setStore(storeData);
        setEditStoreData({
          ...storeData,
          hasAiSommelier: storeData.hasAiSommelier ?? true
        });
      }

      // Fetch Inventory
      const querySnapshot = await getDocs(collection(db, 'stores', sid, 'inventory'));
      const items = querySnapshot.docs.map(d => ({ ...d.data(), id: d.id }));
      
      const enriched = await Promise.all(items.map(async (item) => {
        let master = wines.find(w => w.id === item.id);
        
        // If not found in context (due to 50 items limit), fetch directly
        if (!master) {
          try {
            const masterDoc = await getDoc(doc(db, 'winesMaster', item.id));
            if (masterDoc.exists()) {
              master = { id: masterDoc.id, ...masterDoc.data() } as WineMaster;
            }
          } catch (e) {
            console.error(`Failed to fetch master data for ${item.id}`, e);
          }
        }

        if (!master) return null;

        return { 
          ...master, 
          isActive: (item as any).isActive ?? true, 
          visible: (item as any).visible ?? true,
          isFeatured: (item as any).isFeatured ?? false,
          promoLabel: (item as any).promoLabel || '',
          price_bottle: (item as any).price_bottle || master.price_bottle,
          price_glass: (item as any).price_glass || master.price_glass,
          stock: (item as any).stock ?? master.stock,
          cost: master.cost || 2000 // Fallback cost if missing
        };
      }));

      setInventory(enriched.filter(w => w !== null) as WineMaster[]);
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, `stores/${sid}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const handleUpdateStore = async () => {
    if (!sid || !user?.uid) return;
    setIsSaving(true);
    try {
      // Update Store Info
      await updateDoc(doc(db, 'stores', sid), {
        name: editStoreData.name,
        cuisine_type: editStoreData.cuisine_type,
        address: editStoreData.address,
        hasAiSommelier: editStoreData.hasAiSommelier ?? true,
        owner_api_key: editStoreData.owner_api_key || ''
      });

      // Update User Profile Name if changed
      if (editStoreData.name !== store?.name) {
        await updateDoc(doc(db, 'users', user.uid), {
          name: editStoreData.name
        });
      }

      setStore(prev => prev ? { ...prev, ...editStoreData } as Store : null);
      setIsEditingStore(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `stores/${sid}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleActive = async (wineId: string, currentStatus: boolean) => {
    if (!sid) return;
    try {
      await updateDoc(doc(db, 'stores', sid, 'inventory', wineId), {
        isActive: !currentStatus
      });
      setInventory(prev => prev.map(w => w.id === wineId ? { ...w, isActive: !currentStatus } : w));
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `stores/${sid}/inventory/${wineId}`);
    }
  };

  const handleDeleteWine = async (wineId: string) => {
    if (!sid || !window.confirm('このワインをメニューから削除しますか？')) return;
    try {
      await deleteDoc(doc(db, 'stores', sid, 'inventory', wineId));
      setInventory(prev => prev.filter(w => w.id !== wineId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `stores/${sid}/inventory/${wineId}`);
    }
  };

  const handleAddWine = async (masterWine: WineMaster) => {
    if (!sid) return;
    try {
      await setDoc(doc(db, 'stores', sid, 'inventory', masterWine.id), {
        id: masterWine.id,
        isActive: true,
        visible: true,
        price_bottle: masterWine.price_bottle,
        price_glass: masterWine.price_glass,
        updatedAt: new Date().toISOString()
      });
      
      setInventory(prev => [...prev, { ...masterWine, isActive: true, visible: true }]);
      setShowAddModal(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `stores/${sid}/inventory/${masterWine.id}`);
    }
  };

  const handleGenerateAI = async (wine: WineMaster) => {
    setSelectedWine(wine);
    setIsGenerating(true);
    const [talk, social] = await Promise.all([
      generateStaffTalkScript(wine),
      generateSocialPost(wine)
    ]);
    setAiResult({ talk, social });
    setIsGenerating(false);
  };

  const handleSaveWineEdit = async (wineId: string) => {
    if (!sid) return;
    setIsSaving(true);
    try {
      await updateDoc(doc(db, 'stores', sid, 'inventory', wineId), {
        price_bottle: editWineData.price_bottle,
        price_glass: editWineData.price_glass,
        stock: editWineData.stock,
        visible: editWineData.visible,
        isFeatured: editWineData.isFeatured,
        promoLabel: editWineData.promoLabel,
        updatedAt: new Date().toISOString()
      });
      setInventory(prev => prev.map(w => w.id === wineId ? { ...w, ...editWineData } : w));
      setEditingWineId(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `stores/${sid}/inventory/${wineId}`);
    } finally {
      setIsSaving(false);
    }
  };

  const startEditingWine = (wine: WineMaster) => {
    setEditingWineId(wine.id);
    setEditWineData({
      price_bottle: wine.price_bottle,
      price_glass: wine.price_glass,
      stock: wine.stock || 0,
      visible: wine.visible !== false,
      isFeatured: wine.isFeatured || false,
      promoLabel: wine.promoLabel || ''
    });
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-24 gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-brand-gold" />
        <p className="text-brand-gold/60 text-xs font-bold uppercase tracking-widest">セラーを読み込み中...</p>
      </div>
    );
  }

  const filteredMasterWines = wines.filter(w => 
    !inventory.some(inv => inv.id === w.id) &&
    (w.name_jp.toLowerCase().includes(searchTerm.toLowerCase()) || 
     w.name_en.toLowerCase().includes(searchTerm.toLowerCase()) ||
     w.id.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div id="owner-view" className="max-w-4xl mx-auto px-4 py-8 md:py-12 space-y-8 animate-in fade-in duration-700">
      <header className="flex flex-col md:flex-row md:items-start justify-between gap-6">
        <div className="flex-1">
          {isEditingStore ? (
            <div className="space-y-4 bg-black/40 p-6 rounded-2xl border border-brand-gold/20 animate-in slide-in-from-top duration-300">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-[9px] font-bold text-brand-gold/60 uppercase tracking-widest block mb-1">店名</label>
                  <input 
                    className="w-full bg-white/5 border border-brand-gold/20 rounded-lg px-3 py-2 text-brand-ivory text-sm outline-none focus:border-brand-gold"
                    value={editStoreData.name || ''}
                    onChange={e => setEditStoreData({...editStoreData, name: e.target.value})}
                  />
                </div>
                <div>
                  <label className="text-[9px] font-bold text-brand-gold/60 uppercase tracking-widest block mb-1">料理カテゴリー</label>
                  <input 
                    className="w-full bg-white/5 border border-brand-gold/20 rounded-lg px-3 py-2 text-brand-ivory text-sm outline-none focus:border-brand-gold"
                    value={editStoreData.cuisine_type || ''}
                    onChange={e => setEditStoreData({...editStoreData, cuisine_type: e.target.value})}
                  />
                </div>
              </div>
              <div>
                <label className="text-[9px] font-bold text-brand-gold/60 uppercase tracking-widest block mb-1">住所</label>
                <input 
                  className="w-full bg-white/5 border border-brand-gold/20 rounded-lg px-3 py-2 text-brand-ivory text-sm outline-none focus:border-brand-gold"
                  value={editStoreData.address || ''}
                  onChange={e => setEditStoreData({...editStoreData, address: e.target.value})}
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center justify-between bg-white/5 p-4 rounded-xl border border-brand-gold/10">
                  <div>
                    <div className="text-xs font-bold text-brand-gold uppercase tracking-wider">AIソムリエ機能</div>
                    <div className="text-[9px] text-gray-500 uppercase tracking-widest mt-0.5">有効にするとお客様の相談を受けられます</div>
                  </div>
                  <button 
                    onClick={() => setEditStoreData({...editStoreData, hasAiSommelier: !editStoreData.hasAiSommelier})}
                    className={`w-12 h-6 rounded-full transition-all relative ${editStoreData.hasAiSommelier ? 'bg-brand-gold' : 'bg-gray-700'}`}
                  >
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${editStoreData.hasAiSommelier ? 'right-1' : 'left-1'}`} />
                  </button>
                </div>
                <div>
                  <label className="text-[9px] font-bold text-brand-gold/60 uppercase tracking-widest block mb-1">Gemini API Key</label>
                  <input 
                    type="password"
                    placeholder="自分のAPIキーを使用する場合のみ入力"
                    className="w-full bg-white/5 border border-brand-gold/20 rounded-lg px-3 py-2 text-brand-ivory text-sm outline-none focus:border-brand-gold"
                    value={editStoreData.owner_api_key || ''}
                    onChange={e => setEditStoreData({...editStoreData, owner_api_key: e.target.value})}
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button onClick={() => setIsEditingStore(false)} className="px-4 py-2 text-[10px] uppercase font-bold text-gray-400 hover:text-white transition-colors">キャンセル</button>
                <button 
                  onClick={handleUpdateStore} 
                  disabled={isSaving}
                  className="bg-brand-gold text-brand-wine px-6 py-2 rounded-lg text-[10px] uppercase font-bold tracking-widest flex items-center gap-2 hover:brightness-110"
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
                  <h1 className="serif text-3xl text-brand-gold">{store?.name || '店舗情報不明'}</h1>
                  <button onClick={() => setIsEditingStore(true)} className="p-2 text-brand-gold/40 hover:text-brand-gold transition-colors">
                    <Edit2 className="w-4 h-4" />
                  </button>
                </div>
                {(user?.role === 'admin' || user?.role === 'rep') && (
                  <select 
                    className="bg-brand-gold/10 border border-brand-gold/30 text-brand-gold rounded-full px-4 py-1 text-[10px] font-bold uppercase outline-none"
                    value={sid || ''}
                    onChange={(e) => window.location.href = `/owner?storeId=${e.target.value}`}
                  >
                    <option value="" disabled>店舗を切り替え</option>
                    {stores.map(s => (
                      <option key={s.id} value={s.id} className="bg-brand-wine text-brand-gold font-sans">{s.name}</option>
                    ))}
                  </select>
                )}
              </div>
              <p className="text-gray-400 text-[10px] uppercase tracking-widest font-bold mt-1">
                {store?.cuisine_type} • {store?.address}
              </p>
            </div>
          )}
        </div>
        <button 
          onClick={() => setShowAddModal(true)}
          className="bg-brand-gold text-brand-wine px-6 py-3 rounded-full text-xs font-bold uppercase tracking-widest flex items-center gap-2 hover:scale-105 transition-all shadow-luxury active:scale-95"
        >
          <Plus className="w-5 h-5" />
          ワインを追加
        </button>
      </header>

      {/* Analytics Dashboard */}
      {inventory.length > 0 && (
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 glass-panel p-6 rounded-3xl border border-brand-gold/10 relative overflow-hidden">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-xs font-bold text-brand-gold uppercase tracking-widest">収益分析：銘柄別利益（ボトル）</h3>
                <p className="text-[10px] text-gray-500 mt-1 uppercase">利益の高い上位8銘柄を表示</p>
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
              <h3 className="text-xs font-bold text-brand-gold uppercase tracking-widest">原価率別・銘柄構成</h3>
              <p className="text-[10px] text-gray-500 mt-1 uppercase">平均原価率: {inventory.length > 0 ? Math.round(inventory.reduce((acc, w) => acc + (w.cost / w.price_bottle * 100), 0) / inventory.length) : 0}%</p>
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
              <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-tighter">
                 <span className="text-brand-gold">ポテンシャル：</span>
                 <span className="text-brand-ivory">{inventory.filter(w => w.price_bottle > w.cost * 3).length}件の高収益アイテムを検知</span>
              </div>
            </div>
          </div>
        </section>
      )}

      <div className="grid gap-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-brand-gold/20 pb-3 mb-2 gap-4">
          <h3 className="text-xs font-bold uppercase tracking-widest text-brand-gold flex items-center justify-center md:justify-start gap-2">
            <Wine className="w-4 h-4 text-brand-gold" />
            稼働中のワインリスト ({inventory.length})
          </h3>
          <span className="text-[9px] text-gray-500 uppercase font-mono tracking-tighter text-center md:text-right italic">
            最新のマスターデータと同期済み
          </span>
        </div>
        
        {inventory.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center border-2 border-dashed border-white/5 rounded-3xl bg-black/20">
            <Wine className="w-12 h-12 text-brand-gold/10 mb-4" />
            <p className="text-gray-500 text-xs uppercase tracking-widest">現在メニューにワインがありません</p>
            <button onClick={() => setShowAddModal(true)} className="text-brand-gold text-[10px] font-bold uppercase tracking-widest mt-4 hover:underline">最初のワインを追加する</button>
          </div>
        ) : (
          <div className="grid gap-3">
            {inventory.map((wine) => (
              <div key={wine.id} className="glass-panel p-4 md:p-5 rounded-2xl shadow-luxury flex flex-col sm:flex-row items-center justify-between group hover:border-brand-gold transition-all gap-4">
                <div className="flex items-center gap-4 w-full">
                  <div className="w-16 h-20 bg-black/40 flex items-center justify-center p-2 rounded-lg relative border border-white/5 overflow-hidden shadow-inner shrink-0">
                    <div className="absolute inset-0 opacity-5 bg-[url('https://www.transparenttextures.com/patterns/cream-paper.png')]"></div>
                    <img 
                      src={`/api/proxy-image?url=${encodeURIComponent(wine.image_url)}`} 
                      alt="" 
                      crossOrigin="anonymous"
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-contain relative z-10 scale-125" 
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-brand-ivory text-base md:text-lg leading-tight truncate">{wine.name_jp}</div>
                    <div className="text-[10px] md:text-[11px] text-brand-gold/60 font-mono tracking-tighter font-bold uppercase mt-1">
                      {wine.grape} • {wine.vintage}
                    </div>
                    
                    {editingWineId === wine.id ? (
                      <>
                        <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-2 animate-in fade-in slide-in-from-left duration-300">
                          <div>
                            <label className="text-[8px] text-brand-gold/60 uppercase block">ボトル価格</label>
                            <input 
                              type="number"
                              className="w-full bg-white/10 border border-brand-gold/30 rounded px-2 py-1 text-xs text-brand-ivory outline-none focus:border-brand-gold"
                              value={editWineData.price_bottle}
                              onChange={e => setEditWineData({...editWineData, price_bottle: parseInt(e.target.value) || 0}) }
                            />
                          </div>
                          <div>
                            <label className="text-[8px] text-brand-gold/60 uppercase block">グラス価格</label>
                            <input 
                              type="number"
                              className="w-full bg-white/10 border border-brand-gold/30 rounded px-2 py-1 text-xs text-brand-ivory outline-none focus:border-brand-gold"
                              value={editWineData.price_glass}
                              onChange={e => setEditWineData({...editWineData, price_glass: parseInt(e.target.value) || 0}) }
                            />
                          </div>
                          <div>
                            <label className="text-[8px] text-brand-gold/60 uppercase block">在庫数</label>
                            <input 
                              type="number"
                              className="w-full bg-white/10 border border-brand-gold/30 rounded px-2 py-1 text-xs text-brand-ivory outline-none focus:border-brand-gold"
                              value={editWineData.stock}
                              onChange={e => setEditWineData({...editWineData, stock: parseInt(e.target.value) || 0}) }
                            />
                          </div>
                          <div>
                            <label className="text-[8px] text-brand-gold/60 uppercase block">表示設定</label>
                            <button 
                              onClick={() => setEditWineData({...editWineData, visible: !editWineData.visible})}
                              className={`w-full py-1 rounded text-[10px] font-bold uppercase border transition-all ${
                                editWineData.visible ? 'bg-green-500/20 border-green-500 text-green-500' : 'bg-gray-700 border-gray-600 text-gray-400'
                              }`}
                            >
                              {editWineData.visible ? '表示' : '非表示'}
                            </button>
                          </div>
                        </div>
                        <div className="mt-2 flex items-center justify-between gap-4">
                           <button 
                             onClick={() => setEditWineData({...editWineData, isFeatured: !editWineData.isFeatured})}
                             className={`px-3 py-1 rounded text-[9px] font-bold uppercase border transition-all ${
                               editWineData.isFeatured ? 'bg-brand-gold text-brand-wine border-brand-gold' : 'border-gray-700 text-gray-500'
                             }`}
                           >
                              ★ おすすめ設定
                           </button>
                           <input 
                              placeholder="プロモーションラベル（例：今月のおすすめ）"
                              className="flex-1 bg-white/5 border border-brand-gold/20 rounded px-3 py-1 text-[10px] text-brand-ivory outline-none focus:border-brand-gold"
                              value={editWineData.promoLabel}
                              onChange={e => setEditWineData({...editWineData, promoLabel: e.target.value})}
                           />
                           {autoSaveStatus !== 'idle' && (
                             <div className="flex items-center gap-1.5 whitespace-nowrap">
                               {autoSaveStatus === 'saving' ? (
                                 <>
                                   <Loader2 className="w-3 h-3 animate-spin text-brand-gold" />
                                   <span className="text-[8px] text-brand-gold uppercase font-bold">Saving...</span>
                                 </>
                               ) : autoSaveStatus === 'saved' ? (
                                 <>
                                   <CheckCircle2 className="w-3 h-3 text-green-500" />
                                   <span className="text-[8px] text-green-500 uppercase font-bold">Saved</span>
                                 </>
                               ) : (
                                 <>
                                   <AlertCircle className="w-3 h-3 text-red-500" />
                                   <span className="text-[8px] text-red-500 uppercase font-bold">Error</span>
                                 </>
                               )}
                             </div>
                           )}
                        </div>
                      </>
                    ) : (
                      <div className="text-[10px] text-brand-ivory/80 font-bold mt-2 flex flex-wrap items-center gap-2">
                        <span className="bg-brand-gold/5 px-2 py-0.5 rounded border border-brand-gold/10">ボトル: ¥{wine.price_bottle?.toLocaleString()}</span>
                        <span className="bg-brand-gold/5 px-2 py-0.5 rounded border border-brand-gold/10">グラス: ¥{wine.price_glass?.toLocaleString()}</span>
                        <span className="bg-brand-gold/5 px-2 py-0.5 rounded border border-brand-gold/10">在庫: {wine.stock}</span>
                        <span className="text-[9px] text-brand-gold/40">粗利: {Math.round((wine.price_bottle - wine.cost) / wine.price_bottle * 100)}%</span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                  {editingWineId === wine.id ? (
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => setEditingWineId(null)}
                        className="bg-brand-gold text-brand-wine px-6 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 hover:brightness-110 shadow-luxury transition-all"
                      >
                        編集を終了
                      </button>
                    </div>
                  ) : (
                    <>
                      <button
                        onClick={() => startEditingWine(wine)}
                        className="p-2.5 text-brand-gold/60 hover:text-brand-gold hover:bg-brand-gold/10 rounded-xl transition-all border border-brand-gold/10"
                        title="価格・在庫編集"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleGenerateAI(wine)}
                        className="p-2.5 text-brand-gold hover:bg-brand-gold hover:text-brand-wine rounded-xl transition-all border border-brand-gold/30 shadow-[0_0_10px_rgba(212,175,55,0.1)]"
                        title="AIインテリジェンス"
                      >
                        <Sparkles className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleToggleActive(wine.id, wine.isActive || false)}
                        className={`p-2.5 rounded-xl transition-all border flex items-center justify-center shrink-0 ${
                          wine.isActive 
                          ? 'border-brand-gold bg-brand-gold/10 text-brand-gold shadow-[0_0_15px_rgba(212,175,55,0.2)]' 
                          : 'border-white/10 bg-white/5 text-gray-600'
                        }`}
                      >
                        {wine.isActive ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={() => handleDeleteWine(wine.id)}
                        className="p-2.5 text-red-400 hover:bg-red-500 hover:text-white rounded-xl transition-all border border-red-500/20 hover:border-red-500"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <AnimatePresence>
        {/* AI Insight Modal */}
        {selectedWine && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] md:p-4 flex items-end md:items-center justify-center bg-brand-wine/40 backdrop-blur-md"
          >
            <motion.div
              initial={{ scale: 0.95, y: 100 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 100 }}
              className="bg-black/95 backdrop-blur-3xl rounded-t-[2rem] md:rounded-3xl shadow-[0_0_100px_rgba(0,0,0,1)] border border-brand-gold/30 w-full max-w-2xl overflow-hidden max-h-[90vh] md:max-h-[85vh] flex flex-col"
            >
              <div className="bg-gradient-to-r from-brand-wine to-black p-6 md:p-8 flex items-center justify-between border-b border-brand-gold/20 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 md:w-10 md:h-10 bg-brand-gold rounded-full flex items-center justify-center text-brand-wine text-xs md:text-sm font-bold shadow-[0_0_20px_rgba(212,175,55,0.5)]">AI</div>
                  <div>
                    <h4 className="serif text-brand-ivory text-xl md:text-2xl tracking-wide leading-none mb-1">接客AIアシスタント</h4>
                    <p className="text-[9px] text-brand-gold/60 uppercase tracking-[0.2em] font-bold">Sales Intelligence Suite</p>
                  </div>
                </div>
                <button onClick={() => setSelectedWine(null)} className="text-brand-gold/40 hover:text-brand-ivory hover:scale-110 transition-all p-2 bg-white/5 rounded-full">
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              <div className="flex-1 p-6 md:p-10 space-y-10 overflow-y-auto custom-scrollbar scroll-smooth">
                {isGenerating ? (
                  <div className="flex flex-col items-center justify-center py-24 gap-8">
                    <div className="relative">
                      <Loader2 className="w-16 h-16 animate-spin text-brand-gold opacity-40" />
                      <Sparkles className="absolute inset-0 m-auto w-6 h-6 text-brand-gold animate-pulse" />
                    </div>
                    <div className="text-center space-y-2">
                       <p className="serif italic text-brand-gold text-2xl animate-pulse">解析中...</p>
                       <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">CSVマスター・ソムリエエンジン駆動中</p>
                    </div>
                  </div>
                ) : (
                  <>
                    <section className="space-y-4">
                      <div className="flex items-center gap-3 text-brand-gold text-xs font-bold uppercase tracking-[0.2em] border-b border-brand-gold/20 pb-3">
                        <div className="p-1.5 bg-brand-gold/10 rounded-lg">
                          <MessageSquare className="w-4 h-4" />
                        </div>
                        接客用「おすすめトークスクリプト」
                      </div>
                      <div className="bg-white/5 p-6 md:p-8 rounded-2xl text-base md:text-lg leading-relaxed border border-brand-gold/10 italic text-brand-ivory/90 font-serif shadow-inner relative group">
                        <div className="absolute top-4 left-4 text-brand-gold/10 text-6xl font-serif">“</div>
                        <div className="relative z-10 pl-6 pr-2">
                          {aiResult?.talk}
                        </div>
                      </div>
                    </section>
                    
                    <section className="space-y-4">
                      <div className="flex items-center gap-3 text-brand-gold text-xs font-bold uppercase tracking-[0.2em] border-b border-brand-gold/20 pb-3">
                        <div className="p-1.5 bg-brand-gold/10 rounded-lg">
                          <Camera className="w-4 h-4" />
                        </div>
                        SNS集客用投稿案 (Instagram)
                      </div>
                      <div className="bg-black/60 p-6 md:p-8 rounded-2xl text-xs md:text-sm leading-relaxed border border-brand-gold/10 font-mono text-gray-400 whitespace-pre-wrap shadow-inner">
                        {aiResult?.social}
                      </div>
                    </section>
                  </>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}

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
                  <p className="text-[10px] text-gray-400 uppercase tracking-widest mt-1">Pieroth Master Wine List</p>
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
                            src={`/api/proxy-image?url=${encodeURIComponent(w.image_url)}`} 
                            alt="" 
                            crossOrigin="anonymous"
                            referrerPolicy="no-referrer"
                            className="h-full object-contain" 
                          />
                        </div>
                        <div className="min-w-0">
                          <div className="text-brand-ivory font-bold text-sm truncate">{w.name_jp}</div>
                          <div className="text-[10px] text-brand-gold/60 uppercase font-mono mt-1">
                            {w.country} • {w.vintage} • Code: {w.id}
                          </div>
                        </div>
                      </div>
                      <button 
                        onClick={() => handleAddWine(w)}
                        className="ml-4 p-3 bg-brand-gold text-brand-wine rounded-xl hover:scale-110 active:scale-95 transition-all shadow-md flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest"
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
