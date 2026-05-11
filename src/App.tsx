import React, { useState, useEffect } from 'react';
import { AdminView } from './views/AdminView';
import { OwnerView } from './views/OwnerView';
import { CustomerView } from './views/CustomerView';
import { LoginView } from './components/LoginView';
import { useWines } from './lib/WineContext';
import { Role } from './types';
import { User, Shield, Wine, Menu as MenuIcon, X, LogOut, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { logout, signInAnonymously, auth } from './lib/firebase';

export default function App() {
  const { user, loading } = useWines();
  const [showRoleSwitcher, setShowRoleSwitcher] = useState(false);
  const [isAnonLoading, setIsAnonLoading] = useState(false);

  // Preview / Simulation logic
  const params = new URLSearchParams(window.location.search);
  const viewAs = params.get('view_as');
  const storeIdParam = params.get('storeId')?.trim();

  // Session check for QR access
  const [sessionExpired, setSessionExpired] = useState(false);

  useEffect(() => {
    if (storeIdParam && !viewAs) {
      const sessionKey = `pieroth_session_${storeIdParam}`;
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

      // Periodically check if still open
      const interval = setInterval(() => {
        const now = Date.now();
        if (now - (parseInt(localStorage.getItem(sessionKey) || "0")) > TWO_HOURS_MS) {
          setSessionExpired(true);
        }
      }, 60000); // Check every minute

      return () => clearInterval(interval);
    }
  }, [storeIdParam, viewAs]);

  // Trigger anonymous login for customers if no user is present but storeId is provided
  useEffect(() => {
    if (!loading && !user && storeIdParam && !viewAs && !sessionExpired) {
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
  }, [loading, user, storeIdParam, viewAs]);

  if (loading || isAnonLoading) {
    return (
      <div className="min-h-screen bg-brand-wine flex flex-col items-center justify-center gap-6">
        <Loader2 className="w-12 h-12 animate-spin text-brand-gold" />
        <p className="serif italic text-brand-gold/60 text-lg tracking-widest">AUTHENTICATING...</p>
      </div>
    );
  }

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
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
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
              セキュリティ保護のため、<br/>
              再度店内のQRコードを読み取って<br/>
              最新のリストをご覧ください。
            </p>
          </div>

          <div className="text-[9px] text-brand-gold/30 tracking-[0.5em] uppercase mb-10">
            Security & Privacy Protected
          </div>
        </motion.div>
      </div>
    );
  }

  // If a storeId is provided (QR scan / Preview) or the user is a customer, 
  // render CustomerView standalone without the global business shell.
  if ((storeIdParam && (!viewAs || viewAs === 'customer')) || user?.role === 'customer') {
    return <CustomerView />;
  }

  if (!user) {
    return <LoginView />;
  }

  const renderContent = () => {
    // If Admin/Rep is previewing
    if ((user.role === 'admin' || user.role === 'rep') && viewAs === 'owner') {
      return <OwnerView />;
    }
    
    switch (user.role) {
      case 'admin':
      case 'rep':
        return <AdminView />;
      case 'owner':
        return <OwnerView />;
      case 'customer':
      default:
        return <CustomerView />;
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#FDFCFB] text-slate-900 font-sans selection:bg-brand-gold/30">
      {/* Branded Header */}
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
            <span className="text-brand-gold font-bold">Role: {user.role}</span>
          </div>

          <button
            onClick={() => logout()}
            className="text-slate-400 hover:text-brand-wine p-2 mt-0.5 transition-colors"
            title="Sign Out"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-hidden">
        <motion.div
          key={user.role}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4 }}
          className="h-full overflow-y-auto"
        >
          {renderContent()}
        </motion.div>
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
}
