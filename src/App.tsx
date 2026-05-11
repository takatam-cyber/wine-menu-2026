import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useParams } from 'react-router-dom';
import { AdminView } from './views/AdminView';
import { OwnerView } from './views/OwnerView';
import { CustomerView } from './views/CustomerView';
import { LoginView } from './components/LoginView';
import { useWines } from './lib/WineContext';
import { Role } from './types';
import { User, Shield, Wine, Menu as MenuIcon, X, LogOut, Loader2, Eye } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { logout, signInAnonymously, auth } from './lib/firebase';

// Helper for Session Management (Used in CustomerView)
const SessionExpiredGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { storeId } = useParams();
  const { user } = useWines();
  const [sessionExpired, setSessionExpired] = useState(false);

  useEffect(() => {
    if (storeId) {
      const sessionKey = `pieroth_session_${storeId}`;
      const savedTime = localStorage.getItem(sessionKey);
      const currentTime = Date.now();
      const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

      if (savedTime) {
        if (currentTime - parseInt(savedTime) > TWO_HOURS_MS) {
          setSessionExpired(true);
        }
      } else {
        localStorage.setItem(sessionKey, currentTime.toString());
      }

      const interval = setInterval(() => {
        const now = Date.now();
        if (now - (parseInt(localStorage.getItem(sessionKey) || "0")) > TWO_HOURS_MS) {
          setSessionExpired(true);
        }
      }, 60000);

      return () => clearInterval(interval);
    }
  }, [storeId]);

  if (sessionExpired && user?.role !== 'admin' && user?.role !== 'rep' && user?.role !== 'owner') {
    return (
      <div className="min-h-screen bg-brand-wine flex flex-col items-center justify-center p-8 text-center text-brand-gold overflow-hidden">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-brand-gold/5 rounded-full blur-3xl scale-150" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-brand-gold/5 rounded-full blur-3xl scale-150" />
        </div>
        <motion.div 
          initial={{ opacity: 0, scale: 0.9, y: 30 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          className="max-w-md w-full glass-panel p-12 md:p-16 rounded-[4rem] border-brand-gold/20 shadow-2xl relative z-10 bg-black/40 backdrop-blur-2xl"
        >
          <div className="mb-10 inline-block p-6 rounded-full bg-brand-gold/10 border border-brand-gold/20 animate-pulse">
            <Shield className="w-12 h-12 text-brand-gold" strokeWidth={1} />
          </div>
          <h2 className="serif text-4xl md:text-5xl mb-8 tracking-[0.25em] font-light leading-tight uppercase">
            SESSION<br/>
            <span className="text-xl opacity-40 font-sans tracking-[0.6em] ml-2">EXPIRED</span>
          </h2>
          <div className="w-16 h-px bg-brand-gold/40 mx-auto my-10" />
          <div className="space-y-6 mb-14">
            <p className="text-xs text-brand-ivory/90 leading-relaxed serif italic tracking-[0.25em] uppercase">
              セッションの有効期限が切れました。
            </p>
            <p className="text-[12px] text-brand-gold font-bold tracking-[0.15em] uppercase leading-loose">
              セキュリティ保護のため、再度店内のQRコードを読み取ってください。
            </p>
          </div>
        </motion.div>
      </div>
    );
  }

  return <>{children}</>;
};

// Global Layout for admin/owner
const DashboardLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useWines();
  const location = useLocation();
  
  if (!user) return <Navigate to="/login" replace />;

  const isOwnerView = location.pathname === '/owner';

  return (
    <div className="flex flex-col min-h-screen bg-[#FDFCFB] text-slate-900 font-sans selection:bg-brand-gold/30">
      <header className="h-16 md:h-20 bg-white border-slate-200 backdrop-blur-xl flex items-center justify-between px-4 md:px-8 border-b shadow-sm shrink-0 z-50">
        <div className="flex items-center space-x-3 md:space-x-4">
          <div className="w-8 h-8 md:w-10 md:h-10 border border-brand-wine bg-brand-wine text-white rounded-full flex items-center justify-center shadow-sm">
            <span className="serif text-lg md:text-xl">P</span>
          </div>
          <h1 className="text-slate-900 text-lg md:text-2xl font-serif tracking-[0.1em] md:tracking-[0.2em] uppercase truncate max-w-[150px] md:max-w-none">
            Pieroth <span className="text-brand-wine font-light opacity-80">Japan</span>
          </h1>
        </div>
        
        <div className="flex items-center gap-3 md:gap-6">
          {(user.role === 'admin' || user.role === 'rep') && (
            <button
              onClick={() => isOwnerView ? window.location.href = '/admin' : window.location.href = '/owner'}
              className="hidden lg:flex items-center gap-2 px-4 py-1.5 bg-brand-gold/10 text-brand-gold border border-brand-gold/30 rounded-full text-[10px] font-bold uppercase tracking-widest hover:bg-brand-gold hover:text-brand-wine transition-all"
            >
              <Eye className="w-3.5 h-3.5" />
              {isOwnerView ? '管理者ダッシュボードに戻る' : '店舗管理画面を試用 (Owner Mode)'}
            </button>
          )}
          <div className="hidden sm:flex flex-col text-[10px] uppercase tracking-tighter text-right text-slate-500">
            <span className="opacity-60 truncate max-w-[100px]">{user.email}</span>
            <span className="text-brand-gold font-bold uppercase tracking-widest text-[8px]">権限: {user.role === 'admin' ? '管理者' : user.role === 'owner' ? '店舗オーナー' : '営業担当'}</span>
          </div>
          <button
            onClick={() => {
              logout().then(() => window.location.href = '/login');
            }}
            className="text-slate-400 hover:text-brand-wine p-2 transition-colors"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-hidden">
        {children}
      </main>

      <footer className="hidden sm:flex h-10 border-t items-center px-8 justify-between shrink-0 bg-white border-slate-100">
        <div className="flex items-center space-x-4">
          <span className="text-[9px] text-slate-400 uppercase font-bold tracking-widest opacity-60">© 2024 PIEROTH JAPAN K.K.</span>
        </div>
        <div className="flex items-center space-x-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-brand-gold animate-pulse text-xs"></div>
          <span className="text-[9px] font-bold text-slate-400 uppercase">Authenticated Session</span>
        </div>
      </footer>
    </div>
  );
};

