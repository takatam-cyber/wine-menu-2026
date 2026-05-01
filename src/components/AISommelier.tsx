import React, { useState } from 'react';
import { WineMaster } from '../types';
import { getSommelierAdvice } from '../lib/ai-service';
import { Send, Sparkles, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';

interface AISommelierProps {
  availableWines: WineMaster[];
  cuisineType?: string;
}

export const AISommelier: React.FC<AISommelierProps> = ({ availableWines, cuisineType }) => {
  const [query, setQuery] = useState('');
  const [messages, setMessages] = useState<{ role: 'user' | 'ai'; content: string }[]>([]);
  const [loading, setLoading] = useState(false);

  const handleSend = async () => {
    if (!query.trim()) return;

    const userMessage = query;
    setMessages((prev) => [...prev, { role: 'user', content: userMessage }]);
    setQuery('');
    setLoading(true);

    const response = await getSommelierAdvice(userMessage, availableWines, { cuisine: cuisineType });
    
    setMessages((prev) => [...prev, { role: 'ai', content: response }]);
    setLoading(false);
  };

  return (
    <div id="ai-sommelier" className="flex flex-col h-[500px] bg-white rounded-xl shadow-2xl border border-brand-gold/20 overflow-hidden">
      <div className="bg-brand-wine px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="text-brand-gold w-5 h-5" />
          <h3 className="serif text-brand-ivory text-xl">AI Sommelier</h3>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-brand-ivory/30">
        {messages.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            <p className="serif italic text-lg text-brand-wine/60">
              "本日の気分や、ご注文のお料理をお聞かせください。"
            </p>
          </div>
        )}
        {messages.map((msg, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl p-4 text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-brand-wine text-white rounded-tr-none'
                  : 'bg-white text-gray-800 shadow-md border border-brand-gold/10 rounded-tl-none'
              }`}
            >
              <div className="markdown-body">
                <ReactMarkdown>{msg.content}</ReactMarkdown>
              </div>
            </div>
          </motion.div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-white p-4 rounded-2xl shadow-md border border-brand-gold/10 flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-brand-wine" />
              <span className="text-xs italic text-gray-500">Selectioning the perfect vintage...</span>
            </div>
          </div>
        )}
      </div>

      <div className="p-4 bg-white border-t border-brand-gold/10">
        <div className="relative">
          <input
            type="text"
            id="sommelier-input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSend()}
            placeholder="魚料理に合う、キリッとした白はありますか？"
            className="w-full pl-4 pr-12 py-3 rounded-full border border-brand-gold/30 focus:outline-none focus:ring-2 focus:ring-brand-gold/20 text-sm"
          />
          <button
            id="sommelier-send"
            onClick={handleSend}
            disabled={loading}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-brand-wine text-brand-gold hover:opacity-90 disabled:opacity-50 transition-all"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
