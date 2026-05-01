import React, { useState, useRef, useEffect } from 'react';
import { WineMaster } from '../types';
import { getSommelierAdvice } from '../lib/ai-service';
import { Send, Sparkles, Loader2, X, MessageSquare, Wine, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';

interface AISommelierProps {
  availableWines: WineMaster[];
  cuisineType?: string;
  onSelectWine?: (id: string) => void;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}

export const AISommelier: React.FC<AISommelierProps> = ({ availableWines, cuisineType, onSelectWine, isOpen, setIsOpen }) => {
  const [query, setQuery] = useState('');
  const [messages, setMessages] = useState<{ role: 'user' | 'ai'; content: string }[]>([
    { role: 'ai', content: 'いらっしゃいませ。本日のお料理に合うワインをお探しですか？' }
  ]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const handleSend = async (customQuery?: string) => {
    const userMessage = customQuery || query;
    if (!userMessage.trim()) return;

    setMessages((prev) => [...prev, { role: 'user', content: userMessage }]);
    setQuery('');
    setLoading(true);
    setError(null);

    try {
      const response = await getSommelierAdvice(userMessage, availableWines, { cuisine: cuisineType });
      setMessages((prev) => [...prev, { role: 'ai', content: response }]);
    } catch (err: any) {
      setError(err.message || 'エラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  const renderMessageContent = (content: string) => {
    // Robust regex to handle potential extra spaces
    const selectRegex = /\[SELECT:\s*(\d+)\s*\]/g;
    const buttonRegex = /\[BUTTON:\s*([^\]]+)\s*\]/g;
    
    // Clean text for markdown (remove tags precisely)
    const cleanContent = content.replace(selectRegex, '').replace(buttonRegex, '').trim();
    
    // Extract interactive elements
    const selections = Array.from(content.matchAll(selectRegex)).map(m => m[1]);
    const buttons = Array.from(content.matchAll(buttonRegex)).map(m => m[1]);

    return (
      <div className="space-y-5">
        <div className="markdown-body text-[13.5px] leading-[1.8] font-medium text-brand-wine/90">
          <ReactMarkdown>{cleanContent}</ReactMarkdown>
        </div>
        
        {/* Wine Action Buttons */}
        {selections.length > 0 && (
          <div className="flex flex-wrap gap-3 pt-1">
            {selections.map((wineId, idx) => (
              <motion.button
                key={`select-${wineId}-${idx}`}
                whileHover={{ scale: 1.05, backgroundColor: '#2D0F0F', color: '#D4AF37' }}
                whileTap={{ scale: 0.95 }}
                onClick={() => {
                  onSelectWine?.(wineId);
                  setIsOpen(false);
                }}
                className="inline-flex items-center gap-3 px-6 py-3 bg-brand-gold text-brand-wine text-[11px] font-bold uppercase tracking-[0.2em] rounded-full shadow-[0_10px_25px_rgba(212,175,55,0.3)] transition-all animate-in fade-in zoom-in duration-500"
              >
                <div className="w-6 h-6 rounded-full bg-brand-wine/10 flex items-center justify-center">
                  <Wine className="w-3.5 h-3.5" />
                </div>
                🍷 このワインの詳細を見る
              </motion.button>
            ))}
          </div>
        )}

        {/* Interaction Chips (Wizard style next steps) */}
        {buttons.length > 0 && (
          <div className="flex flex-wrap gap-2.5 pt-2">
            {buttons.map((label, idx) => (
              <motion.button
                key={`btn-${label}-${idx}`}
                whileHover={{ scale: 1.05, y: -2, backgroundColor: '#FFFFFF', borderColor: '#D4AF37' }}
                whileTap={{ scale: 0.95 }}
                onClick={() => handleSend(label)}
                className="px-5 py-2.5 bg-white/60 text-brand-wine/80 text-[11px] font-bold rounded-2xl border border-brand-gold/15 shadow-sm hover:text-brand-wine transition-all animate-in slide-in-from-bottom-2 duration-300"
              >
                {label}
              </motion.button>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      {/* Bottom Sheet Drawer */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop with luxury blur */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-[6px] z-[60]"
            />
            
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 220 }}
              className="fixed bottom-0 inset-x-0 bg-white/85 backdrop-blur-3xl z-[70] rounded-t-[40px] shadow-[0_-20px_60px_rgba(0,0,0,0.4)] border-t border-white/20 flex flex-col max-h-[85vh] overflow-hidden"
            >
              {/* Luxury Accent Line */}
              <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-brand-gold to-transparent opacity-60" />
              
              <div className="w-16 h-1.5 bg-brand-gold/30 rounded-full mx-auto my-5 shrink-0 opacity-80" />
              
              <div className="px-10 pb-6 border-b border-brand-gold/5 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-brand-wine flex items-center justify-center border-2 border-brand-gold/30 shadow-[inset_0_2px_10px_rgba(0,0,0,0.5)]">
                    <Sparkles className="text-brand-gold w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="serif text-brand-wine text-2xl font-medium tracking-tight">AI Sommelier</h3>
                    <p className="text-[9px] text-brand-wine/50 uppercase tracking-[0.3em] font-bold">Exclusive Concierge</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsOpen(false)}
                  className="p-3 rounded-full hover:bg-brand-gold/10 text-brand-wine transition-all border border-transparent hover:border-brand-gold/20"
                >
                  <X className="w-7 h-7" />
                </button>
              </div>

              <div 
                ref={scrollRef}
                className="flex-1 overflow-y-auto px-8 py-10 space-y-8 scroll-smooth bg-gradient-to-b from-white/10 to-brand-gold/5"
              >
                {error && (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-red-600 text-xs text-center flex flex-col gap-2 shadow-sm animate-in fade-in zoom-in">
                    <p className="font-bold">⚠️ Sommelier Warning</p>
                    <p>{error}</p>
                  </div>
                )}
                
                {messages.length === 0 && (
                  <div className="text-center py-20 space-y-4">
                    <motion.div
                      animate={{ y: [0, -10, 0] }}
                      transition={{ duration: 4, repeat: Infinity }}
                    >
                      <Wine className="w-12 h-12 text-brand-gold mx-auto opacity-40" />
                    </motion.div>
                    <p className="serif italic text-xl text-brand-wine/80 max-w-[280px] mx-auto leading-relaxed">
                      "本日の気分や、ご注文のお料理をお聞かせください。最高の1本を店舗リストからお選びいたします。"
                    </p>
                  </div>
                )}
                
                {messages.map((msg, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-[24px] p-5 shadow-sm ${
                        msg.role === 'user'
                          ? 'bg-brand-wine text-brand-ivory rounded-tr-none'
                          : 'bg-white text-gray-800 shadow-xl border border-brand-gold/10 rounded-tl-none'
                      }`}
                    >
                      {msg.role === 'ai' ? (
                        renderMessageContent(msg.content)
                      ) : (
                        <p className="text-sm font-medium">{msg.content}</p>
                      )}
                    </div>
                  </motion.div>
                ))}
                
                {loading && (
                  <div className="flex justify-start">
                    <div className="bg-white px-6 py-4 rounded-[24px] shadow-lg border border-brand-gold/10 flex items-center gap-3">
                      <div className="flex gap-1">
                        <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 1 }} className="w-2 h-2 rounded-full bg-brand-wine/40" />
                        <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 1, delay: 0.2 }} className="w-2 h-2 rounded-full bg-brand-wine/70" />
                        <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 1, delay: 0.4 }} className="w-2 h-2 rounded-full bg-brand-wine" />
                      </div>
                      <span className="text-xs serif italic text-brand-wine/70">ソムリエが在庫を確認中...</span>
                    </div>
                  </div>
                )}
              </div>

              <div className="p-6 bg-white/80 backdrop-blur-md border-t border-brand-gold/10 pb-10">
                <div className="relative group">
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                    placeholder="お料理に合う1本を提案します..."
                    className="w-full pl-6 pr-14 py-4 rounded-full border border-brand-gold/20 focus:border-brand-gold/50 focus:outline-none focus:ring-4 focus:ring-brand-gold/10 text-sm transition-all bg-brand-ivory/20"
                  />
                  <button
                    onClick={handleSend}
                    disabled={loading}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-3 rounded-full bg-brand-wine text-brand-gold hover:brightness-125 disabled:opacity-50 transition-all shadow-md group-hover:scale-105"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};

