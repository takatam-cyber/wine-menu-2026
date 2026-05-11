import React, { useState } from 'react';
import { signInWithGoogle, auth } from '../lib/firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { Shield, Wine, User, Sparkles, Key, Mail, ChevronRight, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export const LoginView: React.FC = () => {
  const [loginMethod, setLoginMethod] = useState<'google' | 'id'>('google');
  const [ownerId, setOwnerId] = useState('');
  const [ownerPassword, setOwnerPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleOwnerLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    
    // Auto-append domain if ID is used
    const emailToUse = ownerId.includes('@') ? ownerId : `${ownerId}@pieroth-stores.app`;

    try {
      const userCredential = await signInWithEmailAndPassword(auth, emailToUse, ownerPassword);
      
      // Force sync claims immediately after login for smooth redirection
      const idToken = await userCredential.user.getIdToken();
      await fetch('/api/auth/sync-claims', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}` 
        }
      });
      // Force token refresh to pick up new claims
      await userCredential.user.getIdToken(true);
      
      // Note: App.tsx will pick up the user change and redirect automatically
    } catch (err: any) {
      console.error('Login error:', err);
      setError('ログインに失敗しました。IDまたはパスワードを確認してください。');
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    setError('');
    try {
      const userCredential = await signInWithGoogle();
      
      // Force sync claims immediately
      const idToken = await userCredential.user.getIdToken();
      await fetch('/api/auth/sync-claims', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}` 
        }
      });
      await userCredential.user.getIdToken(true);
    } catch (err: any) {
      console.error('Google login error:', err);
      setError('Googleログインに失敗しました。');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-brand-wine overflow-hidden relative">
      {/* Animated Background Elements */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-0 -left-10 w-96 h-96 bg-brand-gold rounded-full filter blur-[100px] animate-pulse" />
        <div className="absolute bottom-0 -right-10 w-96 h-96 bg-brand-gold rounded-full filter blur-[100px] animate-pulse delay-1000" />
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-black/60 backdrop-blur-2xl rounded-[3rem] p-10 border border-brand-gold/30 shadow-luxury relative z-10"
      >
        <div className="w-16 h-16 bg-black border border-brand-gold rounded-full flex items-center justify-center mx-auto mb-6 shadow-[0_0_30px_rgba(212,175,55,0.3)]">
          <span className="text-brand-gold font-serif text-3xl">P</span>
        </div>

        <h1 className="serif text-2xl text-brand-ivory mb-1 tracking-[0.2em] uppercase text-center">Pieroth <span className="text-brand-gold">Japan</span></h1>
        <p className="text-[9px] text-brand-gold/60 uppercase tracking-[0.4em] mb-10 font-bold text-center">Smart Menu & AI Sommelier Portal</p>

        <div className="flex bg-white/5 rounded-full p-1 mb-8">
          <button 
            onClick={() => { setLoginMethod('google'); setError(''); }}
            className={`flex-1 py-2 text-[10px] font-bold uppercase tracking-widest rounded-full transition-all ${loginMethod === 'google' ? 'bg-brand-gold text-brand-wine' : 'text-gray-500 hover:text-brand-gold'}`}
          >
            Google (営業担当)
          </button>
          <button 
            onClick={() => { setLoginMethod('id'); setError(''); }}
            className={`flex-1 py-2 text-[10px] font-bold uppercase tracking-widest rounded-full transition-all ${loginMethod === 'id' ? 'bg-brand-gold text-brand-wine' : 'text-gray-500 hover:text-brand-gold'}`}
          >
            店舗アカウント
          </button>
        </div>

        <AnimatePresence mode="wait">
          {loginMethod === 'google' ? (
            <motion.div
              key="google"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
            >
              <button 
                onClick={handleGoogleLogin}
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-4 bg-brand-gold text-brand-wine py-4 rounded-2xl font-bold text-xs uppercase tracking-widest hover:brightness-110 active:scale-95 transition-all shadow-luxury disabled:opacity-50"
              >
                {isLoading ? <Sparkles className="w-4 h-4 animate-spin" /> : 'Googleアカウントでログイン'}
                <Sparkles className="w-4 h-4" />
              </button>
              <p className="mt-4 text-[9px] text-gray-500 leading-tight text-center">
                ※ @pieroth.jp ドメインのGoogleアカウントが必要です。
              </p>
            </motion.div>
          ) : (
            <motion.form
              key="id"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              onSubmit={handleOwnerLogin}
              className="space-y-4"
            >
              <div>
                <label className="text-[9px] font-bold text-brand-gold/60 uppercase tracking-widest block mb-2">ログイン ID</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-gold opacity-50" />
                  <input 
                    type="text"
                    placeholder="営業担当が設定したID"
                    value={ownerId}
                    onChange={(e) => setOwnerId(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-4 py-3 text-xs text-brand-ivory focus:border-brand-gold outline-none transition-all"
                  />
                </div>
              </div>
              <div>
                <label className="text-[9px] font-bold text-brand-gold/60 uppercase tracking-widest block mb-2">パスワード</label>
                <div className="relative">
                  <Key className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-gold opacity-50" />
                  <input 
                    type="password"
                    placeholder="••••••••"
                    value={ownerPassword}
                    onChange={(e) => setOwnerPassword(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-4 py-3 text-xs text-brand-ivory focus:border-brand-gold outline-none transition-all"
                  />
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2 text-red-400 text-[10px] p-2 bg-red-500/10 rounded-lg border border-red-500/20">
                  <AlertCircle className="w-3 h-3" />
                  {error}
                </div>
              )}

              <button 
                type="submit"
                disabled={isLoading || !ownerId || !ownerPassword}
                className="w-full flex items-center justify-center gap-2 bg-brand-gold text-brand-wine py-4 rounded-2xl font-bold text-xs uppercase tracking-widest hover:brightness-110 active:scale-95 transition-all shadow-luxury disabled:opacity-30"
              >
                {isLoading ? <Sparkles className="w-4 h-4 animate-spin" /> : 'ログイン'}
                <ChevronRight className="w-4 h-4" />
              </button>
            </motion.form>
          )}
        </AnimatePresence>

        <div className="mt-8 pt-8 border-t border-white/5 grid grid-cols-3 gap-4 opacity-40">
           <div className="flex flex-col items-center gap-2">
              <Shield className="w-4 h-4 text-brand-gold" />
              <span className="text-[8px] text-brand-ivory uppercase">Sales Rep</span>
           </div>
           <div className="flex flex-col items-center gap-2">
              <Wine className="w-4 h-4 text-brand-gold" />
              <span className="text-[8px] text-brand-ivory uppercase">Owner</span>
           </div>
           <div className="flex flex-col items-center gap-2">
              <User className="w-4 h-4 text-brand-gold" />
              <span className="text-[8px] text-brand-ivory uppercase">Guest</span>
           </div>
        </div>

        <div className="mt-8 text-[9px] text-gray-500 uppercase tracking-widest font-bold text-center">
           Secure Single Sign-On • Pieroth Cloud
        </div>
      </motion.div>
    </div>
  );
};
