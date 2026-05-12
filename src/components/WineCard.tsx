import React from 'react';
import { WineMaster } from '../types';
import { motion } from 'motion/react';
import { ChefHat, Beef, Fish, MapPin, Tag, ChevronRight } from 'lucide-react';

interface WineCardProps {
  wine: WineMaster;
  onClick: (wine: WineMaster) => void;
  isFeatured?: boolean;
  highlighted?: boolean;
}

export const WineCard: React.FC<WineCardProps> = ({ wine, onClick, isFeatured, highlighted }) => {
  if (isFeatured) {
    return (
      <motion.div
        id={`wine-${wine.id}`}
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        whileTap={{ scale: 0.96 }}
        onClick={() => onClick(wine)}
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
          <div className="w-32 h-44 bg-white flex items-center justify-center p-4 rounded-[2rem] relative border border-brand-gold/20 shadow-xl group-hover:border-brand-gold/50 transition-all overflow-hidden shrink-0">
            <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/cream-paper.png')]" />
            <img
              src={`/api/proxy-image?url=${encodeURIComponent(wine.image_url)}`}
              alt=""
              crossOrigin="anonymous"
              referrerPolicy="no-referrer"
              className="w-full h-full object-contain group-hover:scale-110 transition-transform duration-1000 ease-out drop-shadow-2xl"
            />
            <div className="absolute top-2 left-2 flex flex-col gap-1">
              {wine.pairing?.includes('肉') && <div className="p-1.5 bg-brand-wine/10 rounded-full text-brand-wine"><Beef className="w-3.5 h-3.5" /></div>}
              {wine.pairing?.includes('魚') && <div className="p-1.5 bg-brand-wine/10 rounded-full text-brand-wine"><Fish className="w-3.5 h-3.5" /></div>}
            </div>
          </div>
          <div className="flex-1 flex flex-col justify-center gap-1.5">
            <div className="flex flex-wrap items-center gap-2 mb-1.5">
              <div className="px-3 py-1.5 bg-brand-wine text-brand-gold text-[13px] font-black rounded-full uppercase tracking-widest shrink-0 shadow-sm flex items-center gap-1.5">
                <ChefHat className="w-3.5 h-3.5" />
                Specialité
              </div>
              {wine.color && (
                <div className={`px-3 py-1.5 text-[13px] font-black rounded-full uppercase tracking-widest shrink-0 ${
                  wine.color === '赤' ? 'bg-[#641E16] text-white' : 
                  wine.color === '白' ? 'bg-[#D4AF37] text-white' : 
                  wine.color === '泡' || wine.color === 'スパークリング' ? 'bg-[#717D7E] text-white' : 'bg-slate-500 text-white'
                }`}>
                  {wine.color}
                </div>
              )}
            </div>
            {wine.menu_short && (
              <div className="mb-2">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-brand-gold/10 border-l-2 border-brand-gold">
                  <span className="text-base font-serif text-brand-gold italic tracking-wider leading-relaxed">
                    {wine.menu_short}
                  </span>
                </div>
              </div>
            )}
            <h3 className="serif text-2xl text-brand-wine leading-tight tracking-tight group-hover:text-brand-gold transition-colors">{wine.name_jp}</h3>
            
            <div className="flex flex-wrap gap-1.5 mt-2">
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-100 rounded-lg text-[13px] text-slate-500 font-bold uppercase tracking-wider">
                <MapPin className="w-3.5 h-3.5" />
                {wine.country}
              </div>
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-brand-wine/10 rounded-lg text-[13px] text-brand-wine font-black uppercase tracking-wider">
                品種: {wine.grape}
              </div>
            </div>

            <div className="flex items-center justify-between mt-4">
              <div className="flex flex-col">
                 <span className="serif text-2xl text-brand-wine font-medium tracking-tighter">¥{wine.price_bottle?.toLocaleString()}</span>
              </div>
              <div className="w-12 h-12 rounded-full border border-brand-gold/30 flex items-center justify-center text-brand-gold group-hover:bg-brand-gold group-hover:text-white transition-all shadow-sm">
                <ChevronRight className="w-7 h-7" />
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      id={`wine-${wine.id}`}
      whileTap={{ scale: 0.98 }}
      animate={highlighted ? { 
        borderColor: ["rgba(212,175,55,0.1)", "rgba(212,175,55,1)", "rgba(212,175,55,0.1)"],
        backgroundColor: ["rgba(255,255,255,0)", "rgba(212,175,55,0.4)", "rgba(255,255,255,0)"],
        boxShadow: [
           "0 0 0 0px rgba(212,175,55,0)", 
           "0 0 80px 20px rgba(212,175,55,1)", 
           "0 0 0 0px rgba(212,175,55,0)"
        ],
        scale: [1, 1.05, 1]
      } : {}}
      transition={highlighted ? { duration: 0.8 } : {}}
      onClick={() => onClick(wine)}
      className="group cursor-pointer flex gap-5 border border-transparent border-b-brand-wine/5 p-5 hover:bg-brand-gold/[0.02] transition-all duration-300 relative overflow-hidden"
    >
      <div className="w-24 h-32 bg-white/50 backdrop-blur-sm flex items-center justify-center p-3 rounded-2xl relative border border-brand-gold/10 shadow-sm group-hover:border-brand-gold/30 transition-all shrink-0 overflow-hidden">
        <img
          src={`/api/proxy-image?url=${encodeURIComponent(wine.image_url)}`}
          alt=""
          crossOrigin="anonymous"
          referrerPolicy="no-referrer"
          className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-700 drop-shadow-lg"
        />
      </div>
      <div className="flex-1 flex flex-col justify-center gap-1">
        <div className="flex flex-wrap items-center gap-2 mb-1.5">
          {wine.color && (
              <div className={`px-2.5 py-1 text-[11px] font-black rounded-full uppercase tracking-widest shrink-0 ${
                wine.color === '赤' ? 'bg-[#641E16] text-white' : 
                wine.color === '白' ? 'bg-[#D4AF37] text-white' : 
                wine.color === '泡' || wine.color === 'スパークリング' ? 'bg-[#717D7E] text-white' : 'bg-slate-500 text-white'
              }`}>
                {wine.color}
              </div>
            )}
          <div className="text-[13px] uppercase font-bold text-brand-gold/60 tracking-[0.2em]">
            {wine.country}
          </div>
          <div className="flex items-center gap-1.5 ml-auto opacity-50">
              {wine.pairing?.includes('肉') && <Beef className="w-4 h-4 text-brand-wine" />}
              {wine.pairing?.includes('魚') && <Fish className="w-4 h-4 text-brand-wine" />}
          </div>
        </div>
        {wine.menu_short && (
          <div className="mb-1.5">
            <span className="text-[14px] font-serif text-brand-gold italic border-l-2 border-brand-gold pl-2 leading-relaxed">
              {wine.menu_short}
            </span>
          </div>
        )}
        <h3 className="serif text-xl md:text-2xl text-brand-wine leading-tight group-hover:text-brand-gold transition-colors">{wine.name_jp}</h3>
        
        <div className="flex flex-wrap gap-1.5 mt-2">
          <div className="flex items-center gap-1.5 text-[13px] text-slate-400 font-bold uppercase tracking-widest">
            <MapPin className="w-3.5 h-3.5" />
            {wine.country} / <span className="text-brand-wine font-black">品種: {wine.grape}</span>
          </div>
        </div>

        <div className="flex items-center justify-between mt-3">
           <span className="serif text-2xl text-brand-wine font-medium">¥{wine.price_bottle?.toLocaleString()}</span>
           <ChevronRight className="w-6 h-6 text-brand-gold transition-all" />
        </div>
      </div>
    </motion.div>
  );
};
