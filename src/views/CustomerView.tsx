// src/views/CustomerView.tsx
import React, { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { WineMaster } from '../types';
import { useWines } from '../lib/WineContext';
import { WineProfile } from '../components/WineProfile';
import { auth } from '../lib/firebase';
import { signInAnonymously } from 'firebase/auth';
import { ChevronRight, ChevronDown, Info, Wine, Utensils, Award, Sparkles, Edit2, Beef, Fish, ChefHat, MapPin, Tag } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

import { usePublicMenuQuery } from '../hooks/usePublicMenuQuery';
import { useWineDetailQuery } from '../hooks/useWinesQuery';

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

export const CustomerView: React.FC = () => {
  const { storeId: routeStoreId } = useParams();
  const { user } = useWines();
  const [isConciergeOpen, setIsConciergeOpen] = useState(false);
  const [selectedWine, setSelectedWine] = useState<WineMaster | null>(null);
  const [isScrolled, setIsScrolled] = useState(false);
  const [currentLang, setCurrentLang] = useState<'ja' | 'en'>('ja');

  // 各種フィルター・ソート状態（構文エラーを修正）
  const [activeCuisine, setActiveCuisine] = useState<string | null>(null);
  const [activeColor, setActiveColor] = useState<string | null>(null);
  const [activeBudget, setActiveBudget] = useState<string | null>(null);
  const [activeGlassOnly, setActiveGlassOnly] = useState<boolean>(false); 

  const [step1Color, setStep1Color] = useState<string | null>(null);
  const [step2Style, setStep2Style] = useState<string | null>(null);
  const [step3Budget, setStep3Budget] = useState<number | null>(null);
  const [selectedDish, setSelectedDish] = useState<string | null>(null);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'featured' | 'price_desc' | 'price_asc'>('featured');

  const translations = {
    ja: {
      clear: 'クリア',
      sparkling: 'スパークリング',
      meat: 'お肉料理',
      fish: 'お魚料理',
      appetizer: '前菜・サラダ',
      sort: '並び替え',
      recommend: 'おすすめ順',
      priceDesc: '価格が高い順',
      priceAsc: '価格が安い順',
      sommelierRecommend: 'ソムリエのおすすめ',
      standardSelection: 'スタンダード・セレクション',
      speciality: 'スペシャリテ',
      majorGrape: '主要品種',
      vintage: 'ヴィンテージ',
      aroma: 'アロマと特徴',
      pairing: '最高のマリアージュ',
      bottle: 'ボトル',
      glass: 'グラス',
      glassWine: 'グラス対応', 
      footerWarning: '条件に合うワインが見つからない場合はスタッフにお尋ねください',
      ageNotice: '飲酒は20歳になってから正しく適切に。',
      concierge: 'ワイン・コンシェルジュ',
      conciergeStep1: 'ワインの色を選ぶ',
      conciergeStep2: 'スタイルを選ぶ',
      conciergeStep3: '予算から絞り込む',
      conciergeResult: '結果を表示する',
      loadingStore: '店舗が見つかりません',
      loadingStoreRetry: 'QRコードを再度読み取ってください。または店舗スタッフにお声がけください。',
      preparingTitle: 'ワインセラー',
      preparingSubtitle: '準備中',
      preparingDesc1: '現在、ソムリエが在庫状況の最終確認およびワインリストの調整を行っております。まもなく公開されますので、少々お待ちください。',
      preparingDesc2: '恐れ入りますが、お急ぎの場合は近くのスタッフまでお声がけください。',
      preparingTime: '推定準備時間: まもなく',
      refreshList: 'リストを更新する',
      close: '✕',
      noResultsTitle: 'ご希望の条件に近い、ソムリエおすすめのワインを表示しています',
      noResultsSubtitle: 'おすすめのセレクションを表示中',
      tasteProfile: '味わいのプロファイル',
      sommelierComment: 'ソムリエによる解説',
      red: '赤',
      white: '白',
      rose: 'ロゼ',
      budgetUpTo: '〜',
      budgetRange: '',
      budgetFrom: '',
      budgetMoreThan: '',
      yen: '円',
      fullBody: 'フルボディ',
      mediumBody: 'ミディアムボディ',
      lightBody: 'ライトボディ',
      dry: '辛口',
      mediumDry: '中辛口',
      sweet: '甘口'
    },
    en: {
      clear: 'Clear',
      sparkling: 'Sparkling',
      meat: 'Meat Dish',
      fish: 'Fish Dish',
      appetizer: 'Appetizer/Salad',
      sort: 'Sort',
      recommend: 'Recommend',
      priceDesc: 'Price (High to Low)',
      priceAsc: 'Price (Low to High)',
      sommelierRecommend: 'Sommelier\'s Recommendation',
      standardSelection: 'Standard Selection',
      speciality: 'Speciality',
      majorGrape: 'Main Grape',
      vintage: 'Vintage',
      aroma: 'Aroma & Features',
      pairing: 'Perfect Marriage',
      bottle: 'Bottle',
      glass: 'Glass',
      glassWine: 'Glass Available', 
      footerWarning: 'If you can\'t find the wine that meets your requirements, please ask the staff.',
      ageNotice: 'Drinking is permitted from age 20. Drink responsibly.',
      concierge: 'Wine Concierge',
      conciergeStep1: 'Choose Wine Color',
      conciergeStep2: 'Choose Style',
      conciergeStep3: 'Filter by Budget',
      conciergeResult: 'Show Results',
      loadingStore: 'Store Not Found',
      loadingStoreRetry: 'Please scan the QR code again or contact the store staff.',
      preparingTitle: 'Wine Cellar',
      preparingSubtitle: 'Preparing',
      preparingDesc1: 'Currently, the sommelier is performing final stock checks and adjusting the wine list. It will be available soon, so please wait.',
      preparingDesc2: 'We apologize for the inconvenience, but if you are in a hurry, please ask the staff.',
      preparingTime: 'Estimated Time: Soon',
      refreshList: 'Refresh List',
      close: '✕',
      noResultsTitle: 'Showing sommelier\'s top picks close to your preferences',
      noResultsSubtitle: 'Displaying recommended selection',
      tasteProfile: 'Taste Profile',
      sommelierComment: 'Sommelier Commentary',
      red: 'Red',
      white: 'White',
      rose: 'Rosé',
      budgetUpTo: 'Up to ¥',
      budgetRange: '¥',
      budgetFrom: '¥',
      budgetMoreThan: 'Over ¥',
      yen: '',
      fullBody: 'Full Body',
      mediumBody: 'Medium Body',
      lightBody: 'Light Body',
      dry: 'Dry',
      mediumDry: 'Medium Dry',
      sweet: 'Sweet'
    }
  };

  const t = translations[currentLang];

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

  const finalStoreId = routeStoreId || new URLSearchParams(window.location.search).get('storeId') || user?.storeId;
  const { data: menuData, isLoading: isDataFetching, refetch: fetchStoreData } = usePublicMenuQuery(finalStoreId || null);
  const { data: fullWine, isLoading: isDetailLoading } = useWineDetailQuery(selectedWine?.id || null);
  
  const effectiveWine = (selectedWine && fullWine) ? { ...selectedWine, ...fullWine } : selectedWine;
  const store = menuData?.store || null;
  const inventory = menuData?.menu || [];

  const getProxyUrl = (url: string) => `/api/proxy-image?url=${encodeURIComponent(url)}`;

  // 予算ティア配列から動的にフィルターの最小・最大レンジを生成
  const budgetTiers = store?.budgetTiers || [];
  
  const budgetFilters: FilterOption[] = useMemo(() => {
    if (budgetTiers.length > 0) {
      return budgetTiers.map((tier, idx, arr) => {
        if (idx === 0) return { id: `b${idx}`, label: `${t.budgetUpTo}${tier.toLocaleString()}${t.yen}`, max: tier };
        return { id: `b${idx}`, label: `${t.budgetRange}${arr[idx-1].toLocaleString()}〜${t.budgetRange}${tier.toLocaleString()}${t.yen}`, min: arr[idx-1], max: tier };
      }).concat([{ id: 'blast', label: `${t.budgetRange}${budgetTiers[budgetTiers.length - 1].toLocaleString()}〜${t.yen}`, min: budgetTiers[budgetTiers.length - 1] }]);
    }
    return [
      { id: 'b1', label: `${t.budgetUpTo}5,000${t.yen}`, max: 5000 },
      { id: 'b2', label: `${t.budgetUpTo}10,000${t.yen}`, max: 10000 },
      { id: 'b3', label: `${t.budgetRange}10,000〜${t.yen}`, min: 10000 }
    ];
  }, [budgetTiers, t]);

  const conciergeBudgets: ConciergeOption[] = useMemo(() => {
    if (budgetTiers.length > 0) {
      return budgetTiers.map(tier => ({ id: tier, label: `${t.budgetUpTo}${tier.toLocaleString()}${t.yen}`, max: tier }))
        .concat([{ id: 999999, label: `${t.budgetMoreThan}${budgetTiers[budgetTiers.length - 1].toLocaleString()}${t.yen}`, min: budgetTiers[budgetTiers.length - 1] }]);
    }
    return [
      { id: 5000, label: `${t.budgetUpTo}5,000${t.yen}`, max: 5000 },
      { id: 10000, label: `${t.budgetUpTo}10,000${t.yen}`, max: 10000 },
      { id: 20000, label: `${t.budgetUpTo}20,000${t.yen}`, max: 20000 },
      { id: 999999, label: `${t.budgetMoreThan}20,000${t.yen}`, min: 20000 }
    ];
  }, [budgetTiers, t]);

  const cuisineFilters = [
    { id: 'meat', label: t.meat, match: /肉|ステーキ|ラム|牛|豚/i },
    { id: 'fish', label: t.fish, match: /魚|シーフード|刺身|カルパッチョ/i },
    { id: 'appetizer', label: t.appetizer, match: /前菜|サラダ|カルパッチョ|小皿/i }
  ];

  const getDynamicStyles = (color: string) => {
    const isEn = currentLang === 'en';
    if (color === '赤') return [t.fullBody, t.mediumBody, t.lightBody];
    if (color === '白') return [t.dry, t.mediumDry, t.sweet];
    if (color === '泡' || color === 'スパークリング') {
      return [isEn ? 'Brut (Dry)' : '辛口 (Brut)', isEn ? 'Extra Dry' : '中辛口', isEn ? 'Demi-Sec (Sweet)' : '甘口 (Demi-Sec)'];
    }
    return [t.dry, t.sweet];
  };

  const handleSelectWine = (id: string) => {
    const element = document.getElementById(`wine-${id}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setHighlightedId(id);
      setTimeout(() => {
        setHighlightedId(null);
      }, 800);
    }
  };

  // 【追加】欠落していた高精度多重フィルタリングロジック
  const filteredInventory = useMemo(() => {
    return inventory.filter(wine => {
      // 1. 通常の色フィルター
      if (activeColor && wine.color !== activeColor) return false;
      
      // 2. グラスワイン限定フィルター
      if (activeGlassOnly && !(wine.price_glass && wine.price_glass > 0)) return false;
      
      // 3. 通常のペアリング料理フィルター
      if (activeCuisine) {
        const filter = cuisineFilters.find(c => c.id === activeCuisine);
        const pairingStr = `${wine.pairing || ''} ${wine.pairing_en || ''}`;
        if (filter && !filter.match.test(pairingStr)) return false;
      }
      
      // 4. 通常の予算フィルター
      if (activeBudget) {
        const filter = budgetFilters.find(b => b.id === activeBudget);
        if (filter) {
          if (filter.min !== undefined && wine.price_bottle < filter.min) return false;
          if (filter.max !== undefined && wine.price_bottle > filter.max) return false;
        }
      }
      
      // 5. コンシェルジュ：色 (step1Color)
      if (step1Color && wine.color !== step1Color) return false;
      
      // 6. コンシェルジュ：スタイル (step2Style)
      if (step2Style) {
        if (step1Color === '赤') {
          if (step2Style === t.fullBody && wine.body < 4) return false;
          if (step2Style === t.mediumBody && wine.body !== 3) return false;
          if (step2Style === t.lightBody && wine.body > 2) return false;
        } else {
          const isDry = step2Style.includes('辛口') || step2Style.includes('Dry') || step2Style.includes('Brut');
          const isMedium = step2Style.includes('中辛口') || step2Style.includes('Extra Dry');
          const isSweet = step2Style.includes('甘口') || step2Style.includes('Sweet') || step2Style.includes('Demi-Sec');
          
          if (isDry && wine.sweetness > 2) return false;
          if (isMedium && wine.sweetness !== 3) return false;
          if (isSweet && wine.sweetness < 4) return false;
        }
      }
      
      // 7. コンシェルジュ：予算 (step3Budget)
      if (step3Budget) {
        const budgetOpt = conciergeBudgets.find(b => b.id === step3Budget);
        if (budgetOpt) {
          if (budgetOpt.min !== undefined && wine.price_bottle < budgetOpt.min) return false;
          if (budgetOpt.max !== undefined && wine.price_bottle > budgetOpt.max) return false;
        }
      }
      
      return true;
    });
  }, [inventory, activeColor, activeGlassOnly, activeCuisine, activeBudget, step1Color, step2Style, step3Budget, t]);

  // 【追加】結果0件時の判定フラグ
  const hasNoResults = filteredInventory.length === 0;

  // 【追加】フォールバック戦略対応の最終表示用メニューデータ
  const displayedInventory = useMemo(() => {
    // 該当なしの場合は、全件（フォールバック）を割り当ててユーザー離脱を防ぐ
    const list = hasNoResults ? [...inventory] : [...filteredInventory];
    
    if (sortBy === 'price_desc') {
      return list.sort((a, b) => (b.price_bottle || 0) - (a.price_bottle || 0));
    }
    if (sortBy === 'price_asc') {
      return list.sort((a, b) => (a.price_bottle || 0) - (b.price_bottle || 0));
    }
    return list; // featured (デフォルト順)
  }, [filteredInventory, hasNoResults, inventory, sortBy]);

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
               <SkeletonItem /><SkeletonItem /><SkeletonItem /><SkeletonItem /><SkeletonItem />
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
        <h2 className="font-sans text-2xl font-bold text-brand-gold-dark mb-4">{t.loadingStore}</h2>
        <p className="text-sm text-brand-ivory/60 leading-relaxed max-w-xs">{t.loadingStoreRetry}</p>
      </div>
    );
  }

  if (inventory.length === 0) {
    return (
      <div className="min-h-screen bg-brand-wine flex flex-col items-center justify-center p-8 text-center text-brand-gold-dark overflow-hidden">
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
          <motion.div animate={{ scale: [1, 1.05, 1] }} transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }} className="mb-12 relative inline-block">
            <div className="absolute inset-0 bg-brand-gold/20 blur-2xl rounded-full scale-150 opacity-30" />
            <Wine className="w-20 h-20 text-brand-gold/40 relative z-10" strokeWidth={0.5} />
            <motion.div animate={{ opacity: [0.3, 0.7, 0.3] }} transition={{ duration: 4, repeat: Infinity }} className="absolute -top-4 -right-4">
              <Sparkles className="w-8 h-8 text-brand-gold/50" />
            </motion.div>
          </motion.div>

          <div className="space-y-8">
            <div>
              <h2 className="font-sans text-3xl md:text-4xl text-brand-gold-dark mb-2 tracking-[0.25em] font-black uppercase leading-snug">
                {t.preparingTitle}
              </h2>
              <div className="flex items-center justify-center gap-4">
                <div className="h-px w-8 bg-brand-gold/30" />
                <span className="font-sans opacity-60 text-xs tracking-[0.3em] uppercase">{t.preparingSubtitle}</span>
                <div className="h-px w-8 bg-brand-gold/30" />
              </div>
            </div>
            
            <div className="space-y-4">
              <p className="text-xs text-brand-ivory/80 leading-relaxed max-w-[320px] mx-auto font-sans font-bold tracking-[0.15em] uppercase">
                {t.preparingDesc1}
              </p>
              <p className="text-xs text-brand-gold/60 leading-relaxed max-w-[280px] mx-auto font-sans tracking-[0.1em]">
                {t.preparingDesc2}
              </p>
            </div>

            <div className="text-xs text-brand-gold/30 tracking-[0.4em] uppercase font-bold pt-4">
              {t.preparingTime}
            </div>
          </div>

          <div className="mt-20 flex flex-col gap-5 items-center">
             <button onClick={() => fetchStoreData()} className="px-14 py-4 bg-transparent border border-brand-gold/30 text-brand-gold-dark text-xs uppercase tracking-[0.4em] rounded-full hover:bg-brand-gold/10 hover:border-brand-gold/60 active:scale-95 transition-all font-bold backdrop-blur-md shadow-lg">
                {t.refreshList}
              </button>
              
              <div className="flex items-center gap-3 opacity-30">
                <div className="w-1 h-1 rounded-full bg-brand-gold" />
                <p className="text-xs text-brand-gold-dark uppercase tracking-[0.5em] font-mono">
                  {store.name}
                </p>
                <div className="w-1 h-1 rounded-full bg-brand-gold" />
              </div>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div 
      id="customer-view" 
      className="min-h-screen bg-brand-ivory relative text-[16px] font-bold leading-relaxed"
      style={{ fontFamily: '"BIZ UDPGothic", "Noto Sans JP", "Hiragino Kaku Gothic ProN", "Meiryo", sans-serif' }}
    >
      {!isDataFetching && store && (
        <header className={`fixed top-0 inset-x-0 h-16 flex items-center px-6 border-b transition-all duration-500 z-[100] ${
          isScrolled ? 'bg-black/90 backdrop-blur-md border-brand-gold/20' : 'bg-black border-brand-gold/30'
        }`}>
          <div className="flex-1">
            {user && (user.role === 'admin' || user.role === 'rep' || user.role === 'owner') && (
              <button 
                onClick={() => {
                  if (user.role === 'admin' || user.role === 'rep') {
                    window.location.href = `/admin?storeId=${store.id}`;
                  } else {
                    window.location.href = `/owner?storeId=${store.id}`;
                  }
                }}
                className="w-10 h-10 rounded-full bg-brand-gold/10 flex items-center justify-center border border-brand-gold/20 text-brand-gold-dark hover:bg-brand-gold-dark hover:text-brand-wine transition-all"
              >
                <Edit2 className="w-5 h-5" />
              </button>
            )}
          </div>
          <div className="flex-none text-center flex items-center gap-4">
            <h1 className="font-sans text-brand-gold-dark font-extrabold text-xl md:text-2xl tracking-[0.4em] uppercase leading-tight">
              {store.name}
            </h1>
            <div className="flex items-center gap-2">
              <div className="flex items-center bg-white/5 rounded-full p-1 border border-brand-gold/20 shadow-inner">
                <button onClick={() => setCurrentLang('ja')} className={`px-3 py-1 rounded-full text-xs font-black transition-all ${currentLang === 'ja' ? 'bg-brand-gold-dark text-white' : 'text-brand-gold/40 hover:text-brand-gold/70'}`}>JP</button>
                <button onClick={() => setCurrentLang('en')} className={`px-3 py-1 rounded-full text-xs font-black transition-all ${currentLang === 'en' ? 'bg-brand-gold-dark text-white' : 'text-brand-gold/40 hover:text-brand-gold/70'}`}>EN</button>
              </div>
            </div>
          </div>
          <div className="flex-1" />
        </header>
      )}

      <div className={`flex flex-col ${isDataFetching ? '' : 'pt-16'}`}>
         <>
            <div className={`sticky top-[64px] z-[90] transition-all duration-500 border-b ${
              isScrolled 
                ? 'bg-brand-ivory/95 backdrop-blur-md border-brand-gold/20 shadow-[0_4px_25px_rgba(0,0,0,0.1)]' 
                : 'bg-brand-ivory border-brand-gold/10'
            }`}>
              <div className="flex overflow-x-auto no-scrollbar py-3.5 px-4 gap-2.5 items-center">
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
                    setActiveGlassOnly(false);
                  }}
                  className={`px-4 py-2 rounded-full text-sm font-black uppercase tracking-widest transition-all whitespace-nowrap border ${
                    !activeColor && !activeCuisine && !activeBudget && !step1Color && !activeGlassOnly
                      ? 'bg-brand-gold-dark text-white border-brand-gold-dark shadow-md' 
                      : 'bg-white border-brand-gold/20 text-brand-gold-dark'
                  }`}
                >
                  {t.clear}
                </button>
                
                <div className="w-px h-5 shrink-0 bg-brand-gold/20" />
                
                {['赤', '白', '泡'].map(color => (
                  <button
                    key={color}
                    onClick={() => setActiveColor(activeColor === color ? null : color)}
                    className={`px-4 py-2 rounded-full text-sm font-extrabold uppercase tracking-wider transition-all whitespace-nowrap border ${
                      activeColor === color 
                        ? 'bg-brand-gold-dark text-white border-brand-gold' 
                        : 'bg-white border-brand-gold/20 text-brand-gold-dark'
                    }`}
                  >
                    {color === '赤' ? t.red : color === '白' ? t.white : t.sparkling}
                  </button>
                ))}

                <button
                  onClick={() => setActiveGlassOnly(!activeGlassOnly)}
                  className={`px-4 py-2 rounded-full text-sm font-black uppercase tracking-wider transition-all whitespace-nowrap border ${
                    activeGlassOnly 
                      ? 'bg-brand-gold-dark text-white border-brand-gold shadow-inner' 
                      : 'bg-white border-brand-gold/20 text-brand-gold-dark'
                  }`}
                >
                  {t.glassWine}
                </button>

                <div className="w-px h-5 shrink-0 bg-brand-gold/20" />
                
                {!store?.hidePairingFilter && cuisineFilters.map(c => (
                  <button
                    key={c.id}
                    onClick={() => setActiveCuisine(activeCuisine === c.id ? null : c.id)}
                    className={`px-4 py-2 rounded-full text-sm font-extrabold uppercase tracking-wider transition-all whitespace-nowrap border ${
                      activeCuisine === c.id 
                        ? 'bg-brand-gold-dark text-white border-brand-gold-dark' 
                        : 'bg-white border-brand-gold/20 text-brand-gold-dark'
                    }`}
                  >
                    {c.label}
                  </button>
                ))}

                {!store?.hidePairingFilter && <div className="w-px h-5 shrink-0 bg-brand-gold/20" />}

                {budgetFilters.map(b => (
                  <button
                    key={b.id}
                    onClick={() => setActiveBudget(activeBudget === b.id ? null : b.id)}
                    className={`px-4 py-2 rounded-full text-sm font-extrabold uppercase tracking-wider transition-all whitespace-nowrap border ${
                      activeBudget === b.id 
                        ? 'bg-brand-gold-dark text-white border-brand-gold-dark'
                        : 'bg-white border-brand-gold/20 text-brand-gold-dark'
                    }`}
                  >
                    {b.label}
                  </button>
                ))}

                <div className="w-px h-5 shrink-0 ml-auto mr-2" />

                <div className="flex items-center gap-2 relative shrink-0">
                  <span className="text-sm font-black text-brand-wine/30 uppercase tracking-[0.2em]">{t.sort}</span>
                  <div className="relative">
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value as any)}
                      className="appearance-none pl-4 pr-9 py-2 rounded-xl text-sm font-bold uppercase tracking-wider bg-white border border-brand-gold/20 text-brand-gold-dark outline-none transition-all shadow-sm focus:border-brand-gold"
                    >
                      <option value="featured">{t.recommend}</option>
                      <option value="price_desc">{t.priceDesc}</option>
                      <option value="price_asc">{t.priceAsc}</option>
                    </select>
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-brand-gold-dark">
                      <ChevronDown className="w-3.5 h-3.5" />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div id="wine-list-results" className="pb-32">
              <div className="p-4 md:p-12 space-y-8 max-w-5xl mx-auto">
                <div className="space-y-10">

              {hasNoResults && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mx-4 p-6 bg-brand-wine/5 border border-brand-gold/20 rounded-[2rem] text-center"
                >
                  <p className="text-base text-brand-wine font-extrabold leading-relaxed mb-1">
                    {t.noResultsTitle}
                  </p>
                  <p className="text-sm text-brand-gold-dark font-extrabold uppercase tracking-widest opacity-60">
                    {t.noResultsSubtitle}
                  </p>
                </motion.div>
              )}
              
              <div className="grid gap-8">
                <AnimatePresence>
                  {displayedInventory.some(w => w.isFeatured) && (
                    <div className="space-y-6">
                      <div className="flex items-center gap-3 px-2">
                        <Sparkles className="w-5 h-5 text-brand-gold-dark" />
                        <h3 className="font-sans text-base text-brand-gold-dark uppercase tracking-[0.4em] font-black">{t.sommelierRecommend}</h3>
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
                            <div className="absolute inset-0 bg-gradient-to-br from-brand-gold via-white to-brand-gold opacity-30 animate-pulse" />
                            <div className="absolute inset-[1px] bg-brand-ivory rounded-[3rem] z-0 overflow-hidden">
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
                                {wine.image_url && <img src={getProxyUrl(wine.image_url)} alt="" loading="lazy" className="w-full h-full object-contain group-hover:scale-110 transition-transform duration-1000 ease-out drop-shadow-2xl" />}
                                <div className="absolute top-2 left-2 flex flex-col gap-1">
                                    {(currentLang === 'ja' ? wine.pairing : (wine.pairing_en || wine.pairing))?.includes('肉') && <div className="p-1.5 bg-brand-wine/10 rounded-full text-brand-wine"><Beef className="w-3 h-3" /></div>}
                                    {(currentLang === 'ja' ? wine.pairing : (wine.pairing_en || wine.pairing))?.includes('魚') && <div className="p-1.5 bg-brand-wine/10 rounded-full text-brand-wine"><Fish className="w-3 h-3" /></div>}
                                </div>
                              </div>
                              <div className="flex-1 flex flex-col justify-center gap-1.5 min-w-0">
                                <div className="flex flex-wrap items-center gap-2 mb-1">
                                  <div className="px-2 py-1 bg-brand-wine text-brand-gold-dark text-xs font-black rounded-full uppercase tracking-widest shrink-0 shadow-sm flex items-center gap-1">
                                    <ChefHat className="w-2.5 h-2.5" />
                                    {t.speciality}
                                  </div>
                                  {wine.color && (
                                    <div className={`px-2 py-1 text-xs font-black rounded-full uppercase tracking-widest shrink-0 ${
                                      wine.color === '赤' ? 'bg-[#641E16] text-white' : 
                                      wine.color === '白' ? 'bg-brand-gold-dark text-white' : 
                                      wine.color === '泡' || wine.color === 'スパークリング' ? 'bg-[#717D7E] text-white' : 'bg-slate-500 text-white'
                                    }`}>
                                    {currentLang === 'ja' 
                                      ? (wine.color === '泡' || wine.color === 'スパークリング' ? t.sparkling : wine.color) 
                                      : (wine.color_en || (wine.color === '泡' || wine.color === 'スパークリング' ? 'Sparkling' : wine.color))}
                                    </div>
                                  )}
                                  <div className="text-xs uppercase font-bold text-brand-gold-dark tracking-[0.2em] opacity-80 ml-1">
                                    {currentLang === 'ja' ? wine.country : (wine.country_en || wine.country)}
                                  </div>
                                </div>
                                  {wine.menu_short && (
                                    <div className="mb-2">
                                      <div className="inline-flex items-center gap-2 px-2.5 py-1 bg-brand-gold/10 border-l-2 border-brand-gold">
                                        <span className="text-base font-sans font-extrabold italic tracking-wider leading-relaxed">
                                          {currentLang === 'ja' ? wine.menu_short : (wine.menu_short_en || wine.menu_short)}
                                        </span>
                                      </div>
                                    </div>
                                  )}
                                  <h3 className="font-sans text-2xl md:text-3xl font-black text-brand-wine leading-tight tracking-tight group-hover:text-brand-gold-dark transition-colors break-words">
                                    {currentLang === 'ja' ? wine.name_jp : (wine.name_en || wine.name_jp)}
                                  </h3>
                                  
                                  <div className="flex flex-wrap gap-1.5 mt-2">
                                    <div className="flex items-center gap-1 px-2.5 py-1 bg-slate-100 rounded-lg text-sm text-slate-600 font-bold uppercase tracking-wider">
                                      <MapPin className="w-3.5 h-3.5" />
                                      {currentLang === 'ja' 
                                        ? `${wine.country} / ${wine.region}` 
                                        : `${wine.country_en || wine.country} / ${wine.region_en || wine.region}`}
                                    </div>
                                <div className="flex items-center gap-1 px-2.5 py-1 bg-brand-wine/10 rounded-lg text-sm text-brand-wine font-black uppercase tracking-wider">
                                  {t.majorGrape}: {currentLang === 'ja' ? wine.grape : (wine.grape_en || wine.grape)}
                                </div>
                                {(currentLang === 'ja' ? wine.tags : (wine.tags_en || wine.tags))?.split('、').slice(0, 3).map(tag => (
                                  <div key={tag} className="px-2.5 py-1 bg-brand-wine/5 rounded-lg text-xs md:text-sm text-brand-wine/70 font-bold tracking-wider flex items-center gap-1">
                                    <Tag className="w-3 h-3" />
                                    {tag.trim()}
                                  </div>
                                ))}
                                  </div>

                                  <div className="flex items-end justify-between mt-4 pt-3 border-t border-brand-gold/20">
                                    <div className="flex gap-5 text-sm font-sans">
                                      {wine.price_glass && wine.price_glass > 0 ? (
                                        <div className="flex flex-col bg-brand-gold/10 px-3 py-1 rounded-xl border border-brand-gold/30">
                                          <span className="text-[11px] text-brand-gold-dark font-black uppercase tracking-wider mb-0.5">{t.glass}</span>
                                          <span className="font-sans text-xl md:text-2xl text-brand-wine font-black">¥{wine.price_glass.toLocaleString()}</span>
                                        </div>
                                      ) : null}
                                      <div className="flex flex-col bg-slate-100 px-3 py-1 rounded-xl border border-slate-200">
                                        <span className="text-[11px] text-gray-500 font-black uppercase tracking-wider mb-0.5">{t.bottle}</span>
                                        <span className="font-sans text-xl md:text-2xl text-brand-wine font-black">¥{wine.price_bottle ? wine.price_bottle.toLocaleString() : '-'}</span>
                                      </div>
                                    </div>
                                    <div className="w-10 h-10 rounded-full border border-brand-gold/30 flex items-center justify-center text-brand-gold-dark group-hover:bg-brand-gold-dark group-hover:text-white transition-all shrink-0">
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

                <div className="space-y-6">
                      <div className="px-2 pb-2">
                         <h3 className="font-sans text-base text-brand-wine/50 uppercase tracking-[0.4em] font-black">{t.standardSelection}</h3>
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
                        {wine.image_url && <img src={getProxyUrl(wine.image_url)} alt="" loading="lazy" className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-700" />}
                        </div>
                        <div className="flex-1 flex flex-col justify-center gap-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-1">
                        <div className={`px-2 py-1 text-xs font-black rounded-full uppercase tracking-widest shrink-0 ${
                          wine.color === '赤' ? 'bg-[#641E16] text-white' : 
                          wine.color === '白' ? 'bg-brand-gold-dark text-white' : 
                          wine.color === '泡' || wine.color === 'スパークリング' ? 'bg-[#717D7E] text-white' : 'bg-slate-500 text-white'
                        }`}>
                          {currentLang === 'ja' 
                            ? (wine.color === '泡' || wine.color === 'スパークリング' ? t.sparkling : wine.color)
                            : (wine.color_en || (wine.color === '泡' || wine.color === 'スパークリング' ? 'Sparkling' : wine.color))}
                        </div>
                        <div className="text-sm uppercase font-bold text-brand-gold-dark tracking-[0.2em]">
                          {currentLang === 'ja' ? wine.country : (wine.country_en || wine.country)}
                        </div>
                        <div className="flex items-center gap-1 ml-auto opacity-40">
                             {(currentLang === 'ja' ? wine.pairing : (wine.pairing_en || wine.pairing))?.includes('肉') && <Beef className="w-4 h-4 text-brand-wine" />}
                             {(currentLang === 'ja' ? wine.pairing : (wine.pairing_en || wine.pairing))?.includes('魚') && <Fish className="w-4 h-4 text-brand-wine" />}
                        </div>
                      </div>
                          {wine.menu_short && (
                            <div className="mb-1">
                              <span className="text-base font-sans font-extrabold text-brand-gold-dark italic border-l border-brand-gold pl-1.5 leading-relaxed">
                                {currentLang === 'ja' ? wine.menu_short : (wine.menu_short_en || wine.menu_short)}
                              </span>
                            </div>
                          )}
                          <h3 className="font-sans text-xl md:text-2xl font-black text-brand-wine leading-tight group-hover:text-brand-gold-dark transition-colors break-words">
                            {currentLang === 'ja' ? wine.name_jp : (wine.name_en || wine.name_jp)}
                          </h3>
                          
                            <div className="flex flex-wrap gap-1 mt-1.5">
                              <div className="flex items-center gap-1 text-sm text-slate-500 font-bold uppercase tracking-widest">
                                <MapPin className="w-2.5 h-2.5" />
                                {currentLang === 'ja' 
                                  ? `${wine.country} / ${wine.region}` 
                                  : `${wine.country_en || wine.country} / ${wine.region_en || wine.region}`} / <span className="text-brand-wine font-black">{t.majorGrape}: {currentLang === 'ja' ? wine.grape : (wine.grape_en || wine.grape)}</span>
                              </div>
                              {(currentLang === 'ja' ? wine.tags : (wine.tags_en || wine.tags))?.split('、').map(tag => (
                                <div key={tag} className="px-1.5 py-0.5 bg-brand-wine/5 rounded text-xs text-brand-wine/40 font-bold tracking-wider">
                                  #{tag.trim()}
                                </div>
                              ))}
                            </div>

                          <div className="flex items-end justify-between mt-3 pt-2 border-t border-brand-wine/5">
                            <div className="flex gap-4 text-xs font-sans">
                              {wine.price_glass && wine.price_glass > 0 ? (
                                <div className="flex flex-col bg-brand-gold/5 px-2 py-0.5 rounded-lg border border-brand-gold/20">
                                  <span className="text-[10px] text-brand-gold-dark font-black uppercase tracking-wider mb-0.5">{t.glass}</span>
                                  <span className="font-sans text-lg text-brand-wine font-black">¥{wine.price_glass.toLocaleString()}</span>
                                </div>
                              ) : null}
                              <div className="flex flex-col bg-slate-50 px-2 py-0.5 rounded-lg border border-slate-200">
                                <span className="text-[10px] text-gray-400 font-black uppercase tracking-wider mb-0.5">{t.bottle}</span>
                                <span className="font-sans text-lg text-brand-wine font-black">¥{wine.price_bottle ? wine.price_bottle.toLocaleString() : '-'}</span>
                              </div>
                            </div>
                            <ChevronRight className="w-5 h-5 text-brand-gold-dark transition-all shrink-0" />
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

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
                  <span className="text-sm font-bold tracking-tighter whitespace-nowrap overflow-hidden max-w-0 group-hover:max-w-[120px] transition-all duration-500">
                    {t.concierge}
                  </span>
                  <div className="w-10 h-10 rounded-full bg-brand-ivory text-brand-gold-dark flex items-center justify-center shadow-inner shrink-0 scale-100 group-hover:scale-90 transition-transform">
                    <Sparkles className="w-5 h-5" />
                  </div>
                </div>
              </motion.button>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isConciergeOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsConciergeOpen(false)} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[115]" />
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
                  <h3 className="font-sans text-xl text-brand-wine font-extrabold tracking-widest uppercase">{t.concierge}</h3>
                </div>
                <button 
                  onClick={() => setIsConciergeOpen(false)}
                  className="w-8 h-8 rounded-full bg-brand-gold/10 flex items-center justify-center text-brand-gold-dark"
                >{t.close}</button>
              </div>

              <div className="space-y-10">
                <div className="space-y-4">
                  <p className="text-sm text-brand-gold-dark font-black uppercase tracking-[0.3em] flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-brand-wine text-brand-gold-dark flex items-center justify-center text-xs font-black shadow-inner">1</span>
                    {t.conciergeStep1}
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
                          className={`px-8 py-3 rounded-full text-sm font-bold transition-all border ${
                            step1Color === color 
                              ? 'bg-brand-wine text-brand-gold-dark border-brand-gold shadow-lg font-black' 
                              : 'bg-white border-brand-gold/10 text-brand-wine/60'
                          }`}
                        >
                          {color === '赤' ? t.red : color === '白' ? t.white : t.sparkling}
                        </button>
                      ))}
                  </div>
                </div>

                {step1Color && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                    className="space-y-4 pt-6 border-t border-brand-gold/10"
                  >
                    <p className="text-sm text-brand-gold-dark font-black uppercase tracking-[0.3em] flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-brand-wine text-brand-gold-dark flex items-center justify-center text-xs font-black shadow-inner">2</span>
                      {t.conciergeStep2}
                    </p>
                  <div className="flex flex-wrap gap-2">
                      {getDynamicStyles(step1Color).map(style => {
                        return (
                          <button
                            key={style}
                            onClick={() => {
                              setStep2Style(style);
                              setStep3Budget(null);
                            }}
                            className={`px-5 py-3 rounded-2xl text-sm font-bold transition-all border ${step2Style === style ? 'bg-brand-gold-dark text-white border-brand-gold-dark shadow-md font-black' : 'bg-white border-brand-gold/10 text-brand-wine/60'}`}
                          >
                            {style}
                          </button>
                        );
                      })}
                    </div>
                  </motion.div>
                )}

                {step2Style && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                    className="space-y-4 pt-6 border-t border-brand-gold/10"
                  >
                    <p className="text-sm text-brand-gold-dark font-black uppercase tracking-[0.3em] flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-brand-wine text-brand-gold-dark flex items-center justify-center text-xs font-black shadow-inner">3</span>
                      {t.conciergeStep3}
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      {conciergeBudgets.map(budget => (
                        <button
                          key={budget.id}
                          onClick={() => setStep3Budget(budget.id)}
                          className={`px-4 py-3 rounded-2xl text-xs font-bold transition-all border ${
                            step3Budget === budget.id 
                              ? 'bg-brand-wine text-brand-gold-dark border-brand-gold shadow-md' 
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
                    onClick={() => {
                      setIsConciergeOpen(false);
                      setTimeout(() => {
                        const resultsElement = document.getElementById('wine-list-results');
                        if (resultsElement) {
                          resultsElement.scrollIntoView({ 
                            behavior: 'smooth', 
                            block: 'start' 
                          });
                        }
                      }, 400);
                    }}
                    className="w-full py-4 bg-brand-wine text-brand-gold-dark rounded-full font-black uppercase tracking-[0.4em] shadow-xl active:scale-95 transition-all"
                  >
                    {t.conciergeResult}
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <div className="fixed bottom-6 inset-x-6 z-40 flex justify-center pointer-events-none">
        <div className="bg-black/90 backdrop-blur-xl border border-brand-gold/30 px-8 py-3 rounded-full shadow-2xl animate-in slide-in-from-bottom duration-1000 pointer-events-auto">
          <p className="text-sm md:text-base text-brand-gold-dark font-bold uppercase tracking-[0.15em] text-center">
            {t.footerWarning}
          </p>
        </div>
      </div>

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
              <span className="text-sm text-gray-400 font-bold uppercase tracking-[0.2em] opacity-60">
                {t.vintage} {effectiveWine?.vintage || selectedWine?.vintage}
              </span>
              <button 
                onClick={() => setSelectedWine(null)} 
                className="w-10 h-10 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-brand-gold-dark text-xl hover:bg-white/20 transition-all font-light"
              >✕</button>
            </div>
            
              <div className="flex-1 overflow-y-auto overscroll-behavior-contain px-6 md:px-8 pb-10 space-y-10 custom-scrollbar scroll-smooth">
                <div className="text-center pt-4">
                  <div className="w-full aspect-square md:aspect-[4/5] bg-brand-dark/40 border border-brand-gold/20 rounded-3xl mb-8 flex items-center justify-center p-8 relative shadow-inner group overflow-hidden">
                    <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_center,rgba(184,134,11,0.25),transparent_70%)]" />
                    {selectedWine?.image_url && <img src={getProxyUrl(selectedWine.image_url)} alt="" loading="lazy" className="h-full object-contain relative z-10 transition-transform duration-2000 group-hover:scale-105" />}
                  </div>
                  <h2 className="font-sans text-3xl md:text-5xl font-black text-brand-gold-dark mb-3 tracking-tight leading-tight">
                    {currentLang === 'ja' ? selectedWine?.name_jp : (selectedWine?.name_en || selectedWine?.name_jp)}
                  </h2>
                  {currentLang === 'ja' && selectedWine?.name_en && (
                    <p className="text-sm md:text-base text-gray-400 tracking-[0.3em] uppercase font-bold mb-2">
                      {selectedWine.name_en}
                    </p>
                  )}
                  <p className="text-sm md:text-base text-brand-gold-dark font-bold uppercase tracking-widest border-t border-brand-gold/20 pt-2 inline-block">
                    {t.majorGrape}: {currentLang === 'ja' ? selectedWine?.grape : (selectedWine?.grape_en || selectedWine?.grape)}
                  </p>
                </div>

              <div className="space-y-6 pt-8 border-t border-white/10">
                <div className="flex items-center gap-3 text-brand-gold-dark">
                  <Award className="w-6 h-6 opacity-70" />
                  <h4 className="text-sm font-bold uppercase tracking-[0.3em]">{t.tasteProfile}</h4>
                </div>
                <WineProfile wine={effectiveWine || selectedWine} lang={currentLang} />
              </div>

              <div className="space-y-6">
                <div className="flex items-center gap-3 text-brand-gold-dark">
                  <Info className="w-6 h-6 opacity-70" />
                  <h4 className="text-sm font-bold uppercase tracking-[0.3em]">{t.sommelierComment}</h4>
                </div>
                <div className="relative">
                  <div className="absolute top-4 left-4 text-brand-gold/20"><Sparkles className="w-8 h-8" /></div>
                  <div className="bg-brand-gold/5 p-6 pt-10 rounded-2xl border border-brand-gold/10 shadow-inner min-h-[200px] flex flex-col justify-center">
                    {isDetailLoading ? (
                      <div className="flex flex-col items-center justify-center p-12 gap-4">
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                          className="w-12 h-12 border-2 border-brand-gold/20 border-t-brand-gold rounded-full"
                        />
                        <p className="text-xs text-brand-gold-dark/40 font-bold uppercase tracking-[0.3em] animate-pulse">Fetching sommelier notes...</p>
                      </div>
                    ) : (
                      <div className="space-y-6 animate-in fade-in duration-700">
                        <p className="text-xl md:text-2xl leading-relaxed text-brand-gold-dark font-sans font-bold first-letter:text-5xl first-letter:float-left first-letter:mr-3 first-letter:mt-1 first-letter:text-brand-gold-dark italic">
                          {currentLang === 'ja' 
                            ? (effectiveWine?.ai_explanation || effectiveWine?.aroma_features || '...') 
                            : (effectiveWine?.ai_explanation_en || effectiveWine?.aroma_features_en || '...')}
                        </p>
                        
                        {(currentLang === 'ja' ? effectiveWine?.aroma_features : (effectiveWine?.aroma_features_en || effectiveWine?.aroma_features)) && (
                          <div className="pt-4 border-t border-brand-gold/10">
                            <p className="text-xs text-brand-gold-dark/40 font-black uppercase tracking-widest mb-2">{t.aroma}</p>
                            <p className="text-sm md:text-base text-gray-300 leading-relaxed font-sans">
                              {currentLang === 'ja' ? effectiveWine?.aroma_features : (effectiveWine?.aroma_features_en || effectiveWine?.aroma_features)}
                            </p>
                          </div>
                        )}

                        <div className="flex flex-wrap gap-2 pt-4 border-t border-brand-gold/10">
                          {(currentLang === 'ja' ? selectedWine?.tags : (selectedWine?.tags_en || selectedWine?.tags))?.split('、').map(tag => (
                            <span key={tag} className="px-3 py-1 bg-brand-gold/10 rounded-full text-xs md:text-sm text-brand-gold-dark font-bold tracking-widest whitespace-nowrap border border-brand-gold/20">
                              #{tag.trim()}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {!store?.hideWinePairing && (
                <div className="space-y-6">
                  <div className="flex items-center gap-3 text-brand-gold-dark">
                    <Utensils className="w-6 h-6 opacity-70" />
                    <h4 className="text-sm font-bold uppercase tracking-[0.3em]">{t.pairing}</h4>
                  </div>
                  <div className="flex flex-wrap gap-2 md:gap-3">
                    {isDetailLoading ? (
                      <div className="w-full flex gap-3">
                        {[1, 2, 3].map(i => <div key={i} className="h-10 w-24 bg-brand-gold/10 rounded-full animate-pulse" />)}
                      </div>
                    ) : (
                      (currentLang === 'ja' ? effectiveWine?.pairing : (effectiveWine?.pairing_en || effectiveWine?.pairing))?.split('、').map(p => (
                        <span key={p} className="bg-brand-gold/10 border border-brand-gold/30 px-5 py-3 rounded-full text-sm md:text-base text-brand-gold-dark font-bold tracking-wider animate-in zoom-in-95 duration-500">
                          {p.trim()}
                        </span>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="sticky bottom-0 z-[140] p-6 md:p-8 pt-4 pb-[env(safe-area-inset-bottom,24px)] bg-black/95 backdrop-blur-2xl border-t border-brand-gold/20 flex flex-col gap-6 safe-bottom">
                <div className={`flex items-center px-2 ${selectedWine?.price_glass && selectedWine.price_glass > 0 ? 'justify-between' : 'justify-center'}`}>
                  <div className={`flex flex-col ${!(selectedWine?.price_glass && selectedWine.price_glass > 0) ? 'items-center text-center' : ''}`}>
                    <span className="text-sm text-gray-500 uppercase font-bold tracking-widest mb-1">{t.bottle}</span>
                    <span className="font-sans text-2xl md:text-3xl text-brand-gold-dark font-black tracking-tighter">
                      {selectedWine?.price_bottle ? `¥${selectedWine.price_bottle.toLocaleString()}` : '-'}
                    </span>
                  </div>
                  {selectedWine?.price_glass && selectedWine.price_glass > 0 && (
                    <>
                      <div className="h-10 w-px bg-brand-gold/20" />
                      <div className="flex flex-col text-right">
                        <span className="text-sm text-gray-500 uppercase font-bold tracking-widest mb-1">{t.glass}</span>
                        <span className="font-sans text-2xl md:text-3xl text-brand-gold-dark font-black tracking-tighter">
                          ¥{selectedWine.price_glass.toLocaleString()}
                        </span>
                      </div>
                    </>
                  )}
                </div>
               <div className="text-center">
                 <p className="text-sm text-brand-gold-dark font-bold uppercase tracking-[0.3em] opacity-40">{t.ageNotice}</p>
               </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
