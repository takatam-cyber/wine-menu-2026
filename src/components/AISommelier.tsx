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

  const handleSend = async () => {
    if (!query.trim()) return;

    const userMessage = query;
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
    const selectRegex = /\[SELECT:(\d+)\]/g;
    return (
      <div className="space-y-4">
        <div className="markdown-body text-[13px] leading-relaxed">
          <ReactMarkdown>{content.replace(selectRegex, '')}</ReactMarkdown>
        </div>
        
        <div className="flex flex-wrap gap-2 pt-2">
          {Array.from(content.matchAll(selectRegex)).map((match, idx) => {
            const wineId = match[1];
            return (
              <button
                key={`${wineId}-${idx}`}
                onClick={() => {
                  onSelectWine?.(wineId);
                  setIsOpen(false);
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-brand-gold text-brand-wine text-[11px] font-bold uppercase tracking-[0.1em] rounded-full border border-brand-wine/10 shadow-lg hover:brightness-110 active:scale-95 transition-all animate-in fade-in slide-in-from-bottom-2 duration-700"
              >
                <Wine className="w-3.5 h-3.5" />
                このワインを詳しく
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <>
      {/* Bottom Sheet Drawer */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60]"
            />
            
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed bottom-0 inset-x-0 bg-brand-ivory z-[70] rounded-t-[40px] shadow-[0_-20px_50px_rgba(0,0,0,0.3)] border-t border-brand-gold/20 flex flex-col max-h-[85vh]"
            >
              <div className="w-16 h-1.5 bg-brand-gold/40 rounded-full mx-auto my-5 shrink-0 opacity-80" />
              
              <div className="px-10 pb-6 border-b border-brand-gold/10 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-brand-wine flex items-center justify-center border-2 border-brand-gold/20 shadow-inner">
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
                className="flex-1 overflow-y-auto px-8 py-10 space-y-8 scroll-smooth bg-gradient-to-b from-white to-brand-gold/10"
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

