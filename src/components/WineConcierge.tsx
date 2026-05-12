import React, { useState } from 'react';
import { WineMaster } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { Wine, AlertCircle } from 'lucide-react';

interface WineConciergeProps {
  inventory: WineMaster[];
  onFilterChange: (filters: { color: string | null; style: string | null; budget: number | null }) => void;
  onClear: () => void;
}

export const WineConcierge: React.FC<WineConciergeProps> = ({ inventory, onFilterChange, onClear }) => {
  const [step1Color, setStep1Color] = useState<string | null>(null);
  const [step2Style, setStep2Style] = useState<string | null>(null);
  const [step3Budget, setStep3Budget] = useState<number | null>(null);

  const budgets = [
    { id: 5000, label: '〜5,000円', max: 5000 },
    { id: 10000, label: '〜10,000円', max: 10000 },
    { id: 20000, label: '〜20,000円', max: 20000 },
    { id: 999999, label: '20,000円以上', min: 20000 }
  ];

  const getDynamicStyles = (color: string) => {
    if (color === '赤') {
      return ['フルボディ', 'ミディアムボディ', 'ライトボディ'];
    }
    const styles = Array.from(new Set(inventory
      .filter(w => w.color === color && w.type)
      .map(w => w.type as string)
    )).sort();
    
    return styles.length > 0 ? styles : ['辛口', '甘口'];
  };

  const handleColorSelect = (color: string) => {
    const newVal = step1Color === color ? null : color;
    setStep1Color(newVal);
    setStep2Style(null);
    setStep3Budget(null);
    onFilterChange({ color: newVal, style: null, budget: null });
  };

  const handleStyleSelect = (style: string) => {
    const newVal = step2Style === style ? null : style;
    setStep2Style(newVal);
    setStep3Budget(null);
    onFilterChange({ color: step1Color, style: newVal, budget: null });
  };

  const handleBudgetSelect = (budgetId: number) => {
    const newVal = step3Budget === budgetId ? null : budgetId;
    setStep3Budget(newVal);
    onFilterChange({ color: step1Color, style: step2Style, budget: newVal });
  };

  const handleClear = () => {
    setStep1Color(null);
    setStep2Style(null);
    setStep3Budget(null);
    onClear();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-5 w-1.5 bg-brand-gold rounded-full" />
          <h4 className="text-[17px] font-bold text-brand-wine uppercase tracking-[0.2em]">ワイン・コンシェルジュ</h4>
        </div>
        <div className="flex gap-2">
          {[1, 2, 3].map(step => {
            let isComplete = false;
            if (step === 1) isComplete = !!step1Color;
            if (step === 2) isComplete = !!step2Style;
            if (step === 3) isComplete = !!step3Budget;
            
            return (
              <div 
                key={step} 
                className={`h-2 w-8 rounded-full transition-all duration-500 ${
                  isComplete ? 'bg-brand-gold shadow-[0_0_10px_rgba(212,175,55,0.5)]' : 'bg-brand-gold/20'
                }`}
              />
            );
          })}
        </div>
      </div>
      
      <div className="space-y-8 bg-brand-wine/[0.04] p-8 rounded-[3rem] border border-brand-gold/15 relative overflow-hidden group shadow-inner">
        <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity pointer-events-none">
           <Wine className="w-32 h-32" strokeWidth={0.5} />
        </div>

        {/* Step 1: Color */}
        <div className="space-y-4">
          <p className="text-[13px] text-brand-gold font-black uppercase tracking-[0.35em] flex items-center gap-2.5">
            <span className="w-6 h-6 rounded-full bg-brand-wine text-brand-gold flex items-center justify-center text-[12px] font-black border border-brand-gold/30">1</span>
            ワインの色を選ぶ
          </p>
          <div className="flex flex-wrap gap-2.5">
            {['赤', '白', '泡'].map(color => (
              <button
                key={color}
                onClick={() => handleColorSelect(color)}
                className={`px-10 py-4 rounded-full text-[15px] font-bold transition-all border-2 ${
                  step1Color === color 
                    ? 'bg-brand-wine text-brand-gold border-brand-gold shadow-luxury scale-105' 
                    : 'bg-white border-brand-gold/10 text-brand-wine/60 hover:border-brand-gold/30'
                }`}
              >
                {color === '泡' ? 'スパークリング' : color}
              </button>
            ))}
          </div>
        </div>

        {/* Step 2: Style */}
        <AnimatePresence mode="wait">
          {step1Color && (
            <motion.div 
              key="step2"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-4 pt-6 border-t border-brand-gold/15 overflow-hidden"
            >
              <p className="text-[13px] text-brand-gold font-black uppercase tracking-[0.35em] flex items-center gap-2.5">
                <span className="w-6 h-6 rounded-full bg-brand-wine text-brand-gold flex items-center justify-center text-[12px] font-black border border-brand-gold/30">2</span>
                スタイルを選ぶ
              </p>
              <div className="flex flex-wrap gap-2.5">
                {getDynamicStyles(step1Color).map(style => (
                  <button
                    key={style}
                    onClick={() => handleStyleSelect(style)}
                    className={`px-7 py-4 rounded-2xl text-[15px] font-bold transition-all border-2 ${
                      step2Style === style 
                        ? 'bg-brand-gold text-brand-wine border-brand-gold shadow-md scale-105' 
                        : 'bg-white/50 border-brand-gold/10 text-brand-wine/60 hover:border-brand-gold/30'
                    }`}
                  >
                    {style}
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Step 3: Budget */}
        <AnimatePresence mode="wait">
          {step2Style && (
            <motion.div 
              key="step3"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-4 pt-6 border-t border-brand-gold/15 overflow-hidden"
            >
              <p className="text-[13px] text-brand-gold font-black uppercase tracking-[0.35em] flex items-center gap-2.5">
                <span className="w-6 h-6 rounded-full bg-brand-wine text-brand-gold flex items-center justify-center text-[12px] font-black border border-brand-gold/30">3</span>
                予算から絞り込む
              </p>
              <div className="grid grid-cols-2 gap-3">
                {budgets.map(budget => (
                  <button
                    key={budget.id}
                    onClick={() => handleBudgetSelect(budget.id)}
                    className={`px-5 py-4 rounded-2xl text-[14px] font-bold transition-all border-2 ${
                      step3Budget === budget.id 
                        ? 'bg-brand-wine text-brand-gold border-brand-gold shadow-md' 
                        : 'bg-white/30 border-brand-gold/10 text-brand-wine/50 hover:border-brand-gold/30'
                    }`}
                  >
                    {budget.label}
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="flex justify-start px-2">
        <button 
          onClick={handleClear}
          className="text-[14px] text-brand-wine/50 font-black uppercase tracking-[0.2em] hover:text-brand-wine transition-all flex items-center gap-2 group"
        >
          <AlertCircle className="w-4 h-4 group-hover:rotate-12 transition-transform" />
          条件をリセット
        </button>
      </div>
    </div>
  );
};
