import React, { useState, useEffect } from 'react';
import { WineMaster, Store } from '../types';
import { useWines } from '../lib/WineContext';
import { WineProfile } from '../components/WineProfile';
import { AISommelier } from '../components/AISommelier';
import { db } from '../lib/firebase';
import { doc, getDoc, collection, getDocs } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';
import { ChevronRight, Info, Wine, Utensils, Award, Loader2, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export const CustomerView: React.FC = () => {
  const { wines } = useWines();
  const [selectedWine, setSelectedWine] = useState<WineMaster | null>(null);
  const [store, setStore] = useState<Store | null>(null);
  const [inventory, setInventory] = useState<WineMaster[]>([]);
  const [loading, setLoading] = useState(true);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const [showReturnToAI, setShowReturnToAI] = useState(false);
  const [showReturnFloating, setShowReturnFloating] = useState(false);
  const [isSommelierOpen, setIsSommelierOpen] = useState(false);

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
        
        // Fetch matching master data from Firestore for these inventory items
        // (Since we are removing static MASTER_WINES)
        const enriched: WineMaster[] = [];
        
        for (const item of activeItems) {
          const masterDoc = await getDoc(doc(db, 'winesMaster', item.id));
          if (masterDoc.exists()) {
            const masterData = masterDoc.data() as WineMaster;
            enriched.push({
              ...masterData,
              id: masterDoc.id,
              price_bottle: item.price_bottle || masterData.price_bottle,
              price_glass: item.price_glass || masterData.price_glass
            });
          }
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
    if (wines.length > 0) {
      fetchStoreData();
    }
  }, [wines]);

  if (loading) {
     return (
       <div className="min-h-screen bg-brand-wine flex flex-col items-center justify-center gap-6">
         <Loader2 className="w-12 h-12 animate-spin text-brand-gold" />
         <p className="serif italic text-brand-gold/60 text-lg tracking-widest">PREPARING MENU...</p>
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
            <button 
              onClick={() => setIsSommelierOpen(true)}
              className="flex flex-col items-center gap-1 text-brand-gold hover:opacity-80 transition-all group"
            >
              <div className="w-10 h-10 rounded-full bg-brand-gold/10 flex items-center justify-center border border-brand-gold/20 group-hover:scale-110 transition-transform">
                <Sparkles className="w-5 h-5" />
              </div>
              <span className="text-[8px] font-bold tracking-tighter">AIソムリエ</span>
            </button>
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
            <AISommelier 
              availableWines={inventory} 
              storeId={store.id}
              cuisineType={store.cuisine_type} 
              onSelectWine={handleSelectWine}
              isOpen={isSommelierOpen}
              setIsOpen={setIsSommelierOpen}
            />

            <div className="space-y-6">
              <div className="flex items-center justify-between border-b border-brand-gold/30 pb-2 mb-8">
                <h2 className="serif text-2xl text-brand-wine tracking-tight">ソムリエ厳選銘柄</h2>
                <span className="text-[10px] font-bold text-brand-gold uppercase tracking-[0.2em]">Digital List</span>
              </div>
              
              <div className="grid gap-6">
                {inventory.map((wine) => (
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
                    className={`group cursor-pointer flex gap-5 border border-transparent p-4 rounded-[2rem] transition-all duration-1000 ${
                      highlightedId === wine.id 
                        ? 'z-20 border-brand-gold bg-brand-gold/5' 
                        : 'border-b border-brand-wine/5 hover:bg-brand-gold/5'
                    }`}
                  >
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
               {showReturnToAI && (
                 <motion.button
                   initial={{ opacity: 0, y: 20 }}
                   animate={{ opacity: 1, y: 0 }}
                   exit={{ opacity: 0, y: 20 }}
                   onClick={() => setIsSommelierOpen(true)}
                   className="w-full bg-white/90 backdrop-blur-md text-brand-wine py-3 rounded-2xl font-bold text-[10px] tracking-[0.2em] uppercase border border-brand-gold/30 shadow-lg flex items-center justify-center gap-2 hover:bg-white transition-all shadow-[0_4px_20px_rgba(212,175,55,0.2)]"
                 >
                   <Sparkles className="w-3 h-3 text-brand-gold" />
                   ソムリエに相談する
                 </motion.button>
               )}
             </AnimatePresence>
             <button className="w-full bg-brand-gold text-brand-wine py-4 rounded-2xl font-bold text-[11px] tracking-[0.4em] uppercase border border-brand-gold shadow-[0_0_30px_rgba(212,175,55,0.3)] hover:scale-[1.02] active:scale-95 transition-all">
               ソムリエを呼ぶ
             </button>
           </div>
        </div>

        {/* Wine Details Modal */}
        <AnimatePresence>
          {selectedWine && (
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
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
                 <button className="w-full bg-brand-gold text-brand-wine py-4 rounded-2xl font-bold text-[12px] tracking-[0.4em] uppercase shadow-[0_10px_40px_rgba(212,175,55,0.4)] hover:brightness-110 active:scale-95 transition-all">
                   オーダーする
                 </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
