import React, { useState, useEffect } from 'react';
import { WineMaster, Store } from '../types';
import { useWines } from '../lib/WineContext';
import { WineProfile } from '../components/WineProfile';
import { AISommelier } from '../components/AISommelier';
import { db } from '../lib/firebase';
import { doc, getDoc, collection, getDocs, query, where, setDoc } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';
import { ChevronRight, Info, Wine, Utensils, Award, Loader2, Sparkles, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export const CustomerView: React.FC = () => {
  const { wines, user } = useWines();
  const [selectedWine, setSelectedWine] = useState<WineMaster | null>(null);
  const [store, setStore] = useState<Store | null>(null);
  const [inventory, setInventory] = useState<WineMaster[]>([]);
  const [loading, setLoading] = useState(true);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const [showReturnToAI, setShowReturnToAI] = useState(false);
  const [showReturnFloating, setShowReturnFloating] = useState(false);
  const [isSommelierOpen, setIsSommelierOpen] = useState(false);
  const [sortBy, setSortBy] = useState<'price_asc' | 'price_desc' | 'vintage'>('price_asc');
  const [filterColor, setFilterColor] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // スクロール監視
  useEffect(() => {
    const container = document.querySelector('.overflow-y-auto');
    if (!container) return;

    const handleScroll = (e: any) => {
      const scrollTop = e.target.scrollTop;
      setShowReturnToAI(scrollTop > 600);
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [loading]);

  const handleSelectWine = (id: string) => {
    const element = document.getElementById(`wine-${id}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setHighlightedId(id);
      
      // Shortened to 0.8s for enterprise-grade snappiness
      setTimeout(() => {
        setHighlightedId(null);
        setShowReturnFloating(true);
      }, 800);
      
      setTimeout(() => setShowReturnFloating(false), 120000);
    }
  };

  const scrollToSommelier = () => {
    const element = document.getElementById('ai-sommelier');
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const [isOrdering, setIsOrdering] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [isCalling, setIsCalling] = useState(false);
  const [callSuccess, setCallSuccess] = useState(false);

  const handleCallSommelier = () => {
    setIsCalling(true);
    // Simulate real notification delay
    setTimeout(() => {
      setIsCalling(false);
      setCallSuccess(true);
      setTimeout(() => setCallSuccess(false), 3000);
    }, 1500);
  };
  const fetchStoreData = async () => {
    const params = new URLSearchParams(window.location.search);
    const storeId = params.get('storeId');

    if (!storeId) {
      setLoading(false);
      return;
    }

    try {
      const storeDoc = await getDoc(doc(db, 'stores', storeId));
      if (storeDoc.exists()) {
        const storeData = { id: storeDoc.id, ...storeDoc.data() } as Store;
        setStore(storeData);
        
        const invSnap = await getDocs(collection(db, 'stores', storeId, 'inventory'));
        const invItems = invSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        
        const activeItems = invItems.filter((item: any) => item.isActive !== false && item.visible !== false);
        
        // Fetch matching master data from Firestore for these inventory items using bulk queries
        const enriched: WineMaster[] = [];
        const activeIds = activeItems.map((item: any) => item.id);
        
        // Firestore 'in' query limit is 30
        for (let i = 0; i < activeIds.length; i += 30) {
          const chunk = activeIds.slice(i, i + 30);
          const q = query(collection(db, 'winesMaster'), where('__name__', 'in', chunk));
          const masterSnaps = await getDocs(q);
          
          masterSnaps.forEach(docSnap => {
            const masterData = docSnap.data() as WineMaster;
            const invItem = activeItems.find((item: any) => item.id === docSnap.id) as any;
            if (invItem) {
              enriched.push({
                ...masterData,
                id: docSnap.id,
                price_bottle: invItem.price_bottle || masterData.price_bottle,
                price_glass: invItem.price_glass || masterData.price_glass
              });
            }
          });
        }
        
        setInventory(enriched);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, `stores/${storeId}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStoreData();
  }, []);

  const handleOrder = async () => {
    if (!selectedWine || !store) return;
    
    setIsOrdering(true);
    try {
      const orderId = `ORD-${Date.now()}`;
      await setDoc(doc(db, 'orders', orderId), {
        id: orderId,
        storeId: store.id,
        storeName: store.name,
        wineId: selectedWine.id,
        wineName: selectedWine.name_jp,
        price: selectedWine.price_bottle,
        customerEmail: user?.email || 'anonymous',
        status: 'pending',
        createdAt: new Date().toISOString()
      });

      setOrderSuccess(true);
      setTimeout(() => {
        setOrderSuccess(false);
        setSelectedWine(null);
      }, 3000);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'orders');
    } finally {
      setIsOrdering(false);
    }
  };

  const SkeletonItem = () => (
    <div className="flex gap-5 p-4 rounded-[2rem] border border-brand-wine/5 animate-in fade-in duration-700">
      <div className="w-28 h-32 skeleton shrink-0" />
      <div className="flex-1 flex flex-col justify-center gap-3">
        <div className="h-3 w-1/2 skeleton" />
        <div className="h-5 w-3/4 skeleton" />
        <div className="flex justify-between items-center mt-2">
          <div className="h-8 w-24 skeleton" />
          <div className="w-10 h-10 rounded-full skeleton" />
        </div>
      </div>
    </div>
  );

  if (loading) {
     return (
       <div className="min-h-screen bg-brand-ivory flex justify-center items-start md:items-center">
         <div className="w-full md:max-w-[420px] md:h-[850px] bg-brand-ivory overflow-hidden flex flex-col relative md:border md:border-brand-gold/20 md:rounded-[3rem] shadow-2xl">
           <header className="p-6 border-b border-brand-gold/20 bg-white/80 backdrop-blur-md sticky top-0 z-50">
             <div className="h-4 w-24 skeleton mx-auto mb-2" />
             <div className="h-6 w-48 skeleton mx-auto" />
           </header>
           <div className="p-6 space-y-8">
             <div className="h-10 w-full skeleton mb-8" />
             <div className="space-y-6">
               <SkeletonItem />
               <SkeletonItem />
               <SkeletonItem />
               <SkeletonItem />
               <SkeletonItem />
             </div>
           </div>
         </div>
       </div>
     );
  }

  if (!store) {
    return (
      <div className="min-h-screen bg-brand-wine flex flex-col items-center justify-center p-8 text-center">
        <Wine className="w-16 h-16 text-brand-gold/20 mb-6" />
        <h2 className="serif text-2xl text-brand-gold mb-4">店舗が見つかりません</h2>
        <p className="text-sm text-brand-ivory/60 leading-relaxed max-w-xs">QRコードを再度読み取ってください。または店舗スタッフにお声がけください。</p>
      </div>
    );
  }

  if (inventory.length === 0) {
    return (
      <div className="min-h-screen bg-brand-wine flex flex-col items-center justify-center p-8 text-center text-brand-gold overflow-hidden">
        {/* Animated background elements for premium feel */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-24 -left-24 w-96 h-96 bg-brand-gold/5 rounded-full blur-3xl animate-pulse" />
          <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-brand-gold/5 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }} />
        </div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.2, ease: "easeOut" }}
          className="relative z-10"
        >
          <motion.div 
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
            className="mb-12 relative inline-block"
          >
            <div className="absolute inset-0 bg-brand-gold/20 blur-2xl rounded-full scale-150 opacity-30" />
            <Wine className="w-20 h-20 text-brand-gold/40 relative z-10" strokeWidth={0.5} />
            <motion.div
              animate={{ opacity: [0.3, 0.7, 0.3] }}
              transition={{ duration: 4, repeat: Infinity }}
              className="absolute -top-4 -right-4"
            >
              <Sparkles className="w-8 h-8 text-brand-gold/50" />
            </motion.div>
          </motion.div>

          <div className="space-y-8">
            <div>
              <h2 className="serif text-3xl md:text-4xl text-brand-gold mb-2 tracking-[0.25em] font-light leading-snug uppercase">
                THE CELLAR
              </h2>
              <div className="flex items-center justify-center gap-4">
                <div className="h-px w-8 bg-brand-gold/30" />
                <span className="italic opacity-60 serif text-xs tracking-[0.3em] uppercase">Under Selection</span>
                <div className="h-px w-8 bg-brand-gold/30" />
              </div>
            </div>
            
            <div className="space-y-4">
              <p className="text-[11px] text-brand-ivory/80 leading-relaxed max-w-[320px] mx-auto serif italic tracking-[0.15em] uppercase">
                現在、ソムリエが在庫状況の最終確認および<br/>
                ワインリストの調整を行っております。<br/>
                まもなく公開されますので、少々お待ちください。
              </p>
              <p className="text-[10px] text-brand-gold/60 leading-relaxed max-w-[280px] mx-auto serif tracking-[0.1em]">
                恐れ入りますが、お急ぎの場合は<br/>近くのスタッフまでお声がけください。
              </p>
            </div>

            <div className="text-[9px] text-brand-gold/30 tracking-[0.4em] uppercase font-bold pt-4">
              Est. Preparation Time: Moments
            </div>
          </div>

          <div className="mt-20 flex flex-col gap-5 items-center">
             <button 
                onClick={() => {
                  setLoading(true);
                  fetchStoreData();
                }}
                className="px-14 py-4 bg-transparent border border-brand-gold/30 text-brand-gold text-[10px] uppercase tracking-[0.4em] rounded-full hover:bg-brand-gold/10 hover:border-brand-gold/60 active:scale-95 transition-all font-bold backdrop-blur-md shadow-lg"
              >
                リストを更新する
              </button>
              
              <div className="flex items-center gap-3 opacity-30">
                <div className="w-1 h-1 rounded-full bg-brand-gold" />
                <p className="text-[8px] text-brand-gold uppercase tracking-[0.5em] font-mono">
                  {store.name}
                </p>
                <div className="w-1 h-1 rounded-full bg-brand-gold" />
              </div>
          </div>
        </motion.div>
      </div>
    );
  }

  const displayedInventory = [...inventory]
    .filter(w => {
      const matchColor = filterColor === 'all' || w.color === filterColor;
      const matchSearch = searchQuery === '' || 
        w.name_jp.toLowerCase().includes(searchQuery.toLowerCase()) ||
        w.name_en.toLowerCase().includes(searchQuery.toLowerCase()) ||
        w.region.toLowerCase().includes(searchQuery.toLowerCase()) ||
        w.grape.toLowerCase().includes(searchQuery.toLowerCase());
      return matchColor && matchSearch;
    })
    .sort((a, b) => {
      // Prioritize featured wines
      if (a.isFeatured && !b.isFeatured) return -1;
      if (!a.isFeatured && b.isFeatured) return 1;

      if (sortBy === 'price_asc') return a.price_bottle - b.price_bottle;
      if (sortBy === 'price_desc') return b.price_bottle - a.price_bottle;
      if (sortBy === 'vintage') return (b.vintage || '').localeCompare(a.vintage || '');
      return 0;
    });

  return (
    <div id="customer-view" className="min-h-screen sleek-bg md:py-8 md:px-4 flex justify-center items-start md:items-center overflow-x-hidden">
      <div className="w-full md:max-w-[420px] md:h-[850px] md:phone-frame bg-brand-ivory overflow-hidden flex flex-col relative animate-in zoom-in duration-500 md:border md:border-brand-gold/20 md:rounded-[3rem] md:shadow-[0_0_100px_rgba(0,0,0,0.8)] min-h-screen md:min-h-0">
        <div className="hidden md:flex absolute top-0 w-full h-8 bg-black/80 backdrop-blur-md justify-center items-center z-[60] border-b border-white/5">
          <div className="w-20 h-5 bg-black rounded-full border border-white/10" />
        </div>

        {/* Floating Return to Sommelier Button (Appears after jumping to a card) */}
        <AnimatePresence>
          {showReturnFloating && (
            <motion.button
              initial={{ opacity: 0, scale: 0.5, y: 100 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.5, y: 100 }}
              whileHover={{ scale: 1.1, backgroundColor: '#FFFFFF' }}
              whileTap={{ scale: 0.9 }}
              onClick={() => {
                setIsSommelierOpen(true);
                setShowReturnFloating(false);
              }}
              className="fixed bottom-32 right-6 z-[60] w-28 h-28 bg-gradient-to-br from-brand-gold via-white to-brand-gold text-brand-wine rounded-full shadow-[0_0_50px_rgba(212,175,55,0.7),0_25px_60px_rgba(0,0,0,0.5)] flex flex-col items-center justify-center border-4 border-brand-wine/20 backdrop-blur-xl cursor-pointer group p-2 overflow-hidden"
            >
              <div className="absolute inset-0 rounded-full animate-ping bg-brand-gold/10 pointer-events-none" />
              <div className="absolute inset-0 rounded-full animate-pulse bg-brand-gold/20" />
              <div className="absolute -top-1 -right-1 bg-brand-wine text-brand-gold text-[10px] font-black px-3 py-1 rounded-full border border-brand-gold shadow-2xl z-10">
                BACK
              </div>
              <Sparkles className="w-12 h-12 mb-1 group-hover:rotate-12 transition-transform duration-500 text-brand-wine shadow-sm" />
              <div className="text-[10px] font-black tracking-tighter leading-none text-center uppercase text-brand-wine">
                ソムリエに<br/>戻る
              </div>
            </motion.button>
          )}
        </AnimatePresence>

        <div className="flex-1 mt-0 md:mt-8 flex flex-col overflow-hidden">
          {/* Header */}
          <header className="p-6 flex items-center justify-between border-b border-brand-gold/30 shrink-0 bg-black/40 backdrop-blur-md sticky top-0 z-50">
            <div className="w-10" /> {/* Spacer for balance */}
            <div className="text-center">
              <h4 className="serif text-brand-gold italic text-[10px] mb-0.5 tracking-[0.2em] opacity-80 font-light">{store.name}</h4>
              <h3 className="text-lg font-serif tracking-[0.3em] text-brand-gold uppercase">蔵出しワインリスト</h3>
            </div>
            {store.hasAiSommelier !== false ? (
              <button 
                onClick={() => setIsSommelierOpen(true)}
                className="flex flex-col items-center gap-1 text-brand-gold hover:opacity-80 transition-all group"
              >
                <div className="w-10 h-10 rounded-full bg-brand-gold/10 flex items-center justify-center border border-brand-gold/20 group-hover:scale-110 transition-transform">
                  <Sparkles className="w-5 h-5" />
                </div>
                <span className="text-[8px] font-bold tracking-tighter">AIソムリエ</span>
              </button>
            ) : (
              <div className="w-10" />
            )}
          </header>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-8 pb-40 scroll-smooth">
            {/* Floating Proposal Banner (Check context) */}
            <AnimatePresence>
              {highlightedId && (
                <motion.div
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="fixed top-24 inset-x-4 z-[55] flex justify-center pointer-events-none"
                >
                  <div className="bg-brand-wine/95 backdrop-blur-xl text-brand-gold px-5 py-2.5 rounded-full shadow-2xl border border-brand-gold/40 flex items-center gap-3 text-[10px] font-bold uppercase tracking-[0.2em]">
                    <div className="w-2 h-2 rounded-full bg-brand-gold animate-pulse" />
                    提案されたワインを確認中
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* AI Sommelier Section */}
            {store.hasAiSommelier !== false && (
              <AISommelier 
                availableWines={inventory} 
                storeId={store.id}
                cuisineType={store.cuisine_type} 
                onSelectWine={handleSelectWine}
                isOpen={isSommelierOpen}
                setIsOpen={setIsSommelierOpen}
              />
            )}

            <div className="space-y-6">
              <div className="flex flex-col gap-4 border-b border-brand-gold/30 pb-4 mb-2">
                <div className="flex items-center justify-between">
                  <h2 className="serif text-2xl text-brand-wine tracking-tight">ソムリエ厳選銘柄</h2>
                  <div className="flex items-center gap-2">
                    <select 
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value as any)}
                      className="bg-transparent text-[10px] font-bold text-brand-gold/80 uppercase tracking-widest outline-none border-none cursor-pointer hover:text-brand-gold transition-colors"
                    >
                      <option value="price_asc">価格が安い順</option>
                      <option value="price_desc">価格が高い順</option>
                      <option value="vintage">年号が新しい順</option>
                    </select>
                  </div>
                </div>
                
                <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                  {[
                    { id: 'all', label: 'すべて' },
                    { id: '赤', label: '赤ワイン' },
                    { id: '白', label: '白ワイン' },
                    { id: '泡', label: '泡' },
                    { id: 'デザート', label: 'デザート' },
                    { id: 'ロゼ', label: 'ロゼ' }
                  ].map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => setFilterColor(tab.id)}
                      className={`px-4 py-2 rounded-full text-[9px] font-bold uppercase tracking-widest transition-all shrink-0 border ${
                        filterColor === tab.id 
                          ? 'bg-brand-gold text-brand-wine border-brand-gold shadow-md' 
                          : 'bg-white/50 text-brand-wine/60 border-brand-wine/10'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* Real-time Keyword Search */}
                <div className="relative group">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="産地、品種、キーワードで検索..."
                    className="w-full bg-brand-wine/5 border border-brand-gold/10 rounded-2xl py-3 pl-4 pr-10 text-xs text-brand-wine placeholder:text-brand-wine/30 focus:outline-none focus:border-brand-gold/40 focus:bg-white transition-all shadow-inner"
                  />
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 text-brand-gold opacity-40">
                    <Sparkles className="w-4 h-4" />
                  </div>
                </div>
              </div>
              
              <div className="grid gap-6">
                {displayedInventory.map((wine) => (
                  <motion.div
                    key={wine.id}
                    id={`wine-${wine.id}`}
                    whileTap={{ scale: 0.98 }}
                    animate={highlightedId === wine.id ? { 
                      borderColor: ["rgba(212,175,55,0.1)", "rgba(212,175,55,1)", "rgba(212,175,55,0.1)"],
                      backgroundColor: ["rgba(255,255,255,0)", "rgba(212,175,55,0.4)", "rgba(255,255,255,0)"],
                      boxShadow: [
                         "0 0 0 0px rgba(212,175,55,0)", 
                         "0 0 80px 20px rgba(212,175,55,1)", 
                         "0 0 0 0px rgba(212,175,55,0)"
                      ],
                      scale: [1, 1.08, 1],
                      filter: ["brightness(1)", "brightness(1.5)", "brightness(1)"]
                    } : {}}
                    transition={highlightedId === wine.id ? { 
                      duration: 0.8, 
                      repeat: 0, 
                      ease: "easeOut"
                    } : {}}
                    onClick={() => setSelectedWine(wine)}
                    className={`group cursor-pointer flex gap-5 border p-4 rounded-[2rem] transition-all duration-700 relative overflow-hidden ${
                      highlightedId === wine.id 
                        ? 'z-20 border-brand-gold bg-brand-gold/5' 
                        : wine.isFeatured
                          ? 'border-brand-gold/40 bg-brand-gold/5 shadow-[0_0_20px_rgba(212,175,55,0.1)]'
                          : 'border-transparent border-b border-brand-wine/5 hover:bg-brand-gold/5'
                    }`}
                  >
                    {wine.isFeatured && (
                      <div className="absolute top-0 right-0 bg-brand-gold text-brand-wine text-[7px] font-black px-3 py-1 rounded-bl-xl tracking-[0.2em] uppercase z-10 shadow-sm">
                        Special Selection
                      </div>
                    )}
                    {wine.promoLabel && (
                      <div className="absolute top-6 right-0 bg-brand-wine text-brand-gold text-[7px] font-bold px-2 py-0.5 rounded-l-sm tracking-widest z-10 opacity-90 scale-90 origin-right">
                        {wine.promoLabel}
                      </div>
                    )}
                    <div className="w-28 h-32 bg-white/50 backdrop-blur-sm flex items-center justify-center p-4 rounded-3xl relative border border-brand-gold/10 shadow-sm group-hover:border-brand-gold/30 transition-all overflow-hidden shrink-0">
                      <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/cream-paper.png')]" />
                      <img
                        src={wine.image_url}
                        alt=""
                        className="w-full h-full object-contain group-hover:scale-110 transition-transform duration-1000 ease-out drop-shadow-2xl"
                      />
                    </div>
                    <div className="flex-1 flex flex-col justify-center gap-1">
                      <div className="text-[10px] uppercase font-bold text-brand-gold/80 tracking-[0.3em]">
                        {wine.region} · {wine.vintage}
                      </div>
                      <h3 className="serif text-lg text-brand-wine leading-tight tracking-tight group-hover:text-brand-gold transition-colors">{wine.name_jp}</h3>
                      <div className="flex items-center justify-between mt-3">
                        <div className="flex flex-col">
                           <span className="serif text-xl text-brand-wine font-medium tracking-tighter">¥{wine.price_bottle?.toLocaleString()}</span>
                        </div>
                        <div className="w-10 h-10 rounded-full bg-brand-gold/10 flex items-center justify-center group-hover:bg-brand-gold group-hover:text-white transition-all">
                          <ChevronRight className="w-6 h-6 text-brand-gold group-hover:text-white" />
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Global Footer (QR Action) */}
        <div className="absolute bottom-8 inset-x-6 md:inset-x-8 z-40 bg-gradient-to-t from-brand-ivory via-brand-ivory to-transparent pt-12 pointer-events-none">
           <div className="flex flex-col gap-3 pointer-events-auto">
             <AnimatePresence>
                {showReturnToAI && store.hasAiSommelier !== false && (
                  <motion.button
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 20 }}
                    onClick={() => setIsSommelierOpen(true)}
                    className="w-full bg-white/90 backdrop-blur-md text-brand-wine py-3 rounded-2xl font-bold text-[10px] tracking-[0.2em] uppercase border border-brand-gold/30 shadow-lg flex items-center justify-center gap-2 hover:bg-white transition-all shadow-[0_4px_20px_rgba(212,175,55,0.2)]"
                  >
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-3 h-3 text-brand-gold" />
                      ソムリエに相談する
                    </div>
                  </motion.button>
                )}
              </AnimatePresence>
             <button 
               onClick={handleCallSommelier}
               disabled={isCalling}
               className={`w-full py-4 rounded-2xl font-bold text-[11px] tracking-[0.4em] uppercase border shadow-md transition-all flex items-center justify-center gap-3 ${
                 isCalling ? 'bg-slate-100 text-slate-400 border-slate-200' : 
                 callSuccess ? 'bg-green-500 text-white border-green-600' :
                 'bg-brand-gold text-brand-wine border-brand-gold shadow-[0_0_30px_rgba(212,175,55,0.3)] hover:scale-[1.02] active:scale-95'
               }`}
             >
               {isCalling ? <Loader2 className="w-4 h-4 animate-spin" /> : 
                callSuccess ? <CheckCircle2 className="w-4 h-4" /> : null}
               {isCalling ? '通知中...' : callSuccess ? 'ソムリエが向かっています' : 'ソムリエを呼ぶ'}
             </button>
           </div>
        </div>

        {/* Wine Details Modal */}
        <AnimatePresence>
          {selectedWine && (
            <motion.div
              initial={{ y: "100%", opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "100%", opacity: 0 }}
              transition={{ 
                type: "spring", 
                damping: 32, 
                stiffness: 280,
                mass: 1.2
              }}
              className="absolute inset-x-0 bottom-0 top-0 md:top-12 z-[100] bg-black/98 backdrop-blur-3xl overflow-hidden flex flex-col md:rounded-t-[2.5rem] border-t border-brand-gold/30 shadow-[0_-20px_500px_rgba(0,0,0,1)]"
            >
              <div className="p-8 pb-4 flex justify-between items-center bg-black/40">
                <span className="text-[10px] text-brand-gold font-bold uppercase tracking-[0.2em] opacity-60">Vintage {selectedWine.vintage}</span>
                <button 
                  onClick={() => setSelectedWine(null)} 
                  className="w-10 h-10 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-brand-gold text-xl hover:bg-white/20 transition-all font-light"
                >✕</button>
              </div>
              
              <div className="flex-1 overflow-y-auto px-6 md:px-8 pb-48 space-y-10 custom-scrollbar scroll-smooth">
                <div className="text-center pt-4">
                  <div className="w-full aspect-square md:aspect-[4/5] bg-black/40 border border-brand-gold/20 rounded-3xl mb-8 flex items-center justify-center p-8 relative shadow-inner group overflow-hidden">
                    <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_center,rgba(212,175,55,0.15),transparent_70%)]" />
                    <img src={selectedWine.image_url} alt="" className="h-full object-contain relative z-10 transition-transform duration-2000 group-hover:scale-105" />
                  </div>
                  <h2 className="serif text-2xl md:text-3xl text-brand-gold mb-3 tracking-tight leading-tight">{selectedWine.name_jp}</h2>
                  <p className="text-[9px] md:text-[10px] text-gray-400 tracking-[0.3em] uppercase font-bold">{selectedWine.name_en}</p>
                </div>

                <div className="space-y-6 pt-8 border-t border-white/10">
                  <div className="flex items-center gap-3 text-brand-gold">
                    <Award className="w-5 h-5 opacity-70" />
                    <h4 className="text-[11px] font-bold uppercase tracking-[0.3em]">味わいのプロファイル</h4>
                  </div>
                  <WineProfile wine={selectedWine} />
                </div>

                <div className="space-y-6">
                  <div className="flex items-center gap-3 text-brand-gold">
                    <Info className="w-5 h-5 opacity-70" />
                    <h4 className="text-[11px] font-bold uppercase tracking-[0.3em]">ソムリエによる解説</h4>
                  </div>
                  <p className="text-sm md:text-base leading-relaxed text-gray-200 italic font-serif bg-brand-gold/5 p-6 rounded-2xl border border-brand-gold/10 shadow-inner">
                    "{selectedWine.ai_explanation}"
                  </p>
                </div>

                <div className="space-y-6">
                  <div className="flex items-center gap-3 text-brand-gold">
                    <Utensils className="w-5 h-5 opacity-70" />
                    <h4 className="text-[11px] font-bold uppercase tracking-[0.3em]">最高のマリアージュ</h4>
                  </div>
                  <div className="flex flex-wrap gap-2 md:gap-3">
                    {selectedWine.pairing.split('、').map(p => (
                      <span key={p} className="bg-brand-gold/10 border border-brand-gold/30 px-4 py-2 rounded-full text-[10px] text-brand-gold font-bold tracking-wider">
                        {p}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="absolute bottom-0 inset-x-0 p-6 md:p-8 pt-4 bg-black/95 backdrop-blur-2xl border-t border-brand-gold/20 flex flex-col gap-6 safe-bottom">
                 <div className="flex justify-between items-center px-2">
                   <div className="flex flex-col">
                     <span className="text-[10px] text-gray-500 uppercase font-bold tracking-widest mb-1">Bottle</span>
                     <span className="serif text-2xl md:text-3xl text-brand-gold tracking-tighter">¥{selectedWine.price_bottle?.toLocaleString()}</span>
                   </div>
                   <div className="h-10 w-px bg-brand-gold/20" />
                   <div className="flex flex-col text-right">
                     <span className="text-[10px] text-gray-500 uppercase font-bold tracking-widest mb-1">Glass</span>
                     <span className="serif text-2xl md:text-3xl text-brand-gold tracking-tighter">¥{selectedWine.price_glass?.toLocaleString()}</span>
                   </div>
                 </div>
                 <button 
                   onClick={handleOrder}
                   disabled={isOrdering || orderSuccess}
                   className="w-full bg-brand-gold text-brand-wine py-4 rounded-2xl font-bold text-[12px] tracking-[0.4em] uppercase shadow-[0_10px_40px_rgba(212,175,55,0.4)] hover:brightness-110 active:scale-95 transition-all disabled:opacity-50 disabled:scale-100"
                 >
                   {isOrdering ? (
                     <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                   ) : orderSuccess ? (
                     <span className="flex items-center justify-center gap-2">
                       <Award className="w-4 h-4" />
                       オーダー完了
                     </span>
                   ) : (
                     "オーダーする"
                   )}
                 </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
