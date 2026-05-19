import React, { useState, useMemo, useEffect } from 'react';
import { WineMaster, Store } from '../../types';
import { Search, X, CheckCircle2, ChevronLeft, ChevronRight, Filter } from 'lucide-react';
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
  const [activeTab, setActiveTab] = useState<'pieroth' | 'others'>('pieroth');
  
  // Facet States
  const [selectedSuppliers, setSelectedSuppliers] = useState<Set<string>>(new Set());
  const [selectedCountries, setSelectedCountries] = useState<Set<string>>(new Set());
  const [selectedColors, setSelectedColors] = useState<Set<string>>(new Set());
  const [priceRange, setPriceRange] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 24; // Increased for larger grid

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
      const isPieroth = (w.supplier || 'Pieroth').toUpperCase() === 'PIEROTH';
      return activeTab === 'pieroth' ? isPieroth : !isPieroth;
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

  // Combined Filtered List
  const filteredWines = useMemo(() => {
    let result = tabWines.filter(w => {
      // Keyword search
      const matchesSearch = !masterSearchTerm || 
        w.name_jp.toLowerCase().includes(masterSearchTerm.toLowerCase()) ||
        w.name_en.toLowerCase().includes(masterSearchTerm.toLowerCase()) ||
        w.country.toLowerCase().includes(masterSearchTerm.toLowerCase()) ||
        w.grape.toLowerCase().includes(masterSearchTerm.toLowerCase()) ||
        w.id.toLowerCase().includes(masterSearchTerm.toLowerCase());
      
      if (!matchesSearch) return false;

      // Supplier filter (only relevant for 'others' tab or if someone selected)
      if (selectedSuppliers.size > 0 && !selectedSuppliers.has(w.supplier || 'Pieroth')) return false;

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

    // Sorting: Put already selected ones at the bottom, then sort by name
    return result.sort((a, b) => {
      const aSelected = selectedWines.some(sw => sw.id === a.id);
      const bSelected = selectedWines.some(sw => sw.id === b.id);
      if (aSelected && !bSelected) return 1;
      if (!aSelected && bSelected) return -1;
      return a.name_jp.localeCompare(b.name_jp);
    });
  }, [tabWines, masterSearchTerm, selectedSuppliers, selectedCountries, selectedColors, priceRange, selectedWines]);

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
        <div className="p-6 md:p-10 border-b border-slate-100 flex items-center justify-between bg-white/80 backdrop-blur shrink-0">
          <div>
            <h2 className="serif text-2xl md:text-3xl text-slate-900">ワインカタログから選択</h2>
            <div className="flex items-center gap-2 mt-1">
              <span className="w-2 h-2 bg-brand-gold rounded-full animate-pulse" />
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{selectedStore?.name} のラインナップ編集</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-900 transition-all hover:bg-slate-100"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Left Panel: Faceted Sidebar */}
          <aside className="w-64 border-r border-slate-100 bg-slate-50/50 p-6 overflow-y-auto hidden lg:block">
            <div className="flex items-center gap-2 text-brand-wine mb-6">
              <Filter className="w-4 h-4" />
              <span className="text-xs font-black uppercase tracking-widest">フィルタリング</span>
            </div>

            <div className="space-y-8">
              {/* Supplier (Only for non-Pieroth items) */}
              {activeTab === 'others' && facets.suppliers.length > 0 && (
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-3">サプライヤー</label>
                  <div className="space-y-2">
                    {facets.suppliers.map(s => (
                      <button 
                        key={s}
                        onClick={() => toggleFacet(selectedSuppliers, s, setSelectedSuppliers)}
                        className={`block w-full text-left px-3 py-1.5 rounded-lg text-xs transition-all ${
                          selectedSuppliers.has(s) 
                            ? 'bg-brand-gold text-white font-bold shadow-sm' 
                            : 'text-slate-600 hover:bg-slate-200/50'
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Color */}
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-3">ワインの色</label>
                <div className="flex flex-wrap gap-2">
                  {['赤', '白', '泡', 'ロゼ'].map(c => (
                    <button 
                      key={c}
                      onClick={() => toggleFacet(selectedColors, c, setSelectedColors)}
                      className={`px-3 py-1.5 rounded-full text-xs transition-all border ${
                        selectedColors.has(c) 
                          ? 'bg-brand-wine border-brand-wine text-white font-bold' 
                          : 'bg-white border-slate-200 text-slate-600'
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>

              {/* Price Range */}
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-3">価格帯</label>
                <div className="space-y-2">
                  {[
                    { id: 'low', label: '〜 ¥5,000' },
                    { id: 'mid', label: '¥5,000 〜 ¥10,000' },
                    { id: 'high', label: '¥10,000 〜' },
                  ].map(r => (
                    <button 
                      key={r.id}
                      onClick={() => setPriceRange(priceRange === r.id ? null : r.id)}
                      className={`block w-full text-left px-3 py-1.5 rounded-lg text-xs transition-all ${
                        priceRange === r.id 
                          ? 'bg-brand-gold text-white font-bold shadow-sm' 
                          : 'text-slate-600 hover:bg-slate-200/50'
                      }`}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Country */}
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-3">生産国</label>
                <div className="space-y-2">
                  {facets.countries.map(c => (
                    <button 
                      key={c}
                      onClick={() => toggleFacet(selectedCountries, c, setSelectedCountries)}
                      className={`block w-full text-left px-3 py-1.5 rounded-lg text-xs transition-all ${
                        selectedCountries.has(c) 
                          ? 'bg-brand-gold text-white font-bold shadow-sm' 
                          : 'text-slate-600 hover:bg-slate-200/50'
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </aside>

          {/* Right Panel: Content */}
          <main className="flex-1 flex flex-col bg-slate-50/30 overflow-hidden">
            {/* Search & Tabs */}
            <div className="p-6 md:p-8 bg-white/50 backdrop-blur-sm border-b border-slate-100 shrink-0 space-y-6">
              {/* Tab Selector */}
              <div className="flex bg-slate-100 p-1 rounded-2xl w-full max-w-lg mx-auto">
                <button 
                  onClick={() => setActiveTab('pieroth')}
                  className={`flex-1 py-3 px-4 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all ${
                    activeTab === 'pieroth' 
                      ? 'bg-white text-brand-wine shadow-lg' 
                      : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  Pieroth Japan
                </button>
                <button 
                  onClick={() => setActiveTab('others')}
                  className={`flex-1 py-3 px-4 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all ${
                    activeTab === 'others' 
                      ? 'bg-white text-brand-wine shadow-lg' 
                      : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  Other Suppliers
                </button>
              </div>

              <div className="relative max-w-2xl mx-auto w-full">
                <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" />
                <input 
                  placeholder="ワイン名、ブドウ品種、ID、またはキーワードを自由に入力..."
                  className="w-full bg-white border border-slate-200 rounded-[2rem] pl-14 pr-8 py-4 text-sm outline-none focus:border-brand-wine shadow-sm transition-all focus:ring-4 focus:ring-brand-wine/5"
                  value={masterSearchTerm}
                  onChange={e => setMasterSearchTerm(e.target.value)}
                />
              </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-4 md:p-8">
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                <AnimatePresence mode="popLayout">
                  {currentItems.map(wine => {
                    const isAlreadySelected = selectedWines.some(sw => sw.id === wine.id);
                    const isChecked = selectedMasterIds.includes(wine.id);
                    return (
                      <motion.div 
                        layout
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        key={wine.id} 
                        onClick={() => !isAlreadySelected && toggleMasterSelection(wine.id)}
                        className={`bg-white p-5 rounded-3xl border transition-all flex gap-4 group cursor-pointer relative overflow-hidden ${
                          isAlreadySelected 
                            ? 'border-slate-100 bg-slate-50/50' 
                            : isChecked 
                              ? 'border-brand-wine bg-brand-wine/[0.02] shadow-xl ring-1 ring-brand-wine/20' 
                              : 'border-slate-200 hover:border-brand-gold shadow-sm hover:shadow-lg'
                        }`}
                      >
                        {isAlreadySelected && (
                          <div className="absolute top-0 right-0 bg-slate-200 text-slate-500 text-[8px] font-black px-3 py-1 rounded-bl-xl uppercase tracking-widest">
                            追加済み
                          </div>
                        )}
                        <div className="flex flex-col items-center gap-3 shrink-0 py-1">
                          <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${
                            isChecked ? 'bg-brand-wine border-brand-wine text-white' : 'border-slate-200 bg-white'
                          }`}>
                            {isChecked && <CheckCircle2 className="w-4 h-4" />}
                          </div>
                          <div className="w-16 h-28 flex items-center justify-center p-2">
                            <img 
                              src={`/api/proxy-image?url=${encodeURIComponent(wine.image_url)}`} 
                              alt="" 
                              loading="lazy"
                              className={`h-full object-contain transition-all duration-700 ${isAlreadySelected ? 'grayscale opacity-30' : 'group-hover:scale-110 drop-shadow-lg'}`} 
                            />
                          </div>
                        </div>
                        <div className="flex-1 min-w-0 flex flex-col pt-1">
                          <div className="text-[10px] font-bold text-brand-gold uppercase tracking-[0.15em] mb-1">{wine.country} • {wine.color}</div>
                          <h4 className={`font-bold text-slate-900 text-sm mb-1 line-clamp-2 leading-tight ${isAlreadySelected ? 'text-slate-400' : ''}`}>{wine.name_jp}</h4>
                          <p className="text-[10px] text-slate-400 font-medium italic mb-2 truncate uppercase tracking-wider">{wine.grape}</p>
                          <div className="mt-auto pt-2 flex items-baseline gap-2">
                            <span className="text-sm font-black text-slate-900">¥{wine.price_bottle?.toLocaleString()}</span>
                            <span className="text-[9px] font-bold text-slate-300 uppercase">Bottle</span>
                          </div>
                          <div className="mt-1 text-[9px] text-slate-300 font-mono">ID: {wine.id}</div>
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

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="p-6 md:px-10 border-t border-slate-100 bg-white/80 backdrop-blur flex items-center justify-between shrink-0">
                <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                  Showing {(currentPage - 1) * itemsPerPage + 1} - {Math.min(currentPage * itemsPerPage, filteredWines.length)} of {filteredWines.length}
                </div>
                <div className="flex items-center gap-3">
                  <button 
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(prev => prev - 1)}
                    className="w-10 h-10 rounded-full border border-slate-200 flex items-center justify-center text-slate-600 disabled:opacity-20 hover:bg-slate-50 hover:border-brand-wine transition-all group"
                  >
                    <ChevronLeft className="w-5 h-5 group-hover:-translate-x-0.5 transition-transform" />
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
                          onClick={() => setCurrentPage(pageNum)}
                          className={`w-10 h-10 rounded-full text-xs font-black transition-all ${
                            currentPage === pageNum 
                              ? 'bg-brand-wine text-white shadow-lg ring-4 ring-brand-wine/10' 
                              : 'text-slate-400 hover:text-slate-900 hover:bg-slate-100'
                          }`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                  </div>

                  <button 
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage(prev => prev + 1)}
                    className="w-10 h-10 rounded-full border border-slate-200 flex items-center justify-center text-slate-600 disabled:opacity-20 hover:bg-slate-50 hover:border-brand-wine transition-all group"
                  >
                    <ChevronRight className="w-5 h-5 group-hover:translate-x-0.5 transition-transform" />
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

