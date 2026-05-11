import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useParams } from 'react-router-dom';
import { AdminView } from './views/AdminView';
import { OwnerView } from './views/OwnerView';
import { CustomerView } from './views/CustomerView';
import { LoginView } from './components/LoginView';
import { useWines } from './lib/WineContext';
import { Role } from './types';
import { User, Shield, Wine, Menu as MenuIcon, X, LogOut, Loader2 } from 'lucide-react';
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
  
  if (!user) return <Navigate to="/login" replace />;

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
          <div className="hidden sm:flex flex-col text-[10px] uppercase tracking-tighter text-right text-slate-500">
            <span className="opacity-60 truncate max-w-[100px]">{user.email}</span>
            <span className="text-brand-gold font-bold uppercase tracking-widest text-[8px]">Role: {user.role}</span>
          </div>
          <button
            onClick={() => logout()}
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

export default function App() {
  const { user, loading } = useWines();
  const [isAnonLoading, setIsAnonLoading] = useState(false);

  // Trigger anonymous login for customers in background 
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const hasLegacyStoreId = params.get('storeId');
    const isMenuPath = window.location.pathname.startsWith('/menu/') || !!hasLegacyStoreId;
    
    if (!loading && !user && isMenuPath) {
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
      {/* Redirect Root to proper place based on role */}
        <Route path="/" element={
          (() => {
            const params = new URLSearchParams(window.location.search);
            const legacyStoreId = params.get('storeId');
            
            if (legacyStoreId) {
              return <Navigate to={`/menu/${legacyStoreId}`} replace />;
            }
            
            if (!user) return <Navigate to="/login" replace />;
            
            if (user.role === 'admin' || user.role === 'rep') return <Navigate to="/admin" replace />;
            if (user.role === 'owner') return <Navigate to="/owner" replace />;
            return <Navigate to="/login" replace />;
          })()
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
          <DashboardLayout>
            {user?.role === 'admin' || user?.role === 'rep' ? <AdminView /> : <Navigate to="/" replace />}
          </DashboardLayout>
        } />

        {/* Owner Section */}
        <Route path="/owner" element={
          <DashboardLayout>
            {user?.role === 'owner' ? <OwnerView /> : 
             ((user?.role === 'admin' || user?.role === 'rep') ? <OwnerView /> : <Navigate to="/" replace />)}
          </DashboardLayout>
        } />

        {/* Catch all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    );
}
