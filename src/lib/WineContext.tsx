// src/lib/WineContext.tsx
import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { UserProfile, Role } from '../types';
import { auth, db, onAuthStateChanged } from './firebase';
import { doc, getDoc } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';

interface WineContextType {
  user: UserProfile | null;
  loading: boolean;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  showConfirm: (message: string, onConfirm: () => void, subMessage?: string) => void;
}

const WineContext = createContext<WineContextType | undefined>(undefined);

export const WineProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [confirm, setConfirm] = useState<{ message: string; subMessage?: string; onConfirm: () => void } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ message, type });
  };

  const showConfirm = (message: string, onConfirm: () => void, subMessage?: string) => {
    setConfirm({ message, subMessage, onConfirm });
  };

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  /**
   * 💡 [Enterprise Architecture] resolveUserProfile
   * Expressサーバーへの往復フェッチ(sync-claims)を完全廃止。
   * トークンに含まれる暗号化済みのカスタムクレーム(Claims)を直接フロントエンドでデコードし、
   * ミリ秒単位で厳格な認可(Role判定)を確定させる。
   */
  const resolveUserProfile = async (firebaseUser: any) => {
    try {
      // 1. トークンからカスタムクレームを最高速で直接デコード (サーバー通信ゼロ)
      const tokenResult = await firebaseUser.getIdTokenResult();
      const claims = tokenResult.claims || {};
      
      // バックエンド(authController.ts)がトークンに焼き付けたRoleを最優先で評価
      let role: Role = (claims.role as Role) || 'customer';
      let storeId: string | undefined = claims.storeId as string | undefined;

      // 2. 特権ドメインを持つ営業担当(@pieroth.jp)かつ明示的なRoleがまだない場合はadminとして救済
      const email = firebaseUser.email || '';
      if (email.endsWith('@pieroth.jp') || email === 'takatam40725@gmail.com') {
        if (role === 'customer') role = 'admin';
      }

      // 3. 基本情報をFirestoreのusersコレクションからバックグラウンドで補完
      const docRef = doc(db, 'users', firebaseUser.uid);
      const docSnap = await getDoc(docRef);
      let displayName = email ? email.split('@')[0] : 'Guest';

      if (docSnap.exists()) {
        const dbData = docSnap.data();
        displayName = dbData.name || displayName;
        // トークンに書き込まれる前の最新のstoreIdがDBにあればフォールバック
        storeId = storeId || dbData.storeId;
      }

      const profile: UserProfile = {
        uid: firebaseUser.uid,
        email,
        name: displayName,
        role,
        storeId
      };

      setUser(profile);
    } catch (error) {
      console.error("[Auth Context] Failed to resolve user profile:", error);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // 4. セッション監視リスナー。毎回の無駄な同期通信がなくなり、完全なリアクティブに。
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        await resolveUserProfile(firebaseUser);
      } else {
        setUser(null);
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  const contextValue = React.useMemo(() => ({
    user,
    loading,
    showToast,
    showConfirm
  }), [user, loading]);

  return (
    <WineContext.Provider value={contextValue}>
      {children}

      {/* トースト通知コンポーネント (維持) */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 60, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.95 }}
            transition={{ type: "spring", damping: 25, stiffness: 350 }}
            className="fixed bottom-10 left-4 right-4 md:left-auto md:right-8 z-[9999] max-w-md mx-auto md:mx-0 p-5 rounded-2xl border bg-brand-dark/95 backdrop-blur-xl border-brand-gold/40 shadow-[0_25px_60px_rgba(0,0,0,0.6)] flex items-center gap-4"
          >
            <div className="shrink-0">
              {toast.type === 'success' && <CheckCircle2 className="w-8 h-8 text-green-400" />}
              {toast.type === 'error' && <AlertCircle className="w-8 h-8 text-red-400" />}
              {toast.type === 'info' && <Info className="w-8 h-8 text-brand-gold" />}
            </div>
            <p className="text-brand-ivory text-base font-black leading-relaxed flex-1 select-none">
              {toast.message}
            </p>
            <button onClick={() => setToast(null)} className="p-2 text-gray-400 hover:text-brand-gold transition-colors shrink-0">
              <X className="w-6 h-6" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 確認ダイアログコンポーネント (維持) */}
      <AnimatePresence>
        {confirm && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setConfirm(null)} className="absolute inset-0 bg-brand-dark/85 backdrop-blur-md" />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 40 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 40 }}
              transition={{ type: "spring", damping: 28, stiffness: 300 }}
              className="relative w-full max-w-md rounded-[2.5rem] border bg-[#160B0B] border-brand-gold/40 p-8 shadow-[0_30px_80px_rgba(0,0,0,0.8)] flex flex-col text-center"
            >
              <div className="w-16 h-16 bg-brand-wine border border-brand-gold/30 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
                <AlertCircle className="text-brand-gold w-8 h-8" />
              </div>
              <h3 className="serif text-xl md:text-2xl text-brand-ivory font-black tracking-wide mb-4 leading-snug">{confirm.message}</h3>
              {confirm.subMessage && <p className="text-[15px] md:text-base text-gray-400 font-bold leading-relaxed mb-8 max-w-sm mx-auto">{confirm.subMessage}</p>}
              <div className="flex flex-col gap-3">
                <button
                  onClick={() => {
                    confirm.onConfirm();
                    setConfirm(null);
                  }}
                  className="w-full h-14 rounded-xl text-base font-black uppercase tracking-widest bg-brand-gold text-brand-wine hover:brightness-110 active:scale-[0.98] transition-all shadow-xl shadow-brand-gold/10"
                >
                  はい、実行する
                </button>
                <button onClick={() => setConfirm(null)} className="w-full h-14 rounded-xl text-base font-bold uppercase tracking-widest text-gray-400 bg-white/5 border border-white/10 hover:bg-white/10 active:scale-[0.98] transition-all">
                  キャンセル
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </WineContext.Provider>
  );
};

export const useWines = () => {
  const context = useContext(WineContext);
  if (!context) throw new Error('useWines must be used within a WineProvider');
  return context;
};
