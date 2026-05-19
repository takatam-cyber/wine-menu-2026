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

      <AnimatePresence>
        {isEditingMaster && editingMasterWine && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-white rounded-[2rem] shadow-2xl w-full max-w-xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-8 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h3 className="serif text-2xl text-slate-900">マスター銘柄編集</h3>
                  <p className="text-xs text-slate-400 uppercase tracking-widest font-bold mt-1">Editing Master Registry Item: {editingMasterWine.id}</p>
                </div>
                <button onClick={onCancelEditMaster} className="p-2 text-slate-300 hover:text-slate-600 transition-colors">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="p-8 space-y-6 overflow-y-auto">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="md:col-span-1">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-2">ワイン名称 (日本語)</label>
                    <input 
                      type="text"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 outline-none focus:border-brand-wine"
                      value={editMasterData.name_jp || ''}
                      onChange={e => setEditMasterData({...editMasterData, name_jp: e.target.value})}
                    />
                  </div>
                  <div className="md:col-span-1">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-2">Wine Name (English)</label>
                    <input 
                      type="text"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 outline-none focus:border-brand-wine"
                      value={editMasterData.name_en || ''}
                      onChange={e => setEditMasterData({...editMasterData, name_en: e.target.value})}
                    />
                  </div>
                  <div className="md:col-span-1">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-2">国 (日本語)</label>
                    <input 
                      type="text"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 outline-none focus:border-brand-wine"
                      value={editMasterData.country || ''}
                      onChange={e => setEditMasterData({...editMasterData, country: e.target.value})}
                    />
                  </div>
                  <div className="md:col-span-1">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-2">Country (English)</label>
                    <input 
                      type="text"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 outline-none focus:border-brand-wine"
                      value={editMasterData.country_en || ''}
                      onChange={e => setEditMasterData({...editMasterData, country_en: e.target.value})}
                    />
                  </div>
                  <div className="md:col-span-1">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-2">主要品種 (日本語)</label>
                    <input 
                      type="text"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 outline-none focus:border-brand-wine"
                      value={editMasterData.grape || ''}
                      onChange={e => setEditMasterData({...editMasterData, grape: e.target.value})}
                    />
                  </div>
                  <div className="md:col-span-1">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-2">Grape (English)</label>
                    <input 
                      type="text"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 outline-none focus:border-brand-wine"
                      value={editMasterData.grape_en || ''}
                      onChange={e => setEditMasterData({...editMasterData, grape_en: e.target.value})}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-2">参考価格 (ボトル)</label>
                    <input 
                      type="number"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 outline-none focus:border-brand-wine"
                      value={editMasterData.price_bottle || 0}
                      onChange={e => setEditMasterData({...editMasterData, price_bottle: parseInt(e.target.value) || 0})}
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-2">AIソムリエ解説文 (日本語)</label>
                  <textarea 
                    rows={3}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 outline-none focus:border-brand-wine resize-none mb-4"
                    value={editMasterData.ai_explanation || ''}
                    onChange={e => setEditMasterData({...editMasterData, ai_explanation: e.target.value})}
                  />
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-2">AI Sommelier Explanation (English)</label>
                  <textarea 
                    rows={3}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 outline-none focus:border-brand-wine resize-none"
                    value={editMasterData.ai_explanation_en || ''}
                    onChange={e => setEditMasterData({...editMasterData, ai_explanation_en: e.target.value})}
                  />
                  <p className="text-xs text-slate-400 mt-2 font-medium italic">※この説明は全店舗のメニューに共通して反映されます。</p>
                </div>
              </div>

              <div className="p-8 border-t border-slate-100 flex justify-end gap-3 bg-slate-50/50">
                <button 
                  onClick={onCancelEditMaster}
                  className="px-6 py-3 text-xs font-bold uppercase tracking-widest text-slate-400 hover:text-slate-600 transition-all"
                >
                  キャンセル
                </button>
                <button 
                  onClick={onUpdateMaster}
                  className="px-10 py-3 bg-brand-wine text-white rounded-full text-xs font-bold uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-lg"
                >
                  マスターを更新
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
