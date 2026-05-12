import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { WineMaster, Store } from '../types';
import { useWines } from '../lib/WineContext';
import { db, auth } from '../lib/firebase';
import { signInAnonymously } from 'firebase/auth';
import { Wine, Edit2, Search } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { WineCard } from '../components/WineCard';
import { WineConcierge } from '../components/WineConcierge';
import { WineDetailModal } from '../components/WineDetailModal';

export const CustomerView: React.FC = () => {
  const { storeId: routeStoreId } = useParams();
  const { user, loading: authLoading } = useWines();
  const [selectedWine, setSelectedWine] = useState<WineMaster | null>(null);
  const [store, setStore] = useState<Store | null>(null);
  const [inventory, setInventory] = useState<WineMaster[]>([]);
  const [isDataFetching, setIsDataFetching] = useState(true);
  const [highlightedId] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'featured' | 'price_desc' | 'price_asc'>('featured');
  
  // Concierge state
  const [conciergeFilters, setConciergeFilters] = useState<{
    color: string | null;
    style: string | null;
    budget: number | null;
  }>({ color: null, style: null, budget: null });
  
  const [selectedDish, setSelectedDish] = useState<string | null>(null);

  const dishes = [
    { id: 'meat', label: 'お肉と', match: /肉|ステーキ|ラム|牛|豚/i },
    { id: 'fish', label: 'お魚と', match: /魚|シーフード|刺身|カルパッチョ/i },
    { id: 'appetizer', label: '前菜と', match: /前菜|サラダ|カルパッチョ|小皿/i }
  ];

  // Auto-refresh and Auth Handling
  useEffect(() => {
    const finalStoreId = routeStoreId || new URLSearchParams(window.location.search).get('storeId');
    if (!finalStoreId) return;

    const handleAuth = async () => {
      if (!auth.currentUser) {
        try {
          await signInAnonymously(auth);
        } catch (error) {
          console.error('[Auth] Anonymous sign-in failed:', error);
        }
      }
    };
    handleAuth();

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchStoreData();
      }
    };

    window.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleVisibilityChange);

    return () => {
      window.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleVisibilityChange);
    };
  }, [routeStoreId]);

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
    } finally {
      setIsDataFetching(false);
    }
  };

  useEffect(() => {
    fetchStoreData();
  }, [user, routeStoreId]);

  const SkeletonItem = () => (
    <div className="flex gap-6 p-6 rounded-[2.5rem] border border-brand-wine/5 animate-in fade-in duration-700 bg-white/50">
      <div className="w-28 h-36 skeleton shrink-0 rounded-2xl" />
      <div className="flex-1 flex flex-col justify-center gap-3">
        <div className="h-4 w-1/3 skeleton rounded" />
        <div className="h-7 w-3/4 skeleton rounded" />
        <div className="flex justify-between items-center mt-3">
          <div className="h-8 w-28 skeleton rounded-lg" />
          <div className="w-12 h-12 rounded-full skeleton" />
        </div>
      </div>
    </div>
  );

  if (isDataFetching) {
     return (
       <div className="min-h-screen bg-brand-ivory flex justify-center items-center">
         <div className="w-full md:max-w-[420px] md:h-[850px] bg-brand-ivory overflow-hidden flex flex-col relative md:phone-frame-simple">
           <header className="p-8 border-b border-brand-gold/20 bg-black/80 backdrop-blur-md sticky top-0 z-50">
             <div className="h-8 w-48 skeleton mx-auto rounded-lg" />
           </header>
           <div className="p-8 space-y-8 flex-1 overflow-hidden">
             <div className="h-12 w-full skeleton rounded-2xl" />
             <div className="space-y-6">
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
      <div className="min-h-screen bg-brand-wine flex flex-col items-center justify-center p-10 text-center">
        <Wine className="w-20 h-20 text-brand-gold/20 mb-8" />
        <h2 className="serif text-3xl text-brand-gold mb-6 uppercase tracking-widest">Store Not Found</h2>
        <p className="text-[15px] text-brand-ivory/70 leading-relaxed max-w-xs">QRコードを再度読み取るか、店舗スタッフにお声がけください。</p>
      </div>
    );
  }

  // Filtering Logic
  const filteredInventory = inventory.filter(w => {
    let matches = true;

    if (conciergeFilters.color) {
      matches = matches && w.color === conciergeFilters.color;
      
      if (conciergeFilters.style) {
        if (conciergeFilters.color === '赤') {
          if (conciergeFilters.style === 'フルボディ') matches = matches && (w.body || 0) >= 4;
          else if (conciergeFilters.style === 'ミディアムボディ') matches = matches && (w.body || 0) === 3;
          else if (conciergeFilters.style === 'ライトボディ') matches = matches && (w.body || 0) <= 2;
        } else {
          matches = matches && w.type === conciergeFilters.style;
        }
      }
    }

    if (conciergeFilters.budget) {
      if (conciergeFilters.budget === 999999) matches = matches && (w.price_bottle || 0) >= 20000;
      else matches = matches && (w.price_bottle || 0) <= conciergeFilters.budget;
    }

    if (selectedDish) {
      const dish = dishes.find(d => d.id === selectedDish);
      if (dish) matches = matches && dish.match.test(w.pairing || '');
    }

    return matches;
  });

  const displayedInventory = [...filteredInventory].sort((a, b) => {
    if (sortBy === 'featured') {
      if (a.isFeatured && !b.isFeatured) return -1;
      if (!a.isFeatured && b.isFeatured) return 1;
      return (b.price_bottle || 0) - (a.price_bottle || 0);
    }
    if (sortBy === 'price_desc') return (b.price_bottle || 0) - (a.price_bottle || 0);
    if (sortBy === 'price_asc') return (a.price_bottle || 0) - (b.price_bottle || 0);
    return 0;
  });

  const isFiltering = !!(conciergeFilters.color || conciergeFilters.budget || selectedDish);
  const noResults = isFiltering && filteredInventory.length === 0;
  const finalWines = noResults ? inventory.filter(w => w.isFeatured) : displayedInventory;

  return (
    <div id="customer-view" className="min-h-screen bg-brand-ivory md:py-10 flex justify-center items-center overflow-x-hidden">
      <div className="w-full md:max-w-[420px] md:h-[850px] md:phone-frame bg-brand-ivory overflow-hidden flex flex-col relative md:shadow-2xl min-h-screen md:min-h-0">
        
        {/* Header */}
        <header className="p-6 md:p-8 grid grid-cols-3 items-center border-b border-brand-gold/30 shrink-0 bg-black/80 backdrop-blur-xl sticky top-0 z-50">
          <div className="justify-self-start">
            {(user?.role === 'admin' || user?.role === 'rep' || user?.role === 'owner') && (
              <button 
                onClick={() => {
                  const target = (user.role === 'admin' || user.role === 'rep') ? 'admin' : 'owner';
                  window.location.href = `/${target}?storeId=${store.id}`;
                }}
                className="w-12 h-12 rounded-full bg-brand-gold/15 flex items-center justify-center border border-brand-gold/30 text-brand-gold hover:bg-brand-gold hover:text-brand-wine transition-all shadow-lg"
              >
                <Edit2 className="w-5 h-5" />
              </button>
            )}
          </div>
          <div className="justify-self-center text-center whitespace-nowrap overflow-hidden">
            <h1 className="font-serif text-brand-gold font-light text-2xl md:text-3xl tracking-[0.4em] uppercase leading-tight truncate px-2">
              {store.name}
            </h1>
          </div>
          <div className="justify-self-end">
            <div className="w-12" />
          </div>
        </header>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-10 pb-24 scroll-smooth">
          
          {/* Dish Selector */}
          <section className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-5 w-1.5 bg-brand-gold rounded-full" />
              <h4 className="text-[17px] font-bold text-brand-wine uppercase tracking-[0.2em]">お料理から選ぶ</h4>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {dishes.map(dish => (
                <button
                  key={dish.id}
                  onClick={() => setSelectedDish(selectedDish === dish.id ? null : dish.id)}
                  className={`flex flex-col items-center justify-center gap-2 py-4 rounded-2xl border-2 transition-all ${
                    selectedDish === dish.id 
                      ? 'bg-brand-gold text-brand-wine border-brand-gold shadow-luxury scale-[1.03]' 
                      : 'bg-white text-brand-wine/60 border-brand-gold/10 hover:border-brand-gold/30'
                  }`}
                >
                  <span className="text-[15px] font-black tracking-tight">{dish.label}</span>
                </button>
              ))}
            </div>
          </section>

          {/* Concierge */}
          <WineConcierge 
            inventory={inventory}
            onFilterChange={(f) => setConciergeFilters(f)}
            onClear={() => {
              setConciergeFilters({ color: null, style: null, budget: null });
              setSelectedDish(null);
            }}
          />

          {/* Wine List Header */}
          <div className="flex items-center justify-between px-2 pt-6 border-t border-brand-gold/10">
            <div className="flex items-center gap-2">
              <Search className="w-4 h-4 text-brand-wine/30" />
              <span className="text-[13px] font-bold text-brand-wine/40 uppercase tracking-widest">
                {finalWines.length} Items Found
              </span>
            </div>
            <select 
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-transparent text-[14px] font-black text-brand-wine/60 uppercase tracking-widest outline-none border-none cursor-pointer hover:text-brand-gold transition-colors"
            >
              <option value="featured">Recommended</option>
              <option value="price_desc">Price: High to Low</option>
              <option value="price_asc">Price: Low to High</option>
            </select>
          </div>

          {noResults && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-8 bg-brand-wine/[0.04] border border-brand-gold/25 rounded-[2.5rem] text-center shadow-inner"
            >
              <p className="text-[15px] text-brand-wine font-bold leading-relaxed mb-2">
                ご希望の条件に近い、<br/>ソムリエおすすめのワインを表示しています
              </p>
              <p className="text-[12px] text-brand-gold font-black uppercase tracking-widest opacity-60">
                Recommended for you
              </p>
            </motion.div>
          )}

          {/* Wine List */}
          <div className="grid gap-10">
            {finalWines.map((wine) => (
              <WineCard 
                key={wine.id}
                wine={wine}
                onClick={setSelectedWine}
                isFeatured={wine.isFeatured}
                highlighted={highlightedId === wine.id}
              />
            ))}
          </div>
        </div>

        {/* Modal */}
        <AnimatePresence>
          {selectedWine && (
            <WineDetailModal 
              wine={selectedWine}
              onClose={() => setSelectedWine(null)}
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
