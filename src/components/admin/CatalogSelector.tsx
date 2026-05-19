import React, { useState, useMemo, useEffect } from 'react';
import { WineMaster, Store } from '../../types';
import { Search, X, CheckCircle2, ChevronLeft, ChevronRight, Filter, Wine, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface CatalogSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  selectedStore: Store | undefined;
  wines: WineMaster[];
  masterSearchTerm: string;
  setMasterSearchTerm: (term: string) => void;
  selectedWines: WineMaster[];
  selectedMasterIds: string[];
  toggleMasterSelection: (id: string) => void;
  handleBulkAddWines: () => void;
  hasMoreWines: boolean;
  onLoadMoreWines: () => void;
}

export const CatalogSelector: React.FC<CatalogSelectorProps> = ({
  isOpen,
  onClose,
  selectedStore,
  wines,
  masterSearchTerm,
  setMasterSearchTerm,
  selectedWines,
  selectedMasterIds,
  toggleMasterSelection,
  handleBulkAddWines,
  hasMoreWines,
  onLoadMoreWines,
}) => {
  // Tab State
  const [activeTab, setActiveTab] = useState<'PIEROTH' | 'OTHER'>('PIEROTH');
  
  // Facet States
  const [selectedSuppliers, setSelectedSuppliers] = useState<Set<string>>(new Set());
  const [selectedCountries, setSelectedCountries] = useState<Set<string>>(new Set());
  const [selectedColors, setSelectedColors] = useState<Set<string>>(new Set());
  const [priceRange, setPriceRange] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20; 

  // Reset logic
  useEffect(() => {
    setCurrentPage(1);
    // Clear sub-filters when switching top-level tabs to avoid confusion
    setSelectedSuppliers(new Set());
    setSelectedCountries(new Set());
    setSelectedColors(new Set());
    setPriceRange(null);
  }, [activeTab]);

  useEffect(() => {
    setCurrentPage(1);
  }, [masterSearchTerm, selectedSuppliers, selectedCountries, selectedColors, priceRange]);

  // Extract facets from current wines (split by tab)
  const tabWines = useMemo(() => {
    return wines.filter(w => {
      const s = (w.supplier || 'PIEROTH').toUpperCase();
      return activeTab === 'PIEROTH' ? s === 'PIEROTH' : s === 'OTHER';
    });
  }, [wines, activeTab]);

  const facets = useMemo(() => {
    const suppliers = new Set<string>();
    const countries = new Set<string>();
    const colors = new Set<string>();
    
    tabWines.forEach(w => {
      if (w.supplier) suppliers.add(w.supplier);
      if (w.country) countries.add(w.country);
      if (w.color) colors.add(w.color);
    });
    
    return {
      suppliers: Array.from(suppliers).sort(),
      countries: Array.from(countries).sort(),
      colors: Array.from(colors).sort()
    };
  }, [tabWines]);

  // Search matching logic optimized
  const matchesKeyword = (w: WineMaster, term: string) => {
    if (!term) return true;
    const t = term.toLowerCase();
    return (
      w.name_jp?.toLowerCase().includes(t) ||
      w.name_en?.toLowerCase().includes(t) ||
      w.id?.toLowerCase().includes(t) ||
      w.grape?.toLowerCase().includes(t) ||
      w.region?.toLowerCase().includes(t) ||
      w.country?.toLowerCase().includes(t) ||
      (w.supplier || '').toLowerCase().includes(t)
    );
  };

  // Combined Filtered List
  const filteredWines = useMemo(() => {
    let result = tabWines.filter(w => {
      // Keyword search
      if (!matchesKeyword(w, masterSearchTerm)) return false;

      // Supplier sub-filter (only relevant for 'OTHER' tab)
      if (activeTab === 'OTHER' && selectedSuppliers.size > 0 && !selectedSuppliers.has(w.supplier || '')) return false;

      // Country filter
      if (selectedCountries.size > 0 && !selectedCountries.has(w.country)) return false;

      // Color filter
      if (selectedColors.size > 0 && !selectedColors.has(w.color)) return false;

      // Price filter
      if (priceRange) {
        const p = w.price_bottle || 0;
        if (priceRange === 'low' && p > 5000) return false;
        if (priceRange === 'mid' && (p <= 5000 || p > 10000)) return false;
        if (priceRange === 'high' && p <= 10000) return false;
      }

      return true;
    });

    // Sorting: Selected at the bottom, then by name
    return result.sort((a, b) => {
      const aId = a.id;
      const bId = b.id;
      const aSelected = selectedWines.some(sw => sw.id === aId);
      const bSelected = selectedWines.some(sw => sw.id === bId);
      
      if (aSelected && !bSelected) return 1;
      if (!aSelected && bSelected) return -1;
      
      return (a.name_jp || '').localeCompare(b.name_jp || '');
    });
  }, [tabWines, masterSearchTerm, selectedSuppliers, selectedCountries, selectedColors, priceRange, selectedWines, activeTab]);

  // Pagination
  const totalPages = Math.ceil(filteredWines.length / itemsPerPage);
  const currentItems = filteredWines.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const toggleFacet = (set: Set<string>, val: string, setter: (s: Set<string>) => void) => {
    const next = new Set(set);
    if (next.has(val)) next.delete(val);
    else next.add(val);
    setter(next);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[100] flex items-center justify-center p-0 md:p-8">
      <motion.div 
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        className="bg-white rounded-[2rem] md:rounded-[40px] w-full max-w-[1200px] h-full md:h-[90vh] flex flex-col overflow-hidden shadow-2xl relative"
      >
        {/* Header */}
        <div className="p-6 md:px-12 md:py-8 border-b border-slate-100 flex items-center justify-between bg-white shrink-0">
          <div>
            <h2 className="serif text-2xl md:text-4xl text-slate-900 tracking-tight">ワインカタログ</h2>
            <div className="flex items-center gap-3 mt-1">
              <div className="flex items-center gap-1.5 px-2 py-0.5 bg-brand-gold/10 rounded-full">
                <div className="w-1.5 h-1.5 bg-brand-gold rounded-full animate-pulse" />
                <span className="text-[10px] font-black text-brand-gold uppercase tracking-widest">Editor Mode</span>
              </div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{selectedStore?.name} のラインナップ編集</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="w-14 h-14 bg-slate-50 border border-slate-100 rounded-full flex items-center justify-center text-slate-400 hover:text-brand-wine transition-all hover:bg-slate-100 group"
          >
            <X className="w-7 h-7 group-hover:rotate-90 transition-transform duration-300" />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden bg-white">
          {/* Left Panel: Faceted Sidebar - Luxury Styling */}
          <aside className="w-72 border-r border-slate-100 bg-slate-50/30 p-8 overflow-y-auto hidden lg:block custom-scrollbar">
            <div className="flex items-center gap-3 text-brand-wine mb-10">
              <div className="p-2 bg-brand-wine/5 rounded-xl">
                <Filter className="w-5 h-5" />
              </div>
              <span className="text-xs font-black uppercase tracking-[0.2em]">ファセット検索</span>
            </div>

            <div className="space-y-10">
              {/* Supplier Filter (Tab Specific) */}
              {activeTab === 'OTHER' && facets.suppliers.length > 0 && (
                <div className="animate-in fade-in slide-in-from-left-2 duration-500">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] block mb-5 border-b border-slate-100 pb-2">インポーター</label>
                  <div className="grid gap-1.5">
                    {facets.suppliers.map(s => (
                      <button 
                        key={s}
                        onClick={() => toggleFacet(selectedSuppliers, s, setSelectedSuppliers)}
                        className={`group flex items-center gap-3 px-4 py-3 rounded-2xl text-xs transition-all ${
                          selectedSuppliers.has(s) 
                            ? 'bg-brand-wine text-white font-bold shadow-luxury-wine' 
                            : 'text-slate-600 hover:bg-white hover:shadow-sm'
                        }`}
                      >
                        <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${
                          selectedSuppliers.has(s) ? 'bg-white border-white' : 'border-slate-300 bg-white'
                        }`}>
                          {selectedSuppliers.has(s) && <CheckCircle2 className="w-3 h-3 text-brand-wine" />}
                        </div>
                        <span className="truncate">{s}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Color Filter */}
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] block mb-5 border-b border-slate-100 pb-2">ワインの色</label>
                <div className="grid grid-cols-2 gap-2">
                  {['赤', '白', '泡', 'ロゼ'].map(c => (
                    <button 
                      key={c}
                      onClick={() => toggleFacet(selectedColors, c, setSelectedColors)}
                      className={`px-4 py-2.5 rounded-xl text-[11px] font-bold transition-all border ${
                        selectedColors.has(c) 
                          ? 'bg-brand-gold border-brand-gold text-white shadow-luxury-gold' 
                          : 'bg-white border-slate-200 text-slate-500 hover:border-brand-gold/30 hover:text-brand-gold'
                      }`}
                    >
                      {c === '泡' ? 'スパークリング' : c}
                    </button>
                  ))}
                </div>
              </div>

              {/* Price Range Filter */}
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] block mb-5 border-b border-slate-100 pb-2">価格帯</label>
                <div className="grid gap-1.5">
                  {[
                    { id: 'low', label: '〜 5,000円' },
                    { id: 'mid', label: '5,000円 〜 10,000円' },
                    { id: 'high', label: '10,000円以上' },
                  ].map(r => (
                    <button 
                      key={r.id}
                      onClick={() => setPriceRange(priceRange === r.id ? null : r.id)}
                      className={`group flex items-center justify-between px-4 py-3 rounded-2xl text-xs transition-all ${
                        priceRange === r.id 
                          ? 'bg-brand-gold/10 border border-brand-gold/30 text-brand-gold-dark font-bold' 
                          : 'text-slate-600 bg-white border border-slate-100 hover:border-brand-gold/30 hover:shadow-sm'
                      }`}
                    >
                      <span>{r.label}</span>
                      {priceRange === r.id && <CheckCircle2 className="w-4 h-4" />}
                    </button>
                  ))}
                </div>
              </div>

              {/* Country Filter - Scrollable Area */}
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] block mb-5 border-b border-slate-100 pb-2">生産国</label>
                <div className="grid gap-1 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
                  {facets.countries.map(c => (
                    <button 
                      key={c}
                      onClick={() => toggleFacet(selectedCountries, c, setSelectedCountries)}
                      className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs transition-all ${
                        selectedCountries.has(c) 
                          ? 'bg-brand-wine/10 text-brand-wine font-bold' 
                          : 'text-slate-500 hover:bg-white'
                      }`}
                    >
                      <div className={`w-1.5 h-1.5 rounded-full transition-all ${
                        selectedCountries.has(c) ? 'bg-brand-wine scale-125' : 'bg-slate-200'
                      }`} />
                      <span className="truncate">{c}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </aside>

          {/* Right Panel: Main Grid Area */}
          <main className="flex-1 flex flex-col bg-slate-50/20 overflow-hidden">
            {/* Top Controls Area */}
            <div className="p-8 bg-white border-b border-slate-100 shrink-0 space-y-8">
              {/* Tab Selector - Unified Styling */}
              <div className="flex bg-slate-100/50 p-1.5 rounded-2xl w-full max-w-2xl mx-auto border border-slate-100">
                <button 
                  onClick={() => setActiveTab('PIEROTH')}
                  className={`flex-1 py-3.5 px-6 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2 ${
                    activeTab === 'PIEROTH' 
                      ? 'bg-white text-brand-wine shadow-luxury-soft ring-1 ring-slate-100' 
                      : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  <Wine className={`w-3.5 h-3.5 ${activeTab === 'PIEROTH' ? 'text-brand-wine' : 'text-slate-300'}`} />
                  ピーロート・ジャパン (PIEROTH)
                </button>
                <button 
                  onClick={() => setActiveTab('OTHER')}
                  className={`flex-1 py-3.5 px-6 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2 ${
                    activeTab === 'OTHER' 
                      ? 'bg-white text-brand-wine shadow-luxury-soft ring-1 ring-slate-100' 
                      : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  <Filter className={`w-3.5 h-3.5 ${activeTab === 'OTHER' ? 'text-brand-wine' : 'text-slate-300'}`} />
                  他社商品 (OTHER WINES)
                </button>
              </div>

              <div className="relative max-w-3xl mx-auto w-full group">
                <Search className="absolute left-7 top-1/2 -translate-y-1/2 w-6 h-6 text-slate-300 group-focus-within:text-brand-wine transition-colors" />
                <input 
                  placeholder="ワイン名、ブドウ品種、ID、産地で即時検索..."
                  className="w-full bg-slate-50 border border-slate-100 rounded-[2.5rem] pl-16 pr-10 py-5 text-sm outline-none focus:bg-white focus:border-brand-wine shadow-inner focus:shadow-luxury-soft transition-all"
                  value={masterSearchTerm}
                  onChange={e => setMasterSearchTerm(e.target.value)}
                />
              </div>
            </div>

            {/* List area */}
            <div className="flex-1 overflow-y-auto p-8 relative custom-scrollbar">
              <div id="catalog-scroll-top" className="absolute top-0" />
              
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
                <AnimatePresence mode="popLayout">
                  {currentItems.map(wine => {
                    const isAlreadySelected = selectedWines.some(sw => sw.id === wine.id);
                    const isChecked = selectedMasterIds.includes(wine.id);
                    return (
                      <motion.div 
                        layout
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.3 }}
                        key={wine.id} 
                        onClick={() => !isAlreadySelected && toggleMasterSelection(wine.id)}
                        className={`bg-white p-6 rounded-[2rem] border transition-all flex gap-5 group cursor-pointer relative overflow-hidden ${
                          isAlreadySelected 
                            ? 'border-slate-100 bg-slate-50/50' 
                            : isChecked 
                              ? 'border-brand-wine bg-brand-wine/[0.02] shadow-luxury-wine ring-1 ring-brand-wine/10' 
                              : 'border-slate-100 hover:border-brand-gold shadow-luxury-soft hover:shadow-luxury-gold/20'
                        }`}
                      >
                        {isAlreadySelected && (
                          <div className="absolute top-0 right-0 bg-slate-200 text-slate-500 text-[9px] font-black px-4 py-1.5 rounded-bl-[1.25rem] uppercase tracking-widest flex items-center gap-1.5">
                            <Info className="w-3 h-3" />
                            導入済み
                          </div>
                        )}
                        
                        <div className="flex flex-col items-center gap-4 shrink-0 py-2">
                          <div className={`w-7 h-7 rounded-xl border-2 flex items-center justify-center transition-all duration-300 ${
                            isChecked ? 'bg-brand-red border-brand-red text-white scale-110' : 'border-slate-200 bg-white'
                          }`}>
                            {isChecked && <CheckCircle2 className="w-5 h-5" />}
                          </div>
                          <div className="w-20 h-36 flex items-center justify-center p-3 bg-slate-50 rounded-2xl border border-slate-100 relative group-hover:bg-white transition-all">
                            <img 
                              src={`/api/proxy-image?url=${encodeURIComponent(wine.image_url)}`} 
                              alt="" 
                              loading="lazy"
                              className={`h-full object-contain transition-all duration-700 ${isAlreadySelected ? 'grayscale opacity-30 blur-[0.5px]' : 'group-hover:scale-110 drop-shadow-luxury animate-float-slow'}`} 
                            />
                            {isChecked && (
                              <div className="absolute inset-0 bg-brand-wine/10 rounded-2xl animate-in zoom-in-50 duration-300" />
                            )}
                          </div>
                        </div>

                        <div className="flex-1 min-w-0 flex flex-col pt-2">
                          <div className="flex items-center justify-between mb-2">
                            <div className="text-[10px] font-black text-brand-gold uppercase tracking-[0.2em]">{wine.country} • {wine.color}</div>
                          </div>
                          <h4 className={`font-bold text-slate-900 text-base mb-1.5 line-clamp-2 leading-tight tracking-tight ${isAlreadySelected ? 'text-slate-400' : ''}`}>{wine.name_jp}</h4>
                          <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-3 truncate italic">{wine.grape}</p>
                          
                          <div className="mt-auto space-y-3">
                            <div className="flex items-baseline gap-2">
                              <span className="text-lg font-black text-slate-900 tracking-tighter">¥{wine.price_bottle?.toLocaleString()}</span>
                              <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Bottle Reference</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="px-2 py-1 bg-slate-100 rounded-md text-[8px] font-mono text-slate-500 uppercase tracking-tighter">
                                {wine.id}
                              </div>
                              {wine.vintage && wine.vintage !== 'NV' && (
                                <div className="px-2 py-1 bg-brand-wine/5 rounded-md text-[8px] font-black text-brand-wine uppercase tracking-tighter">
                                  {wine.vintage}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>

              {/* No Results or Load More */}
              {filteredWines.length === 0 && (
                <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                  <Search className="w-12 h-12 mb-4 opacity-20" />
                  <p className="text-sm font-bold">該当するワインが見つかりませんでした</p>
                </div>
              )}

              {hasMoreWines && filteredWines.length > 0 && currentPage === totalPages && (
                <div className="py-12 flex justify-center">
                  <button 
                    onClick={onLoadMoreWines}
                    className="px-12 py-4 bg-white border-2 border-slate-100 rounded-full text-xs font-black uppercase tracking-widest text-slate-500 hover:border-brand-gold hover:text-brand-gold transition-all shadow-sm hover:shadow-md"
                  >
                    マスターの追加読み込み
                  </button>
                </div>
              )}
            </div>

            {/* Pagination Controls - Luxury Styling */}
            {totalPages > 1 && (
              <div className="p-8 md:px-12 border-t border-slate-100 bg-white flex flex-col md:flex-row items-center justify-between shrink-0 gap-6">
                <div className="flex flex-col items-center md:items-start">
                  <div className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em] mb-1">Catalog Navigation</div>
                  <div className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">
                    Page <span className="text-brand-wine">{currentPage}</span> of {totalPages} 
                    <span className="mx-3 text-slate-200">|</span> 
                    <span className="text-slate-400">{filteredWines.length} Results</span>
                  </div>
                </div>
                
                <div className="flex items-center gap-4">
                  <button 
                    disabled={currentPage === 1}
                    onClick={() => {
                      setCurrentPage(prev => prev - 1);
                      const el = document.getElementById('catalog-scroll-top');
                      el?.scrollIntoView({ behavior: 'smooth' });
                    }}
                    className="w-12 h-12 rounded-full border border-slate-100 flex items-center justify-center text-slate-400 disabled:opacity-20 hover:bg-brand-gold/5 hover:border-brand-gold hover:text-brand-gold transition-all active:scale-90 group"
                  >
                    <ChevronLeft className="w-6 h-6 group-hover:-translate-x-0.5 transition-transform" />
                  </button>
                  
                  <div className="flex items-center gap-2">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let pageNum = currentPage;
                      if (totalPages <= 5) pageNum = i + 1;
                      else if (currentPage <= 3) pageNum = i + 1;
                      else if (currentPage >= totalPages - 2) pageNum = totalPages - 4 + i;
                      else pageNum = currentPage - 2 + i;

                      return (
                        <button
                          key={pageNum}
                          onClick={() => {
                            setCurrentPage(pageNum);
                            const el = document.getElementById('catalog-scroll-top');
                            el?.scrollIntoView({ behavior: 'smooth' });
                          }}
                          className={`w-12 h-12 rounded-2xl text-xs font-black tracking-widest transition-all ${
                            currentPage === pageNum 
                              ? 'bg-brand-gold text-white shadow-luxury-gold ring-1 ring-brand-gold/50' 
                              : 'bg-slate-50 text-slate-400 hover:text-brand-gold hover:bg-brand-gold/5'
                          }`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                  </div>

                  <button 
                    disabled={currentPage === totalPages}
                    onClick={() => {
                      setCurrentPage(prev => prev + 1);
                      const el = document.getElementById('catalog-scroll-top');
                      el?.scrollIntoView({ behavior: 'smooth' });
                    }}
                    className="w-12 h-12 rounded-full border border-slate-100 flex items-center justify-center text-slate-400 disabled:opacity-20 hover:bg-brand-gold/5 hover:border-brand-gold hover:text-brand-gold transition-all active:scale-90 group"
                  >
                    <ChevronRight className="w-6 h-6 group-hover:translate-x-0.5 transition-transform" />
                  </button>
                </div>
              </div>
            )}
          </main>
        </div>

        {/* Footer / Action */}
        <div className="p-8 md:px-12 border-t border-slate-100 bg-white flex flex-col md:flex-row items-center justify-between gap-6 shrink-0 relative">
          {/* Progress bar for selection */}
          {selectedMasterIds.length > 0 && (
            <div className="absolute top-0 left-0 h-1 bg-brand-wine/20 w-full overflow-hidden">
              <motion.div 
                initial={{ x: '-100%' }}
                animate={{ x: '0%' }}
                className="h-full bg-brand-wine w-1/3"
                style={{ width: `${Math.min(100, (selectedMasterIds.length / 10) * 100)}%` }}
              />
            </div>
          )}
          
          <div className="flex flex-col items-center md:items-start">
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Selection Summary</div>
            <div className="text-sm font-bold text-slate-900">
              {selectedMasterIds.length > 0 ? (
                <span className="text-brand-wine flex items-center gap-2">
                  <span className="w-2 h-2 bg-brand-wine rounded-full animate-ping" />
                  {selectedMasterIds.length} 本のワインを選択済み
                </span>
              ) : (
                <span className="text-slate-300">追加するワインを選んでください</span>
              )}
            </div>
          </div>
          <div className="flex gap-4 w-full md:w-auto">
            <button 
              onClick={onClose}
              className="flex-1 md:flex-none px-10 py-4 bg-slate-100 text-slate-600 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] hover:bg-slate-200 transition-all active:scale-95"
            >
              閉じる
            </button>
            <button 
              onClick={handleBulkAddWines}
              disabled={selectedMasterIds.length === 0}
              className="flex-1 md:flex-none px-12 py-4 bg-brand-wine text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] hover:shadow-2xl hover:shadow-brand-wine/20 transition-all active:scale-95 disabled:opacity-30 disabled:grayscale disabled:scale-100 flex items-center justify-center gap-3 group"
            >
              <span>選んだワインを導入</span>
              <div className="bg-white/20 w-px h-4" />
              <CheckCircle2 className="w-4 h-4 group-hover:scale-125 transition-transform" />
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