// Role-based protection components
const AdminRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useWines();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'admin' && user.role !== 'rep') return <Navigate to="/login" replace />;
  return <DashboardLayout>{children}</DashboardLayout>;
};

const OwnerRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useWines();
  if (!user) return <Navigate to="/login" replace />;
  
  // 修正：管理者(admin)と営業担当(rep)もオーナー画面にアクセスできるように拡張
  const allowedRoles = ['owner', 'admin', 'rep'];
  if (!allowedRoles.includes(user.role)) return <Navigate to="/login" replace />;
  
  return <DashboardLayout>{children}</DashboardLayout>;
};

export default function App() {
  const { user, loading } = useWines();
  const [isAnonLoading, setIsAnonLoading] = useState(false);

  // Trigger anonymous login for customers in background 
  useEffect(() => {
    const isMenuPath = window.location.pathname.startsWith('/menu/');
    const params = new URLSearchParams(window.location.search);
    const hasLegacyStoreId = params.get('storeId');
    
    if (!loading && !user && (isMenuPath || hasLegacyStoreId)) {
      const performAnonLogin = async () => {
        setIsAnonLoading(true);
        try {
          await signInAnonymously(auth);
        } catch (e) {
          console.error("Anonymous login failed:", e);
        } finally {
          setIsAnonLoading(false);
        }
      };
      performAnonLogin();
    }
  }, [loading, user]);

  if (loading || isAnonLoading) {
    return (
      <div className="min-h-screen bg-brand-wine flex flex-col items-center justify-center gap-6">
        <Loader2 className="w-12 h-12 animate-spin text-brand-gold" />
        <p className="serif italic text-brand-gold/60 text-lg tracking-widest uppercase">認証中...</p>
      </div>
    );
  }

  return (
    <Routes>
      {/* Root redirection logic */}
      <Route path="/" element={
        <Navigate to={
          !user ? "/login" : 
          (user.role === 'admin' || user.role === 'rep') ? "/admin" : 
          user.role === 'owner' ? "/owner" : "/login"
        } replace />
      } />

      {/* Public / Login */}
      <Route path="/login" element={
        user ? <Navigate to="/" replace /> : <LoginView />
      } />

      {/* Customer Menu */}
      <Route path="/menu/:storeId" element={
        <SessionExpiredGuard>
          <CustomerView />
        </SessionExpiredGuard>
      } />

      {/* Admin Section */}
      <Route path="/admin" element={
        <AdminRoute>
          <AdminView />
        </AdminRoute>
      } />

      {/* Owner Section */}
      <Route path="/owner" element={
        <OwnerRoute>
          <OwnerView />
        </OwnerRoute>
      } />

      {/* Catch all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
