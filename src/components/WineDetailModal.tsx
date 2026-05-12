import React from 'react';
import { WineMaster } from '../types';
import { motion } from 'motion/react';
import { WineProfile } from './WineProfile';
import { Award, Info, Sparkles, Utensils, X } from 'lucide-react';

interface WineDetailModalProps {
  wine: WineMaster;
  onClose: () => void;
}

export const WineDetailModal: React.FC<WineDetailModalProps> = ({ wine, onClose }) => {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] bg-black/98 backdrop-blur-3xl overflow-hidden flex flex-col h-[100dvh]"
    >
      {/* Header */}
      <div className="sticky top-0 z-[110] bg-black/95 backdrop-blur-md p-8 pb-4 flex justify-between items-center border-b border-white/10 h-24">
        <span className="text-[14px] text-brand-gold font-bold uppercase tracking-[0.3em] opacity-80">Vintage {wine.vintage || 'NV'}</span>
        <button 
          onClick={onClose}
          className="w-12 h-12 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-brand-gold text-2xl hover:bg-white/20 hover:scale-105 active:scale-95 transition-all font-light shadow-lg"
        >
          <X className="w-6 h-6" />
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto px-8 py-10 space-y-12 pb-32">
        <div className="text-center">
          <div className="w-full aspect-[4/5] md:aspect-square bg-gradient-to-b from-white/5 to-transparent border border-brand-gold/20 rounded-3xl mb-10 flex items-center justify-center p-10 relative shadow-inner group overflow-hidden">
            <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_center,rgba(212,175,55,0.2),transparent_70%)]" />
            <img
              src={`/api/proxy-image?url=${encodeURIComponent(wine.image_url)}`}
              alt={wine.name_jp}
              className="h-full w-full object-contain drop-shadow-[0_20px_50px_rgba(0,0,0,0.5)] group-hover:scale-105 transition-transform duration-1000"
            />
          </div>
          <h2 className="serif text-4xl md:text-6xl text-brand-gold mb-4 tracking-tight leading-tight">{wine.name_jp}</h2>
          <p className="text-[15px] md:text-lg text-gray-400 tracking-[0.4em] uppercase font-bold mb-4">{wine.name_en}</p>
          <div className="inline-block px-4 py-2 border border-brand-gold/30 rounded-xl bg-brand-gold/5">
            <p className="text-[14px] text-brand-gold font-bold uppercase tracking-widest ">主要品種: {wine.grape}</p>
          </div>
        </div>

        {/* Profile */}
        <div className="space-y-8 pt-10 border-t border-white/10">
          <div className="flex items-center gap-3 text-brand-gold">
            <Award className="w-7 h-7 opacity-80" />
            <h4 className="text-[17px] font-bold uppercase tracking-[0.35em]">味わいのプロファイル</h4>
          </div>
          <div className="bg-white/[0.03] p-8 rounded-[2.5rem] border border-white/5 shadow-inner">
            <WineProfile wine={wine} />
          </div>
        </div>

        {/* Sommelier Note */}
        <div className="space-y-8 pt-10 border-t border-white/10">
          <div className="flex items-center gap-3 text-brand-gold">
            <Info className="w-7 h-7 opacity-80" />
            <h4 className="text-[17px] font-bold uppercase tracking-[0.35em]">ソムリエによる解説</h4>
          </div>
          <div className="relative">
            <div className="absolute top-6 left-6 text-brand-gold/20"><Sparkles className="w-10 h-10" /></div>
            <div className="text-[16px] md:text-xl leading-relaxed text-gray-200 italic font-serif bg-brand-gold/[0.04] p-10 pt-16 rounded-[2.5rem] border border-brand-gold/15 shadow-inner relative">
              {wine.ai_explanation || "世界が認める、品格溢れる一杯。選び抜かれたブドウだけが持つエレガンスが、特別なひとときを彩ります。"}
              <div className="mt-8 pt-8 border-t border-brand-gold/10">
                <p className="text-[13px] text-brand-gold/70 font-black italic tracking-[0.2em] flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-brand-gold animate-pulse" />
                  ソムリエのお墨付き：このお料理との相性は120%です
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Pairing */}
        <div className="space-y-8 pt-10 border-t border-white/10">
          <div className="flex items-center gap-3 text-brand-gold">
            <Utensils className="w-7 h-7 opacity-80" />
            <h4 className="text-[17px] font-bold uppercase tracking-[0.35em]">最高のマリアージュ</h4>
          </div>
          <div className="flex flex-wrap gap-3">
              {wine.pairing?.split('、').map(p => (
              <span key={p} className="bg-brand-gold/10 border border-brand-gold/30 px-6 py-4 rounded-2xl text-[15px] text-brand-gold font-bold tracking-wider hover:bg-brand-gold/20 transition-all cursor-default">
                {p}
              </span>
              ))}
          </div>
        </div>
      </div>

      {/* Footer Price Sticky */}
      <div className="sticky bottom-0 z-[110] p-8 md:p-10 pt-6 pb-[env(safe-area-inset-bottom,32px)] bg-black/95 backdrop-blur-3xl border-t border-brand-gold/25 flex flex-col gap-8 safe-bottom shadow-[0_-20px_100px_rgba(0,0,0,0.8)]">
         <div className="flex justify-between items-center px-2">
           <div className="flex flex-col">
             <span className="text-[12px] text-gray-500 uppercase font-black tracking-[0.3em] mb-2">Bottle</span>
             <span className="serif text-3xl md:text-4xl text-brand-gold tracking-tighter">¥{wine.price_bottle?.toLocaleString()}</span>
           </div>
           <div className="h-12 w-px bg-brand-gold/25" />
           <div className="flex flex-col items-end">
             <span className="text-[12px] text-gray-500 uppercase font-black tracking-[0.3em] mb-2">Glass</span>
             <span className="serif text-3xl md:text-4xl text-brand-gold tracking-tighter">¥{wine.price_glass?.toLocaleString()}</span>
           </div>
         </div>
         <div className="text-center opacity-40">
           <p className="text-[11px] text-brand-gold font-bold uppercase tracking-[0.4em]">飲酒は20歳になってから。正しく適切に楽しむのがプロの流儀。</p>
         </div>
      </div>
    </motion.div>
  );
};
