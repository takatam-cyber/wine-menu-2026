import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { WineMaster, Store } from '../types';
import { useWines } from '../lib/WineContext';
import { WineProfile } from '../components/WineProfile';
import { AISommelier } from '../components/AISommelier';
import { db } from '../lib/firebase';
import { doc, getDoc, collection, getDocs, query, where, setDoc } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';
import { ChevronRight, Info, Wine, Utensils, Award, Loader2, Sparkles, CheckCircle2, Search, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export const CustomerView: React.FC = () => {
  const { storeId: routeStoreId } = useParams();
  const { wines, user, loading: authLoading } = useWines();
  const [selectedWine, setSelectedWine] = useState<WineMaster | null>(null);
  const [store, setStore] = useState<Store | null>(null);
  const [inventory, setInventory] = useState<WineMaster[]>([]);
  const [isDataFetching, setIsDataFetching] = useState(true);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const [showReturnToAI, setShowReturnToAI] = useState(false);
  const [showReturnFloating, setShowReturnFloating] = useState(false);
  const [isSommelierOpen, setIsSommelierOpen] = useState(false);
  const [sortBy, setSortBy] = useState<'price_asc' | 'price_desc' | 'vintage'>('price_asc');
  const [filterColor, setFilterColor] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sessionTimeLeft, setSessionTimeLeft] = useState<number | null>(null);

  // Session Monitoring
  useEffect(() => {
    const finalStoreId = routeStoreId || new URLSearchParams(window.location.search).get('storeId');
    if (!finalStoreId) return;

    const checkSession = () => {
      const sessionKey = `pieroth_session_${finalStoreId}`;
      const savedTime = localStorage.getItem(sessionKey);
      if (savedTime) {
        const startTime = parseInt(savedTime);
        const TWO_HOURS_MS = 2 * 60 * 60 * 1000;
        const timeLeft = TWO_HOURS_MS - (Date.now() - startTime);
        setSessionTimeLeft(timeLeft);
      }
    };

    checkSession();
    const interval = setInterval(checkSession, 30000); // Check every 30s
    return () => clearInterval(interval);
  }, [routeStoreId]);

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
  }, [isDataFetching]);

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
    const finalStoreId = routeStoreId || user?.storeId;

    if (!finalStoreId) {
      if (authLoading) return; 
      setIsDataFetching(false);
      return;
    }

    try {
      const response = await fetch(`/api/menu/${finalStoreId}`);
      if (!response.ok) throw new Error("Failed to fetch menu");
      
      const data = await response.json();
      setStore(data.store);
      setInventory(data.menu);
    } catch (error) {
      console.error("Fetch Error:", error);
      // Fallback or error handling
    } finally {
      setIsDataFetching(false);
    }
  };

  useEffect(() => {
    fetchStoreData();
  }, [user, routeStoreId]);

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

  if (isDataFetching) {
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
                  setIsDataFetching(true);
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
              className="fixed bottom-12 right-6 z-[60] w-24 h-24 bg-gradient-to-br from-brand-gold via-white to-brand-gold text-brand-wine rounded-full shadow-[0_0_50px_rgba(212,175,55,0.7),0_25px_60px_rgba(0,0,0,0.5)] flex flex-col items-center justify-center border-4 border-brand-wine/20 backdrop-blur-xl cursor-pointer group p-2 overflow-hidden"
            >
              <div className="absolute inset-0 rounded-full animate-ping bg-brand-gold/10 pointer-events-none" />
              <div className="absolute inset-0 rounded-full animate-pulse bg-brand-gold/20" />
              <div className="absolute -top-1 -right-1 bg-brand-wine text-brand-gold text-[10px] font-black px-2 py-0.5 rounded-full border border-brand-gold shadow-2xl z-10">
                BACK
              </div>
              <Sparkles className="w-8 h-8 mb-1 group-hover:rotate-12 transition-transform duration-500 text-brand-wine shadow-sm" />
              <div className="text-[8px] font-black tracking-tighter leading-none text-center uppercase text-brand-wine">
                SOMMELIER
              </div>
            </motion.button>
          )}
        </AnimatePresence>

        {/* Session Warning */}
        <AnimatePresence>
          {sessionTimeLeft !== null && sessionTimeLeft > 0 && sessionTimeLeft < 10 * 60 * 1000 && (
            <motion.div
              initial={{ y: -50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -50, opacity: 0 }}
              className="absolute top-20 inset-x-4 z-[70]"
            >
              <div className="bg-amber-500/95 backdrop-blur-md text-white px-4 py-3 rounded-2xl shadow-xl flex items-center gap-3 border border-amber-400">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <div className="flex-1">
                  <p className="text-[10px] font-bold uppercase tracking-widest leading-none mb-0.5">まもなくセッションが切れます</p>
                  <p className="text-[8px] opacity-90">再度QRコードを読み取る必要があります（残り約{Math.ceil(sessionTimeLeft / 60000)}分）</p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

      {/* Loading Skeleton */}
      <AnimatePresence>
        {isDataFetching && (
          <div className="flex-1 p-6 space-y-8 overflow-hidden bg-brand-ivory">
            <div className="space-y-4">
              <div className="w-32 h-4 bg-brand-gold/20 rounded animate-pulse" />
              <div className="w-64 h-10 bg-brand-wine/10 rounded-2xl animate-pulse" />
            </div>
            <div className="grid gap-6">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="flex gap-5 p-5 border border-brand-wine/5 rounded-[2.5rem] bg-white">
                  <div className="w-32 h-36 bg-slate-100 rounded-[2rem] animate-pulse" />
                  <div className="flex-1 space-y-4 py-4">
                    <div className="w-24 h-3 bg-brand-gold/20 rounded animate-pulse" />
                    <div className="w-full h-6 bg-brand-wine/10 rounded animate-pulse" />
                    <div className="flex justify-between items-center pt-4">
                      <div className="w-20 h-8 bg-brand-wine/5 rounded animate-pulse" />
                      <div className="w-12 h-12 rounded-full bg-brand-gold/10 animate-pulse" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </AnimatePresence>

      <div className={`flex-1 mt-0 md:mt-8 flex flex-col overflow-hidden ${isDataFetching ? 'hidden' : ''}`}>
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
          <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-8 pb-20 scroll-smooth">
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
                  <h2 className="serif text-lg text-brand-wine tracking-[0.1em] uppercase font-bold">The Collection</h2>
                  <div className="flex items-center gap-2">
                    <select 
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value as any)}
                      className="bg-transparent text-[9px] font-bold text-brand-gold/80 uppercase tracking-[0.2em] outline-none border-none cursor-pointer hover:text-brand-gold transition-colors"
                    >
                      <option value="price_asc">価格の安い順</option>
                      <option value="price_desc">価格の高い順</option>
                      <option value="vintage">ヴィンテージ順</option>
                    </select>
                  </div>
                </div>
                
                <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                  {[
                    { id: 'all', label: 'すべて' },
                    { id: '赤', label: '赤ワイン' },
                    { id: '白', label: '白ワイン' },
                    { id: '泡', label: 'スパークリング' },
                    { id: 'デザート', label: 'デザート' },
                    { id: 'ロゼ', label: 'ロゼ' }
                  ].map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => setFilterColor(tab.id)}
                      className={`px-6 py-2.5 rounded-full text-[9px] font-bold tracking-[0.3em] uppercase transition-all shrink-0 border ${
                        filterColor === tab.id 
                          ? 'bg-brand-wine text-brand-gold border-brand-gold shadow-md' 
                          : 'bg-white/50 text-brand-wine/60 border-brand-wine/10'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                <div className="relative group">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="地域、品種、気分から探す..."
                    className="w-full bg-brand-wine/5 border border-brand-gold/10 rounded-2xl py-3 pl-4 pr-10 text-xs text-brand-wine placeholder:text-brand-wine/30 focus:outline-none focus:border-brand-gold/40 focus:bg-white transition-all shadow-inner uppercase tracking-widest"
                  />
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 text-brand-gold opacity-40">
                    <Search className="w-4 h-4" strokeWidth={1.5} />
                  </div>
                </div>
              </div>
              
              <div className="grid gap-8">
                {/* Featured Section */}
                <AnimatePresence>
                  {displayedInventory.some(w => w.isFeatured) && (
                    <div className="space-y-6">
                      <div className="flex items-center gap-3 px-2">
                        <Sparkles className="w-5 h-5 text-brand-gold" />
                        <h3 className="serif text-xs text-brand-gold uppercase tracking-[0.4em] font-bold">Sommelier's Selection</h3>
                        <div className="flex-1 h-px bg-brand-gold/20" />
                      </div>
                      <div className="grid gap-8">
                        {displayedInventory.filter(w => w.isFeatured).map((wine) => (
                          <motion.div
                            key={wine.id}
                            id={`wine-${wine.id}`}
                            initial={{ opacity: 0, y: 30 }}
                            animate={{ opacity: 1, y: 0 }}
                            whileTap={{ scale: 0.96 }}
                            onClick={() => setSelectedWine(wine)}
                            className="group cursor-pointer relative p-1 rounded-[3rem] overflow-hidden"
                          >
                            {/* Luxury Animated Border */}
                            <div className="absolute inset-0 bg-gradient-to-br from-brand-gold via-white to-brand-gold opacity-30 animate-pulse" />
                            <div className="absolute inset-[1px] bg-brand-ivory rounded-[3rem] z-0 overflow-hidden">
                               {/* Luxury Gold Shimmer Animation */}
                               <motion.div 
                                 initial={{ x: "-100%" }}
                                 animate={{ x: "200%" }}
                                 transition={{ 
                                   duration: 3, 
                                   repeat: Infinity, 
                                   ease: "linear",
                                   repeatDelay: 5
                                 }}
                                 className="absolute inset-y-0 w-1/2 bg-gradient-to-r from-transparent via-brand-gold/10 to-transparent skew-x-12 z-0"
                               />
                            </div>
                            
                            <div className="relative z-10 flex gap-5 p-6 rounded-[3rem] bg-brand-gold/[0.04] shadow-[0_20px_50px_rgba(212,175,55,0.25)] border border-brand-gold/30">
                              <div className="w-32 h-40 bg-white flex items-center justify-center p-4 rounded-[2rem] relative border border-brand-gold/20 shadow-xl group-hover:border-brand-gold/50 transition-all overflow-hidden shrink-0">
                                <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/cream-paper.png')]" />
                                <img
                                  src={`/api/proxy-image?url=${encodeURIComponent(wine.image_url)}`}
                                  alt=""
                                  crossOrigin="anonymous"
                                  referrerPolicy="no-referrer"
                                  className="w-full h-full object-contain group-hover:scale-110 transition-transform duration-1000 ease-out drop-shadow-2xl"
                                />
                              </div>
                              <div className="flex-1 flex flex-col justify-center gap-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <div className="px-2 py-0.5 bg-brand-wine text-brand-gold text-[7px] font-black rounded-full uppercase tracking-widest">Featured</div>
                                  <div className="text-[9px] uppercase font-bold text-brand-gold tracking-[0.4em]">
                                    {wine.region} · {wine.vintage}
                                  </div>
                                </div>
                                <h3 className="serif text-xl text-brand-wine leading-tight tracking-tight group-hover:text-brand-gold transition-colors">{wine.name_jp}</h3>
                                <div className="flex items-center justify-between mt-4">
                                  <div className="flex flex-col">
                                     <span className="serif text-2xl text-brand-wine font-medium tracking-tighter">¥{wine.price_bottle?.toLocaleString()}</span>
                                  </div>
                                  <div className="w-12 h-12 rounded-full bg-brand-wine text-brand-gold flex items-center justify-center transition-all border border-brand-gold/40 shadow-lg">
                                    <ChevronRight className="w-7 h-7" />
                                  </div>
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                      <div className="h-px bg-brand-gold/10 mx-10" />
                    </div>
                  )}
                </AnimatePresence>

                {/* Regular Menu Section */}
                <div className="space-y-6">
                  {displayedInventory.some(w => !w.isFeatured) && (
                    <div className="px-2 pb-2">
                       <h3 className="text-[10px] text-brand-wine/40 uppercase tracking-[0.4em] font-bold">Standard Collection</h3>
                    </div>
                  )}
                  <div className="grid gap-6">
                    {displayedInventory.filter(w => !w.isFeatured).map((wine) => (
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
                          scale: [1, 1.05, 1]
                        } : {}}
                        transition={highlightedId === wine.id ? { duration: 0.8 } : {}}
                        onClick={() => setSelectedWine(wine)}
                        className="group cursor-pointer flex gap-5 border border-transparent border-b-brand-wine/5 p-4 hover:bg-brand-gold/[0.02] transition-all duration-300 relative overflow-hidden"
                      >
                        <div className="w-24 h-28 bg-white/50 backdrop-blur-sm flex items-center justify-center p-3 rounded-2xl relative border border-brand-gold/10 shadow-sm group-hover:border-brand-gold/30 transition-all shrink-0">
                          <img
                            src={`/api/proxy-image?url=${encodeURIComponent(wine.image_url)}`}
                            alt=""
                            crossOrigin="anonymous"
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-700"
                          />
                        </div>
                        <div className="flex-1 flex flex-col justify-center gap-0.5">
                          <div className="text-[8px] uppercase font-bold text-brand-gold/60 tracking-[0.3em]">
                            {wine.region} · {wine.vintage}
                          </div>
                          <h3 className="serif text-lg text-brand-wine leading-tight group-hover:text-brand-gold transition-colors">{wine.name_jp}</h3>
                          <div className="flex items-center justify-between mt-2">
                             <span className="serif text-xl text-brand-wine font-medium">¥{wine.price_bottle?.toLocaleString()}</span>
                             <ChevronRight className="w-5 h-5 text-brand-gold opacity-0 group-hover:opacity-100 transition-all translate-x-[-10px] group-hover:translate-x-0" />
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Global Footer (QR Action Removed) */}
        <div className="absolute bottom-6 inset-x-6 z-40 flex justify-center pointer-events-none">
          <AnimatePresence>
            {showReturnToAI && store.hasAiSommelier !== false && (
              <motion.button
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                onClick={() => setIsSommelierOpen(true)}
                className="pointer-events-auto w-full max-w-[280px] bg-brand-wine text-brand-gold py-3.5 rounded-full font-bold text-[10px] tracking-[0.3em] uppercase border border-brand-gold/30 shadow-[0_15px_40px_rgba(0,0,0,0.5)] flex items-center justify-center gap-2 hover:bg-white hover:text-brand-wine transition-all"
              >
                <Sparkles className="w-4 h-4" />
                Ask the Sommelier
              </motion.button>
            )}
          </AnimatePresence>
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
                    <img 
                      src={`/api/proxy-image?url=${encodeURIComponent(selectedWine.image_url)}`}
                      alt="" 
                      crossOrigin="anonymous"
                      referrerPolicy="no-referrer"
                      className="h-full object-contain relative z-10 transition-transform duration-2000 group-hover:scale-105" 
                    />
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
