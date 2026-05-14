import React from 'react';
import { WineMaster } from '../../types';
import { Search, Database, Edit2, X, Save } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { SecureImage } from '../SecureImage';

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
  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input 
            placeholder="ワイン名でマスターを検索 (前方一致)..."
            className="w-full bg-slate-50 border border-slate-200 rounded-full pl-12 pr-6 py-3 text-sm outline-none focus:border-brand-wine transition-all"
            value={masterSearchTerm}
            onChange={e => onSearchMaster(e.target.value)}
          />
        </div>
        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
          全 {wines.length} 銘柄登録済み
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {wines.map(wine => (
          <div key={wine.id} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex gap-4 group hover:border-brand-wine transition-all">
            <div className="w-16 h-24 bg-slate-50 rounded-xl flex items-center justify-center p-2 border border-slate-100 shrink-0">
              <SecureImage 
                url={wine.image_url} 
                alt="" 
                className="h-full object-contain" 
              />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[9px] font-bold text-brand-gold uppercase tracking-widest">{wine.country} • {wine.vintage}</div>
              <h4 className="font-bold text-slate-900 text-sm mb-1 truncate">{wine.name_jp}</h4>
              <p className="text-[10px] text-slate-500 font-mono italic mb-2">{wine.grape}</p>
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
                  <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold mt-1">Editing Master Registry Item: {editingMasterWine.id}</p>
                </div>
                <button onClick={onCancelEditMaster} className="p-2 text-slate-300 hover:text-slate-600 transition-colors">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="p-8 space-y-6 overflow-y-auto">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="md:col-span-2">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-2">ワイン名称 (日本語)</label>
                    <input 
                      type="text"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 outline-none focus:border-brand-wine"
                      value={editMasterData.name_jp || ''}
                      onChange={e => setEditMasterData({...editMasterData, name_jp: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-2">参考価格 (ボトル)</label>
                    <input 
                      type="number"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 outline-none focus:border-brand-wine"
                      value={editMasterData.price_bottle || 0}
                      onChange={e => setEditMasterData({...editMasterData, price_bottle: parseInt(e.target.value) || 0})}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-2">主要品種</label>
                    <input 
                      type="text"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 outline-none focus:border-brand-wine"
                      value={editMasterData.grape || ''}
                      onChange={e => setEditMasterData({...editMasterData, grape: e.target.value})}
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-2">AIソムリエ解説文</label>
                  <textarea 
                    rows={4}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 outline-none focus:border-brand-wine resize-none"
                    value={editMasterData.ai_explanation || ''}
                    onChange={e => setEditMasterData({...editMasterData, ai_explanation: e.target.value})}
                  />
                  <p className="text-[9px] text-slate-400 mt-2 font-medium italic">※この説明は全店舗のメニューに共通して反映されます。</p>
                </div>
              </div>

              <div className="p-8 border-t border-slate-100 flex justify-end gap-3 bg-slate-50/50">
                <button 
                  onClick={onCancelEditMaster}
                  className="px-6 py-3 text-[11px] font-bold uppercase tracking-widest text-slate-400 hover:text-slate-600 transition-all"
                >
                  キャンセル
                </button>
                <button 
                  onClick={onUpdateMaster}
                  className="px-10 py-3 bg-brand-wine text-white rounded-full text-[11px] font-bold uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-lg"
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
