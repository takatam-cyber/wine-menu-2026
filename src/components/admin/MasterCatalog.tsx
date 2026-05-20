import React from 'react';
import { WineMaster } from '../../types';
import { Search, Database, Edit2, X, Save } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface MasterCatalogProps {
  wines: WineMaster[];
  masterSearchTerm: string;
  onSearchMaster: (term: string) => void;
  isEditingMaster: boolean;
  editingMasterWine: WineMaster | null;
  editMasterData: Partial<WineMaster>;
  setEditMasterData: React.Dispatch<React.SetStateAction<Partial<WineMaster>>>;
  onStartEditingMaster: (wine: WineMaster) => void;
  onUpdateMaster: () => void;
  onCancelEditMaster: () => void;
}

export const MasterCatalog: React.FC<MasterCatalogProps> = ({
  wines,
  masterSearchTerm,
  onSearchMaster,
  isEditingMaster,
  editingMasterWine,
  editMasterData,
  setEditMasterData,
  onStartEditingMaster,
  onUpdateMaster,
  onCancelEditMaster,
}) => {
  const [supplierFilter, setSupplierFilter] = React.useState<string>('all');
  const [countryFilter, setCountryFilter] = React.useState<string>('all');
  const [colorFilter, setColorFilter] = React.useState<string>('all');

  // Dynamic filter options
  const countries = React.useMemo(() => {
    const set = new Set(wines.map(w => w.country).filter(Boolean));
    return Array.from(set).sort();
  }, [wines]);

  // In-memory filtered list
  const filteredWines = React.useMemo(() => {
    return wines.filter(w => {
      // Keyword match
      const search = masterSearchTerm.toLowerCase();
      const matchesSearch = !search || 
        w.name_jp.toLowerCase().includes(search) ||
        w.name_en.toLowerCase().includes(search) ||
        (w.region || '').toLowerCase().includes(search) ||
        (w.grape || '').toLowerCase().includes(search) ||
        w.id.toLowerCase().includes(search);

      // Supplier match
      const s = (w.supplier || 'PIEROTH').toUpperCase();
      const matchesSupplier = supplierFilter === 'all' || s === supplierFilter;

      // Country match
      const matchesCountry = countryFilter === 'all' || w.country === countryFilter;

      // Color match
      const matchesColor = colorFilter === 'all' || (w.color || '').toLowerCase() === colorFilter.toLowerCase();

      return matchesSearch && matchesSupplier && matchesCountry && matchesColor;
    });
  }, [wines, masterSearchTerm, supplierFilter, countryFilter, colorFilter]);

  return (
    <div className="space-y-6">
      {/* Search and Filters Bar */}
      <div className="bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-luxury-soft space-y-6 backdrop-blur-xl bg-white/90 sticky top-4 z-10">
        <div className="flex flex-col lg:flex-row gap-4 items-center">
          <div className="relative flex-1 w-full group">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300 group-focus-within:text-brand-wine transition-colors" />
            <input 
              placeholder="銘柄名、産地、品種、コードで検索..."
              className="w-full bg-slate-50 border border-slate-100 rounded-2xl pl-14 pr-6 py-4 text-sm outline-none focus:bg-white focus:border-brand-wine focus:shadow-luxury-soft transition-all"
              value={masterSearchTerm}
              onChange={e => onSearchMaster(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
            <select 
              value={supplierFilter}
              onChange={e => setSupplierFilter(e.target.value)}
              className="flex-1 lg:flex-none h-14 bg-slate-50 border border-slate-100 rounded-2xl px-6 text-[10px] font-black uppercase tracking-widest text-slate-500 outline-none focus:border-brand-wine cursor-pointer hover:bg-slate-100 transition-all"
            >
              <option value="all">すべてのサプライヤー</option>
              <option value="PIEROTH">PIEROTH (自社)</option>
              <option value="OTHER">OTHER (他社)</option>
            </select>
            <select 
              value={countryFilter}
              onChange={e => setCountryFilter(e.target.value)}
              className="flex-1 lg:flex-none h-14 bg-slate-50 border border-slate-100 rounded-2xl px-6 text-[10px] font-black uppercase tracking-widest text-slate-500 outline-none focus:border-brand-wine cursor-pointer hover:bg-slate-100 transition-all"
            >
              <option value="all">すべての国</option>
              {countries.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <select 
              value={colorFilter}
              onChange={e => setColorFilter(e.target.value)}
              className="flex-1 lg:flex-none h-14 bg-slate-50 border border-slate-100 rounded-2xl px-6 text-[10px] font-black uppercase tracking-widest text-slate-500 outline-none focus:border-brand-wine cursor-pointer hover:bg-slate-100 transition-all"
            >
              <option value="all">すべての色</option>
              <option value="赤">赤</option>
              <option value="白">白</option>
              <option value="泡">スパークリング</option>
              <option value="ロゼ">ロゼ</option>
            </select>
          </div>
        </div>
        <div className="flex items-center justify-between px-2">
          <div className="flex items-center gap-4">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Inventory Status</span>
            <div className="h-1 w-32 bg-slate-100 rounded-full overflow-hidden">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${(filteredWines.length / wines.length) * 100}%` }}
                className="h-full bg-brand-wine shadow-[0_0_8px_rgba(126,29,29,0.3)]"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Database className="w-3 h-3 text-brand-gold-dark" />
            <span className="text-[10px] font-black text-brand-gold-dark uppercase tracking-widest">
              {filteredWines.length} / {wines.length} 銘柄を表示中
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredWines.map(wine => (
          <div key={wine.id} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex gap-4 group hover:border-brand-wine transition-all">
            <div className="w-16 h-24 bg-slate-50 rounded-xl flex items-center justify-center p-2 border border-slate-100 shrink-0">
              <img 
                src={wine.image_url} 
                alt="" 
                loading="lazy"
                className="h-full object-contain" 
              />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-bold text-brand-gold-dark uppercase tracking-widest">{wine.country} • {wine.vintage}</div>
              <h4 className="font-bold text-slate-900 text-sm mb-1 truncate">{wine.name_jp}</h4>
              <p className="text-xs text-slate-500 font-mono italic mb-2">{wine.grape}</p>
              <div className="flex items-center justify-between mt-auto">
                <span className="text-xs font-bold text-slate-700">Code: {wine.id}</span>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      onStartEditingMaster(wine);
                    }}
                    className="p-1.5 text-slate-400 hover:text-brand-wine hover:bg-slate-100 rounded-lg transition-all"
                    title="マスターを編集"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <span className="text-xs font-serif text-brand-wine">¥{wine.price_bottle?.toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>


    </div>
  );
};
