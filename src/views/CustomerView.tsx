// src/views/CustomerView.tsx
import React, { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { WineMaster } from '../types';
import { useWines } from '../lib/WineContext';
import { WineProfile } from '../components/WineProfile';
import { auth } from '../lib/firebase';
import { signInAnonymously } from 'firebase/auth';
import { ChevronRight, ChevronDown, Info, Wine, Utensils, Award, Sparkles, Edit2, Beef, Fish, ChefHat, MapPin, Tag, Search, ArrowUpDown, GlassWater, Wine as WineIcon } from 'lucide-react';
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

// 💡 添付画像および追加要望に基づくカテゴリー定義
const CATEGORIES = [
  { id: 'all', label: 'すべて', labelEn: 'All' },
  { id: 'red', label: '赤ワイン', labelEn: 'Red', match: ['赤', 'red'] },
  { id: 'white', label: '白ワイン', labelEn: 'White', match: ['白', 'white'] },
  { id: 'rose_sparkling', label: 'ロゼスパークリング', labelEn: 'Rosé Sparkling', match: ['ロゼスパークリング', 'ロゼ・スパークリング', 'rose sparkling'] },
  { id: 'rose', label: 'ロゼワイン', labelEn: 'Rosé', match: ['ロゼ', 'rose'] },
  { id: 'orange', label: 'オレンジワイン', labelEn: 'Orange', match: ['オレンジ', 'orange'] },
  { id: 'sparkling', label: 'シャンパン・スパークリング', labelEn: 'Sparkling', match: ['シャンパン', 'スパークリング', 'champagne', 'sparkling'] },
  { id: 'sake', label: '日本酒', labelEn: 'Sake', match: ['日本酒', 'sake'] },
  { id: 'shochu', label: '焼酎・和酒', labelEn: 'Shochu/Washu', match: ['焼酎', '和酒', 'shochu'] },
  { id: 'other', label: 'その他', labelEn: 'Other', match: ['その他', 'デザートワイン', 'other'] }
];

const HIRAGINO_MINCHO = '"Hiragino Mincho ProN", "ヒラギノ明朝 ProN W3", "Shippori Mincho", "Bodoni Moda", serif';
const HIRAGINO_GOTHIC = '"Hiragino Kaku Gothic ProN", "Hiragino Sans", "Inter", sans-serif';

export const CustomerView: React.FC = () => {
  const { storeId: routeStoreId } = useParams();
  const { user } = useWines();
  const [isConciergeOpen, setIsConciergeOpen] = useState(false);
  const [selectedWine, setSelectedWine] = useState<WineMaster | null>(null);
  const [isScrolled, setIsScrolled] = useState(false);
  const [currentLang, setCurrentLang] = useState<'ja' | 'en'>('ja');

  // 新しいフィルター・ソート状態
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [sortBy, setSortBy] = useState<'type' | 'priceAsc' | 'priceDesc' | 'popular'>('type');

  // コンシェルジュ用状態（既存維持）
  const [step1Color, setStep1Color] = useState<string | null>(null);
  const [step2Style, setStep2Style] = useState<string | null>(null);
  const [step3Budget, setStep3Budget] = useState<number | null>(null);

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
      typeSort: 'タイプ別',
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
      sweet: '甘口',
      searchPlaceholder: '銘柄名、ぶどう品種で検索...'
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
      typeSort: 'By Type',
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
      sweet: 'Sweet',
      searchPlaceholder: 'Search by name or grape...'
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

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const finalStoreId = routeStoreId || new URLSearchParams(window.location.search).get('storeId') || user?.storeId;
  const { data: menuData, isLoading: isDataFetching, refetch: fetchStoreData } = usePublicMenuQuery(finalStoreId || null);
  const { data: fullWine, isLoading: isDetailLoading } = useWineDetailQuery(selectedWine?.id || null);
  
  const effectiveWine = (selectedWine && fullWine) ? { ...selectedWine, ...fullWine } : selectedWine;
  const store = menuData?.store || null;
  const inventory = menuData?.menu || [];

  const getProxyUrl = (url: string) => `/api/proxy-image?url=${encodeURIComponent(url)}`;

  const budgetTiers = store?.budgetTiers || [];
  
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

  const getDynamicStyles = (color: string) => {
    const isEn = currentLang === 'en';
    if (color === '赤') return [t.fullBody, t.mediumBody, t.lightBody];
    if (color === '白') return [t.dry, t.mediumDry, t.sweet];
    if (color === '泡' || color === 'スパークリング') {
      return [isEn ? 'Brut (Dry)' : '辛口 (Brut)', isEn ? 'Extra Dry' : '中辛口', isEn ? 'Demi-Sec (Sweet)' : '甘口 (Demi-Sec)'];
    }
    return [t.dry, t.sweet];
  };

  // 💡 ワインがどのカテゴリーに属するかを判定するヘルパー関数
  const getWineCategory = (wine: WineMaster) => {
    const type = String(wine.type || '').toLowerCase();
    const name = String(wine.name_jp || '').toLowerCase();
    const color = String(wine.color || '').toLowerCase();
    const combo = `${type} ${name} ${color}`;
    
    for (const cat of CATEGORIES) {
      if (cat.id === 'all' || cat.id === 'other') continue;
      if (cat.match && cat.match.some(m => combo.includes(m))) {
        return cat.id;
      }
    }
    return 'other';
  };

  // 💡 現在の店舗のメニューに存在するカテゴリーだけを抽出
  const activeCategories = useMemo(() => {
    const availableIds = new Set<string>(['all']);
    inventory.forEach((wine: WineMaster) => {
      if (wine.visible !== false) {
        availableIds.add(getWineCategory(wine));
      }
    });
    return CATEGORIES.filter(cat => availableIds.has(cat.id));
  }, [inventory]);

  // 💡 メインのフィルタリング＆ソート処理
  const displayedInventory = useMemo(() => {
    let filtered = inventory.filter((wine: WineMaster) => {
      if (wine.visible === false) return false;

      // 1. キーワード検索
      const matchesSearch = 
        (wine.name_jp || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (wine.name_en || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (wine.grape || '').toLowerCase().includes(searchTerm.toLowerCase());
      
      // 2. カテゴリー（タイプ）検索
      const categoryMatches = selectedCategory === 'all' || getWineCategory(wine) === selectedCategory;

      // 3. コンシェルジュ機能のフィルター
      if (step1Color && wine.color !== step1Color) return false;
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
      if (step3Budget) {
        const budgetOpt = conciergeBudgets.find(b => b.id === step3Budget);
        if (budgetOpt) {
          if (budgetOpt.min !== undefined && wine.price_bottle < budgetOpt.min) return false;
          if (budgetOpt.max !== undefined && wine.price_bottle > budgetOpt.max) return false;
        }
      }

      return matchesSearch && categoryMatches;
    });

    // ソート処理
    return filtered.sort((a, b) => {
      if (sortBy === 'priceAsc') return (a.price_bottle || 0) - (b.price_bottle || 0);
      if (sortBy === 'priceDesc') return (b.price_bottle || 0) - (a.price_bottle || 0);
      if (sortBy === 'popular') return (b.isFeatured ? 1 : 0) - (a.isFeatured ? 1 : 0);
      
      // デフォルト（タイプ別）: カテゴリーの定義順にソート
      const catA = CATEGORIES.findIndex(c => c.id === getWineCategory(a));
      const catB = CATEGORIES.findIndex(c => c.id === getWineCategory(b));
      if (catA !== catB) return catA - catB;
      
      return (b.isFeatured ? 1 : 0) - (a.isFeatured ? 1 : 0);
    });
  }, [inventory, searchTerm, selectedCategory, sortBy, step1Color, step2Style, step3Budget, conciergeBudgets, t]);

  const hasNoResults = displayedInventory.length === 0;

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
       <div className="min-h-screen bg-brand-ivory flex justify-center items-start md:items-center" style={{ fontFamily: HIRAGINO_GOTHIC }}>
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
      <div className="min-h-screen bg-brand-wine flex flex-col items-center justify-center p-8 text-center" style={{ fontFamily: HIRAGINO_MINCHO }}>
        <Wine className="w-16 h-16 text-brand-gold/20 mb-6" />
        <h2 className="text-2xl font-bold text-brand-gold-dark mb-4">{t.loadingStore}</h2>
        <p className="text-sm text-brand-ivory/60 leading-relaxed max-w-xs" style={{ fontFamily: HIRAGINO_GOTHIC }}>{t.loadingStoreRetry}</p>
      </div>
    );
  }

  if (inventory.length === 0) {
    return (
      <div className="min-h-screen bg-brand-wine flex flex-col items-center justify-center p-8 text-center text-brand-gold-dark overflow-hidden" style={{ fontFamily: HIRAGINO_MINCHO }}>
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
              <h2 className="text-3xl md:text-4xl text-brand-gold-dark mb-2 tracking-[0.25em] font-black uppercase leading-snug">
                {t.preparingTitle}
              </h2>
              <div className="flex items-center justify-center gap-4">
                <div className="h-px w-8 bg-brand-gold/30" />
                <span className="opacity-60 text-xs tracking-[0.3em] uppercase" style={{ fontFamily: HIRAGINO_GOTHIC }}>{t.preparingSubtitle}</span>
                <div className="h-px w-8 bg-brand-gold/30" />
              </div>
            </div>
            
            <div className="space-y-4" style={{ fontFamily: HIRAGINO_GOTHIC }}>
              <p className="text-xs text-brand-ivory/80 leading-relaxed max-w-[320px] mx-auto font-bold tracking-[0.15em] uppercase">
                {t.preparingDesc1}
              </p>
              <p className="text-xs text-brand-gold/60 leading-relaxed max-w-[280px] mx-auto tracking-[0.1em]">
                {t.preparingDesc2}
              </p>
            </div>

            <div className="text-xs text-brand-gold/30 tracking-[0.4em] uppercase font-bold pt-4" style={{ fontFamily: HIRAGINO_GOTHIC }}>
              {t.preparingTime}
            </div>
          </div>

          <div className="mt-20 flex flex-col gap-5 items-center" style={{ fontFamily: HIRAGINO_GOTHIC }}>
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
      className="min-h-screen bg-[#0A0A0A] relative text-[16px] font-medium leading-relaxed"
      style={{ fontFamily: HIRAGINO_GOTHIC }}
    >
      {/* Header Section */}
      <header className={`fixed top-0 inset-x-0 transition-all duration-500 z-[100] ${
        isScrolled ? 'bg-black/90 backdrop-blur-md border-b border-brand-gold/20 py-3' : 'bg-transparent py-6'
      }`}>
        <div className="flex items-center px-4 md:px-8">
          <div className="flex-1">
            {user && (user.role === 'admin' || user.role === 'rep' || user.role === 'owner') && (
              <button 
                onClick={() => window.location.href = (user.role === 'admin' || user.role === 'rep') ? `/admin?storeId=${store.id}` : `/owner?storeId=${store.id}`}
                className="w-10 h-10 rounded-full bg-black/40 flex items-center justify-center border border-brand-gold/20 text-brand-gold hover:bg-brand-gold hover:text-black transition-all"
              >
                <Edit2 className="w-4 h-4" />
              </button>
            )}
          </div>
          <div className="flex-none text-center">
            <h1 className="text-brand-gold font-extrabold text-xl md:text-2xl tracking-[0.2em] uppercase leading-tight" style={{ fontFamily: HIRAGINO_MINCHO }}>
              {store.name}
            </h1>
          </div>
          <div className="flex-1 flex justify-end">
            <div className="flex items-center bg-white/5 rounded-full p-1 border border-brand-gold/20 shadow-inner">
              <button onClick={() => setCurrentLang('ja')} className={`px-3 py-1 rounded-full text-[10px] font-black transition-all ${currentLang === 'ja' ? 'bg-brand-gold text-black' : 'text-brand-gold/40 hover:text-brand-gold/70'}`}>JP</button>
              <button onClick={() => setCurrentLang('en')} className={`px-3 py-1 rounded-full text-[10px] font-black transition-all ${currentLang === 'en' ? 'bg-brand-gold text-black' : 'text-brand-gold/40 hover:text-brand-gold/70'}`}>EN</button>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <div className="pt-28 pb-6 px-4 relative overflow-hidden flex flex-col items-center">
        <div className="absolute inset-0 bg-gradient-to-b from-brand-gold/10 via-transparent to-transparent opacity-50" />
        <WineIcon className="w-6 h-6 text-brand-gold mb-3 opacity-80" />
        <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-brand-gold/60">{store.cuisine_type} • Wine Menu</p>
      </div>

      <main className="max-w-4xl mx-auto px-4 space-y-6">
        
        {/* Search & Filter Section */}
        <div className={`sticky z-40 transition-all duration-300 ${isScrolled ? 'top-[68px]' : 'top-[76px]'} bg-[#0A0A0A]/95 backdrop-blur-xl pt-2 pb-4 -mx-4 px-4 border-b border-brand-gold/10 space-y-4 shadow-[0_10px_30px_rgba(0,0,0,0.5)]`}>
          
          {/* Search Bar */}
          <div className="relative flex-1 group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-gold/40 group-focus-within:text-brand-gold transition-colors" />
            <input 
              type="text"
              placeholder={t.searchPlaceholder}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white/5 border border-brand-gold/20 rounded-full pl-11 pr-4 py-3.5 text-sm text-brand-ivory focus:border-brand-gold focus:bg-white/10 outline-none transition-all placeholder:text-brand-gold/30 shadow-inner"
            />
          </div>

          {/* Type Filters (Horizontal Scroll) */}
          <div className="overflow-x-auto hide-scrollbar -mx-4 px-4">
            <div className="flex gap-2 min-w-max pb-1">
              {activeCategories.map(category => (
                <button
                  key={category.id}
                  onClick={() => setSelectedCategory(category.id)}
                  className={`px-5 py-2.5 rounded-full text-xs font-bold transition-all whitespace-nowrap ${
                    selectedCategory === category.id
                      ? 'bg-brand-gold text-brand-wine shadow-[0_0_15px_rgba(212,175,55,0.3)]'
                      : 'bg-white/5 text-brand-gold/60 border border-brand-gold/20 hover:bg-white/10 hover:text-brand-gold'
                  }`}
                >
                  {currentLang === 'ja' ? category.label : (category.labelEn || category.label)}
                </button>
              ))}
            </div>
          </div>

          {/* Sort Selector */}
          <div className="flex justify-end">
            <div className="flex items-center gap-2 bg-black/40 px-3 py-1.5 rounded-full border border-brand-gold/20 hover:border-brand-gold/40 transition-colors">
              <ArrowUpDown className="w-3.5 h-3.5 text-brand-gold/60" />
              <select 
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="bg-transparent text-xs font-bold text-brand-gold/90 outline-none cursor-pointer appearance-none pr-2"
              >
                <option value="type" className="bg-[#0A0A0A] text-brand-gold">{t.typeSort}</option>
                <option value="popular" className="bg-[#0A0A0A] text-brand-gold">{t.recommend}</option>
                <option value="priceAsc" className="bg-[#0A0A0A] text-brand-gold">{t.priceAsc}</option>
                <option value="priceDesc" className="bg-[#0A0A0A] text-brand-gold">{t.priceDesc}</option>
              </select>
            </div>
          </div>
        </div>

        {/* Wine Grid */}
        <div id="wine-list-results" className="pb-32">
          {hasNoResults ? (
            <div className="py-16 text-center border border-brand-gold/10 rounded-[2rem] bg-white/5 mx-2">
              <WineIcon className="w-12 h-12 text-brand-gold/20 mx-auto mb-4" />
              <p className="text-brand-gold/60 text-sm font-bold tracking-widest">{currentLang === 'ja' ? '該当するワインが見つかりませんでした。' : 'No wines found matching your criteria.'}</p>
            </div>
          ) : (
            <div className="space-y-12">
              
              {/* おすすめ（Featured）セクション */}
              {displayedInventory.some(w => w.isFeatured) && (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 px-2">
                    <Sparkles className="w-4 h-4 text-brand-gold" />
                    <h3 className="text-sm text-brand-gold uppercase tracking-[0.3em] font-bold" style={{ fontFamily: HIRAGINO_MINCHO }}>{t.sommelierRecommend}</h3>
                    <div className="flex-1 h-px bg-brand-gold/20" />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <AnimatePresence>
                      {displayedInventory.filter(w => w.isFeatured).map((wine, index) => (
                        <motion.div
                          key={wine.id}
                          layout
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.9 }}
                          transition={{ duration: 0.3, delay: index * 0.05 }}
                          onClick={() => setSelectedWine(wine)}
                          className="group relative bg-gradient-to-br from-white/5 to-white/[0.02] border border-brand-gold/30 rounded-[2rem] p-5 hover:border-brand-gold shadow-[0_0_15px_rgba(212,175,55,0.05)] transition-all cursor-pointer overflow-hidden flex flex-col h-full"
                        >
                          {/* 輝きエフェクト */}
                          <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-brand-gold/[0.05] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                          
                          {/* ヘッダーエリア */}
                          <div className="flex items-center justify-between mb-4 relative z-10">
                            <div className="flex items-center gap-2">
                              <span className="px-2.5 py-1 bg-brand-gold text-brand-wine rounded-full text-[10px] font-black uppercase tracking-widest shadow-sm">
                                {currentLang === 'ja' 
                                  ? (wine.type || CATEGORIES.find(c => c.id === getWineCategory(wine))?.label || 'WINE')
                                  : (CATEGORIES.find(c => c.id === getWineCategory(wine))?.labelEn || 'WINE')}
                              </span>
                            </div>
                            <span className="text-[10px] text-brand-gold/60 font-bold uppercase tracking-widest flex items-center gap-1">
                              {currentLang === 'ja' ? wine.country : (wine.country_en || wine.country)}
                            </span>
                          </div>

                          {/* ワイン名 */}
                          <div className="flex-1 relative z-10 mb-6 flex gap-4">
                            <div className="w-20 h-24 bg-white flex items-center justify-center p-2 rounded-xl relative border border-brand-gold/20 shadow-inner group-hover:border-brand-gold/50 transition-all overflow-hidden shrink-0">
                               {wine.image_url && <img src={getProxyUrl(wine.image_url)} alt="" loading="lazy" className="w-full h-full object-contain group-hover:scale-110 transition-transform duration-1000 ease-out drop-shadow-md" />}
                            </div>
                            <div className="flex-1 flex flex-col justify-center">
                              <h3 className="serif text-lg text-white font-bold leading-snug group-hover:text-brand-gold transition-colors line-clamp-2 mb-1" style={{ fontFamily: HIRAGINO_MINCHO }}>
                                {currentLang === 'ja' ? wine.name_jp : (wine.name_en || wine.name_jp)}
                              </h3>
                              {currentLang === 'ja' && (
                                <p className="text-[10px] text-gray-500 font-medium tracking-wide uppercase line-clamp-1">
                                  {wine.name_en}
                                </p>
                              )}
                            </div>
                          </div>

                          {/* 価格エリア */}
                          <div className="flex flex-wrap items-end justify-between gap-4 mt-auto pt-4 border-t border-brand-gold/10 relative z-10">
                            <div className="flex items-center gap-4">
                              {wine.price_glass > 0 && (
                                <div className="flex flex-col">
                                  <span className="text-[9px] text-brand-gold/60 uppercase tracking-widest font-bold mb-1 flex items-center gap-1">
                                    <GlassWater className="w-3 h-3" /> Glass
                                  </span>
                                  <div className="flex items-baseline gap-0.5">
                                    <span className="text-brand-gold/60 text-xs font-mono">¥</span>
                                    <span className="text-brand-gold text-lg font-mono font-medium">{wine.price_glass.toLocaleString()}</span>
                                  </div>
                                </div>
                              )}
                              
                              {wine.price_bottle > 0 && (
                                <div className="flex flex-col">
                                  <span className="text-[9px] text-brand-gold/60 uppercase tracking-widest font-bold mb-1 flex items-center gap-1">
                                    <WineIcon className="w-3 h-3" /> Bottle
                                  </span>
                                  <div className="flex items-baseline gap-0.5">
                                    <span className="text-white/60 text-xs font-mono">¥</span>
                                    <span className="text-white text-lg font-mono font-medium">{wine.price_bottle.toLocaleString()}</span>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                </div>
              )}

              {/* スタンダードセクション */}
              {displayedInventory.some(w => !w.isFeatured) && (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 px-2">
                    <h3 className="text-sm text-brand-gold/50 uppercase tracking-[0.3em] font-bold" style={{ fontFamily: HIRAGINO_MINCHO }}>{t.standardSelection}</h3>
                    <div className="flex-1 h-px bg-brand-gold/10" />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <AnimatePresence>
                      {displayedInventory.filter(w => !w.isFeatured).map((wine, index) => (
                        <motion.div
                          key={wine.id}
                          layout
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.9 }}
                          transition={{ duration: 0.3, delay: index * 0.05 }}
                          onClick={() => setSelectedWine(wine)}
                          className="group relative bg-white/5 border border-brand-gold/10 rounded-2xl p-4 hover:border-brand-gold/30 hover:bg-white/10 transition-all cursor-pointer flex flex-col h-full"
                        >
                          <div className="flex items-center justify-between mb-3">
                            <span className="px-2 py-0.5 bg-brand-gold/10 border border-brand-gold/20 text-brand-gold rounded-full text-[9px] font-black uppercase tracking-widest">
                              {currentLang === 'ja' 
                                  ? (wine.type || CATEGORIES.find(c => c.id === getWineCategory(wine))?.label || 'WINE')
                                  : (CATEGORIES.find(c => c.id === getWineCategory(wine))?.labelEn || 'WINE')}
                            </span>
                            <span className="text-[9px] text-gray-500 font-bold uppercase tracking-widest">
                              {currentLang === 'ja' ? wine.country : (wine.country_en || wine.country)}
                            </span>
                          </div>

                          <div className="flex-1 mb-4 flex gap-3">
                            <div className="w-16 h-20 bg-white/10 flex items-center justify-center p-1.5 rounded-lg border border-white/5 shrink-0">
                               {wine.image_url && <img src={getProxyUrl(wine.image_url)} alt="" loading="lazy" className="w-full h-full object-contain group-hover:scale-110 transition-transform duration-500" />}
                            </div>
                            <div className="flex-1 flex flex-col justify-center">
                              <h3 className="text-base text-brand-ivory font-bold leading-snug group-hover:text-brand-gold transition-colors line-clamp-2 mb-1" style={{ fontFamily: HIRAGINO_MINCHO }}>
                                {currentLang === 'ja' ? wine.name_jp : (wine.name_en || wine.name_jp)}
                              </h3>
                            </div>
                          </div>

                          <div className="flex items-end justify-between mt-auto pt-3 border-t border-white/5">
                            <div className="flex items-center gap-3">
                              {wine.price_glass > 0 && (
                                <div className="flex items-baseline gap-0.5">
                                  <span className="text-[9px] text-brand-gold/60 uppercase tracking-widest mr-1">G:</span>
                                  <span className="text-brand-gold/60 text-[10px]">¥</span>
                                  <span className="text-brand-gold text-sm font-bold">{wine.price_glass.toLocaleString()}</span>
                                </div>
                              )}
                              {wine.price_bottle > 0 && (
                                <div className="flex items-baseline gap-0.5">
                                  <span className="text-[9px] text-gray-500 uppercase tracking-widest mr-1">B:</span>
                                  <span className="text-gray-500 text-[10px]">¥</span>
                                  <span className="text-brand-ivory text-sm font-bold">{wine.price_bottle.toLocaleString()}</span>
                                </div>
                              )}
                            </div>
                            <ChevronRight className="w-4 h-4 text-brand-gold/40 group-hover:text-brand-gold transition-colors" />
                          </div>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                </div>
              )}

            </div>
          )}
        </div>
      </main>

      {/* Concierge FAB */}
      <AnimatePresence>
        {isScrolled && !isConciergeOpen && (
          <motion.button
            initial={{ opacity: 0, scale: 0.5, y: 50 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.5, y: 50 }}
            onClick={() => setIsConciergeOpen(true)}
            className="fixed bottom-24 right-6 z-[110] flex items-center bg-brand-gold text-brand-wine p-1.5 rounded-full shadow-[0_10px_40px_rgba(212,175,55,0.3)] hover:scale-105 active:scale-95 transition-all group overflow-hidden"
          >
            <div className="flex items-center gap-0 group-hover:gap-2 transition-all px-2">
              <span className="text-sm font-bold tracking-tighter whitespace-nowrap overflow-hidden max-w-0 group-hover:max-w-[120px] transition-all duration-500">
                {t.concierge}
              </span>
              <div className="w-10 h-10 rounded-full bg-brand-wine text-brand-gold flex items-center justify-center shadow-inner shrink-0 scale-100 group-hover:scale-90 transition-transform">
                <Sparkles className="w-5 h-5" />
              </div>
            </div>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Concierge Modal */}
      <AnimatePresence>
        {isConciergeOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsConciergeOpen(false)} className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[115]" />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed bottom-0 inset-x-0 bg-[#111] rounded-t-[2rem] z-[120] border-t border-brand-gold/30 px-6 pt-8 pb-12 shadow-[0_-20px_60px_rgba(0,0,0,0.5)] max-h-[90dvh] overflow-y-auto"
            >
              <div className="absolute top-3 left-1/2 -translate-x-1/2 w-12 h-1 bg-white/20 rounded-full" />
              
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <Sparkles className="w-5 h-5 text-brand-gold" />
                  <h3 className="text-lg text-brand-gold font-bold tracking-widest uppercase" style={{ fontFamily: HIRAGINO_MINCHO }}>{t.concierge}</h3>
                </div>
                <button 
                  onClick={() => setIsConciergeOpen(false)}
                  className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white"
                >{t.close}</button>
              </div>

              <div className="space-y-8">
                <div className="space-y-3">
                  <p className="text-xs text-brand-gold/60 font-bold uppercase tracking-[0.2em] flex items-center gap-2">
                    <span className="w-4 h-4 rounded-full bg-brand-gold text-black flex items-center justify-center text-[10px] font-bold">1</span>
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
                          }}
                          className={`px-6 py-2.5 rounded-full text-xs font-bold transition-all border ${
                            step1Color === color 
                              ? 'bg-brand-gold text-black border-brand-gold shadow-lg font-bold' 
                              : 'bg-white/5 border-white/10 text-white/60'
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
                    className="space-y-3 pt-6 border-t border-white/10"
                  >
                    <p className="text-xs text-brand-gold/60 font-bold uppercase tracking-[0.2em] flex items-center gap-2">
                      <span className="w-4 h-4 rounded-full bg-brand-gold text-black flex items-center justify-center text-[10px] font-bold">2</span>
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
                            className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all border ${step2Style === style ? 'bg-brand-gold text-black border-brand-gold shadow-md' : 'bg-white/5 border-white/10 text-white/60'}`}
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
                    className="space-y-3 pt-6 border-t border-white/10"
                  >
                    <p className="text-xs text-brand-gold/60 font-bold uppercase tracking-[0.2em] flex items-center gap-2">
                      <span className="w-4 h-4 rounded-full bg-brand-gold text-black flex items-center justify-center text-[10px] font-bold">3</span>
                      {t.conciergeStep3}
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      {conciergeBudgets.map(budget => (
                        <button
                          key={budget.id}
                          onClick={() => setStep3Budget(budget.id)}
                          className={`px-4 py-3 rounded-xl text-xs font-bold transition-all border ${
                            step3Budget === budget.id 
                              ? 'bg-brand-gold text-black border-brand-gold shadow-md' 
                              : 'bg-white/5 border-white/10 text-white/60'
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
                    className="w-full py-4 bg-brand-gold text-black rounded-full text-sm font-bold uppercase tracking-[0.2em] shadow-lg active:scale-95 transition-all"
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
        <div className="bg-black/90 backdrop-blur-xl border border-brand-gold/30 px-6 py-2.5 rounded-full shadow-2xl pointer-events-auto">
          <p className="text-xs text-brand-gold/80 font-bold tracking-[0.1em] text-center">
            {t.footerWarning}
          </p>
        </div>
      </div>

      {/* Wine Details Modal */}
      <AnimatePresence>
        {selectedWine && (
          <WineProfile
            wine={selectedWine}
            store={store}
            onClose={() => setSelectedWine(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
};
