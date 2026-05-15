import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { WineMaster, Store } from '../types';
import { useWines } from '../lib/WineContext';
import { WineProfile } from '../components/WineProfile';
import { AuthImage } from '../components/ui/AuthImage';
import { db, auth } from '../lib/firebase';
import { signInAnonymously } from 'firebase/auth';
import { doc, getDoc, collection, getDocs, query, where, setDoc } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';
import { ChevronRight, ChevronDown, Info, Wine, Utensils, Award, Loader2, Sparkles, CheckCircle2, Search, AlertCircle, Edit2, Beef, Fish, ChefHat, MapPin, Tag } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

import { usePublicMenuQuery } from '../hooks/usePublicMenuQuery';

export const CustomerView: React.FC = () => {
  const { storeId: routeStoreId } = useParams();
  const { user, loading: authLoading } = useWines();
  const [language, setLanguage] = useState<'jp' | 'en'>('jp');
  const [isConciergeOpen, setIsConciergeOpen] = useState(false);
  const [selectedWine, setSelectedWine] = useState<WineMaster | null>(null);
  const [isScrolled, setIsScrolled] = useState(false);

  // Scroll Lock for Concierge & Modal
  useEffect(() => {
    if (isConciergeOpen || !!selectedWine) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isConciergeOpen, !!selectedWine]);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);
  
  // Filters State
  const [activeCuisine, setActiveCuisine] = useState<string | null>(null);
  const [activeColor, setActiveColor] = useState<string | null>(null);
  const [activeBudget, setActiveBudget] = useState<string | null>(null);

  // Concierge State
  const [step1Color, setStep1Color] = useState<string | null>(null);
  const [step2Style, setStep2Style] = useState<string | null>(null);
  const [step3Budget, setStep3Budget] = useState<number | null>(null);
  const [selectedDish, setSelectedDish] = useState<string | null>(null);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'featured' | 'price_desc' | 'price_asc'>('featured');

  const t = {
    jp: {
      selectFromDishes: 'お料理から選ぶ',
      budget: '予算',
      clear: 'クリア',
      sort: '並び替え',
      wineConcierge: 'ワイン・コンシェルジュ',
      recommended: 'おすすめ順',
      priceDesc: '価格が高い順',
      priceAsc: '価格が安い順',
      meat: 'お肉料理',
      fish: 'お魚料理',
      appetizer: '前菜・サラダ',
      sparkling: 'スパークリング',
      red: '赤',
      white: '白',
      sommelierSelection: "Sommelier's Selection",
      standardCollection: "Standard Collection",
      noResults: "ご希望の条件に近い、ソムリエおすすめのワインを表示しています",
      showingRecommended: "Showing Recommended Selections",
      consultStaff: "条件に合うワインが見つからない場合はスタッフにお尋ねください",
      bottle: "ボトル",
      glass: "グラス",
      vintage: "ヴィンテージ",
      grape: "主要品種",
      flavorProfile: "味わいのプロファイル",
      sommelierExplanation: "ソムリエによる解説",
      bestMarriage: "最高のマリアージュ",
      underTwenty: "飲酒は20歳になってから正しく適切に。",
      loading: "読み込み中...",
      notFound: "店舗が見つかりません",
      qrRetry: "QRコードを再度読み取ってください。または店舗スタッフにお声がけください。",
      preparation: "現在、ソムリエが在庫状況の最終確認およびワインリストの調整を行っております。まもなく公開されますので、少々お待ちください。",
      urgent: "恐れ入りますが、お急ぎの場合は近くのスタッフまでお声がけください。",
      refresh: "リストを更新する",
      showResults: "結果を表示する",
      chooseColor: "ワインの色を選ぶ",
      chooseStyle: "スタイルを選ぶ",
      narrowBudget: "予算から絞り込む",
      back: "戻る",
      fullBodied: "フルボディ",
      mediumBodied: "ミディアムボディ",
      lightBodied: "ライトボディ",
      dry: "辛口",
      mediumDry: "中辛口",
      sweet: "甘口",
      yen: "円",
    },
    en: {
      selectFromDishes: 'Select from Dishes',
      budget: 'Budget',
      clear: 'Clear',
      sort: 'Sort',
      wineConcierge: 'Wine Concierge',
      recommended: 'Recommended',
      priceDesc: 'Price: High to Low',
      priceAsc: 'Price: Low to High',
      meat: 'Meat Dishes',
      fish: 'Fish Dishes',
      appetizer: 'Appetizers & Salads',
      sparkling: 'Sparkling',
      red: 'Red',
      white: 'White',
      sommelierSelection: "Sommelier's Selection",
      standardCollection: "Standard Collection",
      noResults: "Matching wines weren't found. Showing our sommelier's top recommendations.",
      showingRecommended: "Showing Recommended Selections",
      consultStaff: "If you cannot find your ideal wine, please consult our staff.",
      bottle: "Bottle",
      glass: "Glass",
      vintage: "Vintage",
      grape: "Grapes",
      flavorProfile: "Flavor Profile",
      sommelierExplanation: "Sommelier's Note",
      bestMarriage: "Best Pairings",
      underTwenty: "Drinking age is 20 and over. Enjoy responsibly.",
      loading: "Loading...",
      notFound: "Store not found",
      qrRetry: "Please try scanning the QR code again or contact the staff.",
      preparation: "Our sommelier is finalizing the list. It will be available shortly.",
      urgent: "We apologize for the wait. If you are in a hurry, please contact our staff.",
      refresh: "Refresh List",
      showResults: "Show Results",
      chooseColor: "Choose Color",
      chooseStyle: "Choose Style",
      narrowBudget: "Narrow by Budget",
      back: "Back",
      fullBodied: "Full-bodied",
      mediumBodied: "Medium-bodied",
      lightBodied: "Light-bodied",
      dry: "Dry",
      mediumDry: "Med-Dry",
      sweet: "Sweet",
      yen: "JPY",
    }
  };

  const finalStoreId = routeStoreId || new URLSearchParams(window.location.search).get('storeId') || user?.storeId;
  const { data: menuData, isLoading: isDataFetching, refetch: fetchStoreData } = usePublicMenuQuery(finalStoreId || null);
  
  const store = menuData?.store || null;
  const inventory = menuData?.menu || [];

  interface FilterOption {
    id: string;
    label: string;
    min?: number;
    max?: number;
  }

  interface ConciergeOption {
    id: number;
    label: string;
    min?: number;
    max?: number;
  }

  const budgetFilters: FilterOption[] = store?.budgetTiers && store.budgetTiers.length > 0 
    ? (store.budgetTiers.map((tier, idx, arr) => {
        if (idx === 0) return { id: `b${idx}`, label: `〜¥${tier.toLocaleString()}`, max: tier };
        return { id: `b${idx}`, label: `¥${arr[idx-1].toLocaleString()}〜¥${tier.toLocaleString()}`, min: arr[idx-1], max: tier };
      }) as FilterOption[]).concat([{ id: 'blast', label: `¥${store.budgetTiers[store.budgetTiers.length - 1].toLocaleString()}〜`, min: store.budgetTiers[store.budgetTiers.length - 1] }])
    : [
        { id: 'b1', label: '〜¥5,000', max: 5000 },
        { id: 'b2', label: '〜¥10,000', max: 10000 },
        { id: 'b3', label: '¥10,000〜', min: 10000 }
      ];

  const conciergeBudgets: ConciergeOption[] = store?.budgetTiers && store.budgetTiers.length > 0
    ? (store.budgetTiers.map(tier => ({ id: tier, label: `〜${tier.toLocaleString()}${t[language].yen || '円'}`, max: tier })) as ConciergeOption[])
        .concat([{ id: 999999, label: `${store.budgetTiers[store.budgetTiers.length - 1].toLocaleString()}${t[language].yen || '円'}以上`, min: store.budgetTiers[store.budgetTiers.length - 1] }])
    : [
        { id: 5000, label: `〜5,000${t[language].yen || '円'}`, max: 5000 },
        { id: 10000, label: `〜10,000${t[language].yen || '円'}`, max: 10000 },
        { id: 20000, label: `〜20,000${t[language].yen || '円'}`, max: 20000 },
        { id: 999999, label: `20,000${t[language].yen || '円'}以上`, min: 20000 }
      ];

  const cuisineFilters = [
    { id: 'meat', label: t[language].meat, match: /肉|ステーキ|ラム|牛|豚/i },
    { id: 'fish', label: t[language].fish, match: /魚|シーフード|刺身|カルパッチョ/i },
    { id: 'appetizer', label: t[language].appetizer, match: /前菜|サラダ|カルパッチョ|小皿/i }
  ];

  const getDynamicStyles = (color: string) => {
    // Extract unique types from inventory for this color
    const stylesInInventory = Array.from(new Set(inventory
      .filter(w => w.color === color && w.type)
      .map(w => w.type as string)
    )).sort();
    
    if (stylesInInventory.length > 0) return stylesInInventory;

    // Fallbacks if no types found in current inventory
    if (color === '赤') return [t[language].fullBodied, t[language].mediumBodied, t[language].lightBodied];
    if (color === '白') return [t[language].dry, t[language].mediumDry, t[language].sweet];
    if (color === '泡' || color === 'スパークリング') return ['Brut', 'Extra Dry', 'Demi-Sec'];
    
    return [t[language].dry, t[language].sweet];
  };

  // Auto-refresh and Auth Handling
  useEffect(() => {
    const finalStoreId = routeStoreId || new URLSearchParams(window.location.search).get('storeId');
    if (!finalStoreId) return;

    // --- Anonymous Auth for Customers ---
    const handleAuth = async () => {
      if (!auth.currentUser) {
        try {
          console.log('[Auth] Attempting anonymous sign-in...');
          await signInAnonymously(auth);
        } catch (error) {
          console.error('[Auth] Anonymous sign-in failed:', error);
        }
      }
    };
    handleAuth();

    // --- Auto-refresh on visibility/focus change ---
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

  const handleSelectWine = (id: string) => {
    const element = document.getElementById(`wine-${id}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setHighlightedId(id);
      
      // Shortened to 0.8s for enterprise-grade snappiness
      setTimeout(() => {
        setHighlightedId(null);
      }, 800);
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
        <h2 className="serif text-2xl text-brand-gold mb-4">{t[language].notFound}</h2>
        <p className="text-sm text-brand-ivory/60 leading-relaxed max-w-xs">{t[language].qrRetry}</p>
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
                <span className="italic opacity-60 serif text-[11px] tracking-[0.3em] uppercase">Under Selection</span>
                <div className="h-px w-8 bg-brand-gold/30" />
              </div>
            </div>
            
            <div className="space-y-4">
              <p className="text-[12px] text-brand-ivory/80 leading-relaxed max-w-[320px] mx-auto serif italic tracking-[0.15em] uppercase">
                {t[language].preparation}
              </p>
              <p className="text-[11px] text-brand-gold/60 leading-relaxed max-w-[280px] mx-auto serif tracking-[0.1em]">
                {language === 'en' ? t[language].urgent : <>{t[language].urgent}</>}
              </p>
            </div>

            <div className="text-[11px] text-brand-gold/30 tracking-[0.4em] uppercase font-bold pt-4">
              Est. Preparation Time: Moments
            </div>
          </div>

          <div className="mt-20 flex flex-col gap-5 items-center">
             <button 
                onClick={() => {
                  fetchStoreData();
                }}
                className="px-14 py-4 bg-transparent border border-brand-gold/30 text-brand-gold text-[10px] uppercase tracking-[0.4em] rounded-full hover:bg-brand-gold/10 hover:border-brand-gold/60 active:scale-95 transition-all font-bold backdrop-blur-md shadow-lg"
              >
                {t[language].refresh}
              </button>
              
              <div className="flex items-center gap-3 opacity-30">
                <div className="w-1 h-1 rounded-full bg-brand-gold" />
                <p className="text-[11px] text-brand-gold uppercase tracking-[0.5em] font-mono">
                  {store.name}
                </p>
                <div className="w-1 h-1 rounded-full bg-brand-gold" />
              </div>
          </div>
        </motion.div>
      </div>
    );
  }

  const displayedInventoryRaw = inventory.filter(w => {
    let matches = true;

    // Quick Chips Filters
    if (activeColor) {
      matches = matches && w.color === activeColor;
    }

    if (activeCuisine) {
      const cuisine = cuisineFilters.find(c => c.id === activeCuisine);
      if (cuisine) matches = matches && cuisine.match.test(w.pairing || '');
    }

    if (activeBudget) {
      const budget = budgetFilters.find(b => b.id === activeBudget);
      if (budget) {
        if (budget.max) matches = matches && (w.price_bottle || 0) <= budget.max;
        if (budget.min) matches = matches && (w.price_bottle || 0) >= budget.min;
      }
    }

    // Concierge Filters
    if (step1Color) {
      matches = matches && w.color === step1Color;
      
      if (step2Style) {
        if (step1Color === '赤') {
          if (step2Style === 'フルボディ') matches = matches && (w.body || 0) >= 4;
          else if (step2Style === 'ミディアムボディ') matches = matches && (w.body || 0) === 3;
          else if (step2Style === 'ライトボディ') matches = matches && (w.body || 0) <= 2;
        } else {
          matches = matches && w.type === step2Style;
        }
      }
    }

    if (step3Budget) {
      const budget = conciergeBudgets.find(b => b.id === step3Budget);
      if (budget) {
        if (budget.max) matches = matches && (w.price_bottle || 0) <= budget.max;
        if (budget.min) matches = matches && (w.price_bottle || 0) >= budget.min;
      }
    }

    if (selectedDish) {
      const dish = cuisineFilters.find(d => d.id === selectedDish);
      if (dish) matches = matches && dish.match.test(w.pairing || '');
    }

    return matches;
  });

  const hasNoResults = (activeColor || activeCuisine || activeBudget || step1Color || step2Style || step3Budget || selectedDish) && displayedInventoryRaw.length === 0;
  
  const displayedInventory = (hasNoResults ? inventory.filter(w => w.isFeatured) : displayedInventoryRaw)
    .sort((a, b) => {
      if (sortBy === 'featured') {
        // Prioritize featured wines
        if (a.isFeatured && !b.isFeatured) return -1;
        if (!a.isFeatured && b.isFeatured) return 1;
        // Then sort by price desc
        return (b.price_bottle || 0) - (a.price_bottle || 0);
      }
      
      if (sortBy === 'price_desc') return (b.price_bottle || 0) - (a.price_bottle || 0);
      if (sortBy === 'price_asc') return (a.price_bottle || 0) - (b.price_bottle || 0);
      return 0;
    });

  return (
    <div id="customer-view" className="min-h-screen bg-brand-ivory relative">
      {/* Header - Fixed Top */}
      {!isDataFetching && store && (
        <header className={`fixed top-0 inset-x-0 h-16 flex items-center px-6 border-b transition-all duration-500 z-[100] ${
          isScrolled ? 'bg-black/90 backdrop-blur-md border-brand-gold/20' : 'bg-black border-brand-gold/30'
        }`}>
          <div className="flex-1">
            {(user?.role === 'admin' || user?.role === 'rep' || user?.role === 'owner') && (
              <button 
                onClick={() => {
                  if (user.role === 'admin' || user.role === 'rep') {
                    window.location.href = `/admin?storeId=${store.id}`;
                  } else {
                    window.location.href = `/owner?storeId=${store.id}`;
                  }
                }}
                className="w-10 h-10 rounded-full bg-brand-gold/10 flex items-center justify-center border border-brand-gold/20 text-brand-gold hover:bg-brand-gold hover:text-brand-wine transition-all"
              >
                <Edit2 className="w-5 h-5" />
              </button>
            )}
          </div>
          <div className="flex-none text-center flex items-center gap-4">
            <h1 className="font-serif text-brand-gold font-light text-xl md:text-2xl tracking-[0.4em] uppercase leading-tight">
              {store.name}
            </h1>
            <div className="flex items-center bg-white/5 rounded-full p-1 border border-brand-gold/20 shadow-inner">
              <button 
                onClick={() => setLanguage('jp')} 
                className={`relative px-3 py-1 rounded-full text-[10px] font-black transition-all duration-300 z-10 ${
                  language === 'jp' ? 'text-brand-gold-dark' : 'text-brand-gold/40 hover:text-brand-gold/70'
                }`}
              >
                {language === 'jp' && (
                  <motion.div 
                    layoutId="activeLang"
                    className="absolute inset-0 bg-brand-gold rounded-full -z-10 shadow-sm"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                  />
                )}
                JP
              </button>
              <button 
                onClick={() => setLanguage('en')} 
                className={`relative px-3 py-1 rounded-full text-[10px] font-black transition-all duration-300 z-10 ${
                  language === 'en' ? 'text-brand-gold-dark' : 'text-brand-gold/40 hover:text-brand-gold/70'
                }`}
              >
                {language === 'en' && (
                  <motion.div 
                    layoutId="activeLang"
                    className="absolute inset-0 bg-brand-gold rounded-full -z-10 shadow-sm"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                  />
                )}
                EN
              </button>
            </div>
          </div>
          <div className="flex-1" />
        </header>
      )}

      {/* Main Content Area */}
      <div className={`flex flex-col ${isDataFetching ? '' : 'pt-16'}`}>
        {isDataFetching ? (
          <div className="p-6 space-y-8 overflow-hidden bg-brand-ivory">
            {/* ... Skeleton Loading (existing) ... */}
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
        ) : (
          <>
            {/* Sticky Sort Bar */}
            <div className={`sticky top-[64px] z-[90] transition-all duration-500 border-b ${
              isScrolled 
                ? 'bg-brand-ivory/95 backdrop-blur-md border-brand-gold/20 shadow-[0_4px_25px_rgba(0,0,0,0.1)]' 
                : 'bg-brand-ivory border-brand-gold/10'
            }`}>
              <div className="flex overflow-x-auto no-scrollbar py-3 px-4 gap-2 items-center">
                <button 
                  onClick={() => {
                    setActiveColor(null);
                    setActiveCuisine(null);
                    setActiveBudget(null);
                    setSelectedDish(null);
                    setStep1Color(null);
                    setStep2Style(null);
                    setStep3Budget(null);
                    setSortBy('featured');
                  }}
                  className={`px-4 py-1.5 rounded-full text-[11px] font-black uppercase tracking-widest transition-all whitespace-nowrap border ${
                    !activeColor && !activeCuisine && !activeBudget && !step1Color
                      ? 'bg-brand-gold-dark text-white border-brand-gold-dark shadow-md' 
                      : 'bg-white border-brand-gold/20 text-brand-gold-dark'
                  }`}
                >
                  {t[language].clear}
                </button>
                
                <div className="w-px h-4 shrink-0 bg-brand-gold/20" />
                
                {['赤', '白', '泡'].map(color => (
                  <button
                    key={color}
                    onClick={() => setActiveColor(activeColor === color ? null : color)}
                    className={`px-4 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-wider transition-all whitespace-nowrap border ${
                      activeColor === color 
                        ? 'bg-brand-wine text-brand-gold border-brand-gold shadow-sm' 
                        : 'bg-white border-brand-gold/20 text-brand-gold-dark'
                    }`}
                  >
                    {color === '赤' ? t[language].red : color === '白' ? t[language].white : t[language].sparkling}
                  </button>
                ))}

                <div className="w-px h-4 shrink-0 bg-brand-gold/20" />
                
                {!store?.hidePairingFilter && cuisineFilters.map(c => (
                  <button
                    key={c.id}
                    onClick={() => setActiveCuisine(activeCuisine === c.id ? null : c.id)}
                    className={`px-4 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-wider transition-all whitespace-nowrap border ${
                      activeCuisine === c.id 
                        ? 'bg-brand-gold-dark text-white border-brand-gold-dark' 
                        : 'bg-white border-brand-gold/20 text-brand-gold-dark'
                    }`}
                  >
                    {c.label}
                  </button>
                ))}

                {!store?.hidePairingFilter && <div className="w-px h-4 shrink-0 bg-brand-gold/20" />}

                {budgetFilters.map(b => (
                  <button
                    key={b.id}
                    onClick={() => setActiveBudget(activeBudget === b.id ? null : b.id)}
                    className={`px-4 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-wider transition-all whitespace-nowrap border ${
                      activeBudget === b.id 
                        ? 'bg-brand-gold-dark text-white border-brand-gold-dark'
                        : 'bg-white border-brand-gold/20 text-brand-gold-dark'
                    }`}
                  >
                    {b.label}
                  </button>
                ))}

                <div className="w-px h-4 shrink-0 ml-auto mr-2" />

                <div className="flex items-center gap-2 relative shrink-0">
                  <span className="text-[9px] font-black text-brand-wine/30 uppercase tracking-[0.2em]">{t[language].sort}</span>
                  <div className="relative">
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value as any)}
                      className="appearance-none pl-4 pr-9 py-1.5 rounded-xl text-[11px] font-bold uppercase tracking-wider bg-white border border-brand-gold/20 text-brand-gold-dark outline-none transition-all shadow-sm focus:border-brand-gold"
                    >
                      <option value="featured">{t[language].recommended}</option>
                      <option value="price_desc">{t[language].priceDesc}</option>
                      <option value="price_asc">{t[language].priceAsc}</option>
                    </select>
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-brand-gold-dark">
                      <ChevronDown className="w-3.5 h-3.5" />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="pb-32">
              <div className="p-4 md:p-12 space-y-8 max-w-5xl mx-auto">
                <div className="space-y-10">

              {hasNoResults && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mx-4 p-6 bg-brand-wine/5 border border-brand-gold/20 rounded-[2rem] text-center"
                >
                  <p className="text-[14px] text-brand-wine font-bold leading-relaxed mb-1">
                    {t[language].noResults}
                  </p>
                  <p className="text-[13px] text-brand-gold-dark font-bold uppercase tracking-widest opacity-60">
                    {t[language].showingRecommended}
                  </p>
                </motion.div>
              )}
              
              <div className="grid gap-8">
                {/* Featured Section */}
                <AnimatePresence>
                  {displayedInventory.some(w => w.isFeatured) && (
                    <div className="space-y-6">
                      <div className="flex items-center gap-3 px-2">
                        <Sparkles className="w-5 h-5 text-brand-gold-dark" />
                        <h3 className="serif text-[13px] text-brand-gold-dark uppercase tracking-[0.4em] font-bold">{t[language].sommelierSelection}</h3>
                        <div className="flex-1 h-px bg-brand-gold-dark/20" />
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
                              <div className="absolute inset-0 opacity-5 bg-[url('https://www.transparenttextures.com/patterns/handmade-paper.png')] rounded-[3rem]" />
                              <div className="w-32 h-40 bg-white flex items-center justify-center p-4 rounded-[2rem] relative border border-brand-gold/20 shadow-xl group-hover:border-brand-gold/50 transition-all overflow-hidden shrink-0">
                                <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/cream-paper.png')]" />
                                <AuthImage
                                  url={wine.image_url}
                                  alt=""
                                  crossOrigin="anonymous"
                                  referrerPolicy="no-referrer"
                                  className="w-full h-full object-contain group-hover:scale-110 transition-transform duration-1000 ease-out drop-shadow-2xl"
                                />
                                <div className="absolute top-2 left-2 flex flex-col gap-1">
                                    {wine.pairing?.includes('肉') && <div className="p-1.5 bg-brand-wine/10 rounded-full text-brand-wine"><Beef className="w-3 h-3" /></div>}
                                    {wine.pairing?.includes('魚') && <div className="p-1.5 bg-brand-wine/10 rounded-full text-brand-wine"><Fish className="w-3 h-3" /></div>}
                                </div>
                              </div>
                              <div className="flex-1 flex flex-col justify-center gap-1">
                                <div className="flex flex-wrap items-center gap-2 mb-1">
                                  <div className="px-2 py-1 bg-brand-wine text-brand-gold text-[13px] font-black rounded-full uppercase tracking-widest shrink-0 shadow-sm flex items-center gap-1">
                                    <ChefHat className="w-2.5 h-2.5" />
                                    Specialité
                                  </div>
                                  {wine.color && (
                                    <div className={`px-2 py-1 text-[13px] font-black rounded-full uppercase tracking-widest shrink-0 ${
                                      wine.color === '赤' ? 'bg-[#641E16] text-white' : 
                                      wine.color === '白' ? 'bg-[#D4AF37] text-white' : 
                                      wine.color === '泡' || wine.color === 'スパークリング' ? 'bg-[#717D7E] text-white' : 'bg-slate-500 text-white'
                                    }`}>
                                      {wine.color === '赤' ? t[language].red : wine.color === '白' ? t[language].white : t[language].sparkling}
                                    </div>
                                  )}
                                  <div className="text-[12px] uppercase font-bold text-brand-gold-dark tracking-[0.2em] opacity-80 ml-1">
                                    {wine.country}
                                  </div>
                                </div>
                                  {wine.menu_short && (
                                    <div className="mb-2">
                                      <div className="inline-flex items-center gap-2 px-2 py-1 bg-brand-gold/10 border-l-2 border-brand-gold">
                                        <span className="text-sm font-serif text-brand-gold-dark italic tracking-wider leading-relaxed">
                                          {wine.menu_short}
                                        </span>
                                      </div>
                                    </div>
                                  )}
                                  <h3 className="serif text-2xl text-brand-wine leading-tight tracking-tight group-hover:text-brand-gold transition-colors">
                                    {language === 'en' ? (wine.name_en || wine.name_jp) : wine.name_jp}
                                  </h3>
                                  
                                  <div className="flex flex-wrap gap-1 mt-2">
                                    <div className="flex items-center gap-1 px-2 py-1 bg-slate-100 rounded-lg text-[12px] text-slate-500 font-bold uppercase tracking-wider">
                                      <MapPin className="w-3 h-3" />
                                      {wine.country} / {wine.region}
                                    </div>
                                    <div className="flex items-center gap-1 px-2 py-1 bg-brand-wine/10 rounded-lg text-[13px] text-brand-wine font-black uppercase tracking-wider">
                                      {t[language].grape}: {wine.grape}
                                    </div>
                                    {wine.tags?.split('、').slice(0, 3).map(tag => (
                                      <div key={tag} className="px-2 py-1 bg-brand-wine/5 rounded-lg text-[13px] text-brand-wine/60 font-bold tracking-wider flex items-center gap-1">
                                        <Tag className="w-2.5 h-2.5" />
                                        {tag}
                                      </div>
                                    ))}
                                  </div>

                                  <div className="flex items-center justify-between mt-4">
                                    <div className="flex flex-col">
                               <span className="serif text-2xl text-brand-wine font-medium tracking-tighter">¥{wine.price_bottle?.toLocaleString()}</span>
                                    </div>
                                    <div className="w-10 h-10 rounded-full border border-brand-gold/30 flex items-center justify-center text-brand-gold group-hover:bg-brand-gold group-hover:text-white transition-all">
                                      <ChevronRight className="w-6 h-6" />
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
                      <div className="px-2 pb-2">
                         <h3 className="text-[10px] text-brand-wine/40 uppercase tracking-[0.4em] font-bold">{t[language].standardCollection}</h3>
                      </div>
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
                        <AuthImage
                            url={wine.image_url}
                            alt=""
                            crossOrigin="anonymous"
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-700"
                          />
                        </div>
                        <div className="flex-1 flex flex-col justify-center gap-0.5">
                      <div className="flex items-center gap-1.5 mb-1">
                        <div className={`px-2 py-1 text-[11px] font-black rounded-full uppercase tracking-widest shrink-0 ${
                          wine.color === '赤' ? 'bg-[#641E16] text-white' : 
                          wine.color === '白' ? 'bg-[#D4AF37] text-white' : 
                          wine.color === '泡' || wine.color === 'スパークリング' ? 'bg-[#717D7E] text-white' : 'bg-slate-500 text-white'
                        }`}>
                          {wine.color === '赤' ? t[language].red : wine.color === '白' ? t[language].white : t[language].sparkling}
                        </div>
                        <div className="text-[13px] uppercase font-bold text-brand-gold-dark tracking-[0.2em]">
                          {wine.country}
                        </div>
                        <div className="flex items-center gap-1 ml-auto opacity-40">
                             {wine.pairing?.includes('肉') && <Beef className="w-4 h-4 text-brand-wine" />}
                             {wine.pairing?.includes('魚') && <Fish className="w-4 h-4 text-brand-wine" />}
                        </div>
                      </div>
                          {wine.menu_short && (
                            <div className="mb-1">
                              <span className="text-sm font-serif text-brand-gold-dark italic border-l border-brand-gold pl-1.5 leading-relaxed">
                                {wine.menu_short}
                              </span>
                            </div>
                          )}
                          <h3 className="serif text-xl text-brand-wine leading-tight group-hover:text-brand-gold transition-colors">
                            {language === 'en' ? (wine.name_en || wine.name_jp) : wine.name_jp}
                          </h3>
                          
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            <div className="flex items-center gap-1 text-[13px] text-slate-400 font-bold uppercase tracking-widest">
                              <MapPin className="w-2.5 h-2.5" />
                              {wine.country} / <span className="text-brand-wine font-black">{t[language].grape}: {wine.grape}</span>
                            </div>
                            {wine.tags?.split('、').slice(0, 2).map(tag => (
                              <div key={tag} className="px-1.5 py-0.5 bg-brand-wine/5 rounded text-[11px] text-brand-wine/40 font-bold tracking-wider">
                                #{tag}
                              </div>
                            ))}
                          </div>

                          <div className="flex items-center justify-between mt-2">
                             <span className="serif text-xl text-brand-wine font-medium">¥{wine.price_bottle?.toLocaleString()}</span>
                             <ChevronRight className="w-5 h-5 text-brand-gold transition-all" />
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
      </>
    )}
  </div>

  {/* Concierge Bottom Sheet FAB */}
        <AnimatePresence>
          {isScrolled && !isConciergeOpen && (
            <motion.button
              initial={{ opacity: 0, scale: 0.5, y: 50 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.5, y: 50 }}
              onClick={() => setIsConciergeOpen(true)}
              className="fixed bottom-24 right-6 z-[110] flex items-center bg-brand-gold-dark text-brand-ivory p-1.5 rounded-full shadow-[0_10px_40px_rgba(184,134,11,0.5)] border border-brand-gold/30 hover:scale-105 active:scale-95 transition-all group overflow-hidden"
            >
              <div className="flex items-center gap-0 group-hover:gap-2 transition-all px-2">
                <span className="text-[12px] font-bold tracking-tighter whitespace-nowrap overflow-hidden max-w-0 group-hover:max-w-[120px] transition-all duration-500">
                  {t[language].wineConcierge}
                </span>
                <div className="w-10 h-10 rounded-full bg-brand-ivory text-brand-gold-dark flex items-center justify-center shadow-inner shrink-0 scale-100 group-hover:scale-90 transition-transform">
                  <Sparkles className="w-5 h-5" />
                </div>
              </div>
            </motion.button>
          )}
        </AnimatePresence>

        {/* Concierge Bottom Sheet (Drawer) */}
        <AnimatePresence>
          {isConciergeOpen && (
            <>
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsConciergeOpen(false)}
                className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[115]"
              />
              <motion.div
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={{ type: "spring", damping: 25, stiffness: 200 }}
                className="fixed bottom-0 inset-x-0 bg-brand-ivory rounded-t-[3rem] z-[120] border-t border-brand-gold/30 px-6 pt-10 pb-12 shadow-[0_-20px_60px_rgba(0,0,0,0.3)] max-h-[90dvh] overflow-y-auto"
              >
                <div className="absolute top-4 left-1/2 -translate-x-1/2 w-12 h-1 bg-brand-gold-dark/20 rounded-full" />
                
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-3">
                    <ChefHat className="w-6 h-6 text-brand-gold-dark" />
                    <h3 className="serif text-xl text-brand-wine font-light tracking-widest uppercase">Wine Concierge</h3>
                  </div>
                  <button 
                    onClick={() => setIsConciergeOpen(false)}
                    className="w-8 h-8 rounded-full bg-brand-gold/10 flex items-center justify-center text-brand-gold-dark"
                  >✕</button>
                </div>

                <div className="space-y-10">
                  {/* Reuse Concierge UI Components */}
                  <div className="space-y-4">
                    <p className="text-[10px] text-brand-gold-dark font-black uppercase tracking-[0.3em] flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-brand-wine text-brand-gold flex items-center justify-center text-[10px] font-black shadow-inner">1</span>
                      {t[language].chooseColor}
                    </p>
                    <div className="flex flex-wrap gap-2">
                        {['赤', '白', '泡'].map(color => (
                          <button
                            key={color}
                            onClick={() => {
                              setStep1Color(color);
                              setStep2Style(null);
                              setStep3Budget(null);
                              setSelectedDish(null);
                            }}
                            className={`px-8 py-3 rounded-full text-[14px] font-bold transition-all border ${
                              step1Color === color 
                                ? 'bg-brand-wine text-brand-gold border-brand-gold shadow-lg font-black' 
                                : 'bg-white border-brand-gold/10 text-brand-wine/60'
                            }`}
                          >
                            {color === '赤' ? t[language].red : color === '白' ? t[language].white : t[language].sparkling}
                          </button>
                        ))}
                    </div>
                  </div>

                  {step1Color && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                      className="space-y-4 pt-6 border-t border-brand-gold/10"
                    >
                      <p className="text-[10px] text-brand-gold-dark font-black uppercase tracking-[0.3em] flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-brand-wine text-brand-gold flex items-center justify-center text-[10px] font-black shadow-inner">2</span>
                        {t[language].chooseStyle}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {getDynamicStyles(step1Color).map(style => (
                          <button
                            key={style}
                            onClick={() => {
                              setStep2Style(style);
                              setStep3Budget(null);
                            }}
                            className={`px-5 py-3 rounded-2xl text-[13px] font-bold transition-all border ${
                              step2Style === style 
                                ? 'bg-brand-gold text-brand-wine border-brand-gold shadow-md font-black' 
                                : 'bg-white border-brand-gold/10 text-brand-wine/60'
                            }`}
                          >
                            {style}
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}

                  {step2Style && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                      className="space-y-4 pt-6 border-t border-brand-gold/10"
                    >
                      <p className="text-[10px] text-brand-gold-dark font-black uppercase tracking-[0.3em] flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-brand-wine text-brand-gold flex items-center justify-center text-[10px] font-black shadow-inner">3</span>
                        {t[language].narrowBudget}
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        {conciergeBudgets.map(budget => (
                          <button
                            key={budget.id}
                            onClick={() => setStep3Budget(budget.id)}
                            className={`px-4 py-3 rounded-2xl text-[12px] font-bold transition-all border ${
                              step3Budget === budget.id 
                                ? 'bg-brand-wine text-brand-gold border-brand-gold shadow-md' 
                                : 'bg-white border-brand-gold/10 text-brand-wine/50'
                            }`}
                          >
                            {budget.label}
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}

                  <div className="pt-6">
                    <button
                      onClick={() => setIsConciergeOpen(false)}
                      className="w-full py-4 bg-brand-wine text-brand-gold rounded-full font-black uppercase tracking-[0.4em] shadow-xl active:scale-95 transition-all"
                    >
                      {t[language].showResults}
                    </button>
                  </div>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* Global Footer */}
        <div className="fixed bottom-6 inset-x-6 z-40 flex justify-center pointer-events-none">
          <div className="bg-black/90 backdrop-blur-xl border border-brand-gold/30 px-8 py-3 rounded-full shadow-2xl animate-in slide-in-from-bottom duration-1000 pointer-events-auto">
            <p className="text-[10px] md:text-xs text-brand-gold font-bold uppercase tracking-[0.15em] text-center">
              {t[language].consultStaff}
            </p>
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
              className="fixed inset-0 z-[130] bg-black/98 backdrop-blur-3xl overflow-hidden flex flex-col h-[100dvh] md:h-auto md:bottom-0 md:top-12 md:rounded-t-[2.5rem] border-t border-brand-gold/30 shadow-[0_-20px_500px_rgba(0,0,0,1)]"
            >
              <div className="sticky top-0 z-[140] bg-black/95 backdrop-blur-md p-8 pb-4 flex justify-between items-center border-b border-white/5">
                <span className="text-sm text-brand-gold font-bold uppercase tracking-[0.2em] opacity-60">{t[language].vintage} {selectedWine.vintage}</span>
                <button 
                  onClick={() => setSelectedWine(null)} 
                  className="w-10 h-10 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-brand-gold text-xl hover:bg-white/20 transition-all font-light"
                >✕</button>
              </div>
              
                <div className="flex-1 overflow-y-auto overscroll-behavior-contain px-6 md:px-8 pb-10 space-y-10 custom-scrollbar scroll-smooth">
                  <div className="text-center pt-4">
                    <div className="w-full aspect-square md:aspect-[4/5] bg-brand-dark/40 border border-brand-gold/20 rounded-3xl mb-8 flex items-center justify-center p-8 relative shadow-inner group overflow-hidden">
                      <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_center,rgba(184,134,11,0.25),transparent_70%)]" />
                      <AuthImage 
                        url={selectedWine.image_url}
                        alt="" 
                        crossOrigin="anonymous"
                        referrerPolicy="no-referrer"
                        className="h-full object-contain relative z-10 transition-transform duration-2000 group-hover:scale-105" 
                      />
                    </div>
                    <h2 className="serif text-3xl md:text-5xl text-brand-gold mb-3 tracking-tight leading-tight">
                      {language === 'en' ? (selectedWine.name_en || selectedWine.name_jp) : selectedWine.name_jp}
                    </h2>
                    <p className="text-[13px] md:text-sm text-gray-400 tracking-[0.3em] uppercase font-bold mb-2">
                      {language === 'en' ? (selectedWine.name_jp) : selectedWine.name_en}
                    </p>
                    <p className="text-sm text-brand-gold-dark font-bold uppercase tracking-widest border-t border-brand-gold/20 pt-2 inline-block">
                      {t[language].grape}: {selectedWine.grape}
                    </p>
                  </div>

                <div className="space-y-6 pt-8 border-t border-white/10">
                  <div className="flex items-center gap-3 text-brand-gold">
                    <Award className="w-6 h-6 opacity-70" />
                    <h4 className="text-sm font-bold uppercase tracking-[0.3em]">{t[language].flavorProfile}</h4>
                  </div>
                  <WineProfile wine={selectedWine} language={language} />
                </div>

                <div className="space-y-6">
                  <div className="flex items-center gap-3 text-brand-gold">
                    <Info className="w-6 h-6 opacity-70" />
                    <h4 className="text-sm font-bold uppercase tracking-[0.3em]">{t[language].sommelierExplanation}</h4>
                  </div>
                  <div className="relative">
                    <div className="absolute top-4 left-4 text-brand-gold/20"><Sparkles className="w-8 h-8" /></div>
                    <div className="bg-brand-gold/5 p-6 pt-10 rounded-2xl border border-brand-gold/10 shadow-inner space-y-6">
                      <p className="text-xl md:text-2xl leading-relaxed text-brand-gold-dark font-serif first-letter:text-5xl first-letter:float-left first-letter:mr-3 first-letter:mt-1 first-letter:text-brand-gold-dark font-medium italic">
                        {language === 'en' ? (
                          <>
                            {selectedWine.ai_explanation_en || selectedWine.ai_explanation || selectedWine.aroma_features}
                            {(!selectedWine.ai_explanation_en && selectedWine.ai_explanation) && (
                              <span className="block mt-4 text-xs font-sans not-italic opacity-50">* Japanese description</span>
                            )}
                          </>
                        ) : (
                          selectedWine.ai_explanation || selectedWine.aroma_features
                        )}
                      </p>
                      
                      {selectedWine.aroma_features && (
                        <div className="pt-4 border-t border-brand-gold/10">
                          <p className="text-[11px] text-brand-gold-dark/40 font-black uppercase tracking-widest mb-2">Aroma & Features</p>
                          <p className="text-sm text-gray-700 leading-relaxed font-sans">{selectedWine.aroma_features}</p>
                        </div>
                      )}

                      <div className="flex flex-wrap gap-2 pt-4 border-t border-brand-gold/10">
                        {selectedWine.tags?.split('、').map(tag => (
                          <span key={tag} className="px-3 py-1 bg-brand-gold/10 rounded-full text-xs text-brand-gold-dark font-bold tracking-widest whitespace-nowrap border border-brand-gold/20">
                            #{tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {!store?.hideWinePairing && (
                  <div className="space-y-6">
                    <div className="flex items-center gap-3 text-brand-gold">
                      <Utensils className="w-6 h-6 opacity-70" />
                      <h4 className="text-sm font-bold uppercase tracking-[0.3em]">{t[language].bestMarriage}</h4>
                    </div>
                    <div className="flex flex-wrap gap-2 md:gap-3">
                      {selectedWine.pairing.split('、').map(p => (
                        <span key={p} className="bg-brand-gold/10 border border-brand-gold/30 px-5 py-3 rounded-full text-sm text-brand-gold font-bold tracking-wider">
                          {p}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="sticky bottom-0 z-[140] p-6 md:p-8 pt-4 pb-[env(safe-area-inset-bottom,24px)] bg-black/95 backdrop-blur-2xl border-t border-brand-gold/20 flex flex-col gap-6 safe-bottom">
                 <div className="flex justify-between items-center px-2">
                   <div className="flex flex-col">
                     <span className="text-sm text-gray-500 uppercase font-bold tracking-widest mb-1">{t[language].bottle}</span>
                     <span className="serif text-2xl md:text-3xl text-brand-gold tracking-tighter">¥{selectedWine.price_bottle?.toLocaleString()}</span>
                   </div>
                   <div className="h-10 w-px bg-brand-gold/20" />
                   <div className="flex flex-col text-right">
                     <span className="text-sm text-gray-500 uppercase font-bold tracking-widest mb-1">{t[language].glass}</span>
                     <span className="serif text-2xl md:text-3xl text-brand-gold tracking-tighter">¥{selectedWine.price_glass?.toLocaleString()}</span>
                   </div>
                 </div>
                 <div className="text-center">
                   <p className="text-sm text-brand-gold font-bold uppercase tracking-[0.3em] opacity-40">{t[language].underTwenty}</p>
                 </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };
