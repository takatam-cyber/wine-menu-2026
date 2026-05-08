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
  const storeIdParam = params.get('storeId');

  // Trigger anonymous login for customers if no user is present but storeId is provided
  useEffect(() => {
    if (!loading && !user && storeIdParam && !viewAs) {
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

  // If a storeId is provided and no explicit role for the admin, default to Customer View (for QR scanning simulation)
  if (!user && storeIdParam && !viewAs) {
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
    
    // If someone is just looking at a store menu
    if (storeIdParam && !viewAs) {
      return <CustomerView />;
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
    <div className={`flex flex-col min-h-screen ${user.role === 'customer' ? 'bg-brand-wine' : 'bg-[#FDFCFB]'} text-slate-900 font-sans selection:bg-brand-gold/30`}>
      {/* Branded Header */}
      <header className={`h-16 md:h-20 ${user.role === 'customer' ? 'bg-black/50 border-brand-gold/20' : 'bg-white border-slate-200'} backdrop-blur-xl flex items-center justify-between px-4 md:px-8 border-b shadow-sm shrink-0 z-50`}>
        <div className="flex items-center space-x-3 md:space-x-4">
          <div className={`w-8 h-8 md:w-10 md:h-10 border rounded-full flex items-center justify-center ${user.role === 'customer' ? 'border-brand-gold bg-black' : 'border-brand-wine bg-brand-wine text-white'} shadow-sm`}>
            <span className="serif text-lg md:text-xl">P</span>
          </div>
          <h1 className={`${user.role === 'customer' ? 'text-brand-ivory' : 'text-slate-900'} text-lg md:text-2xl font-serif tracking-[0.1em] md:tracking-[0.2em] uppercase truncate max-w-[150px] md:max-w-none`}>
            Pieroth <span className={`${user.role === 'customer' ? 'text-brand-gold' : 'text-brand-wine'} font-light opacity-80`}>Japan</span>
          </h1>
        </div>
        
        <div className="flex items-center gap-3 md:gap-6">
          <div className={`hidden sm:flex flex-col text-[10px] uppercase tracking-tighter text-right ${user.role === 'customer' ? 'text-brand-ivory' : 'text-slate-500'}`}>
            <span className="opacity-60 truncate max-w-[100px]">{user.email}</span>
            <span className="text-brand-gold font-bold">Role: {user.role}</span>
          </div>

          <button
            onClick={() => logout()}
            className={`${user.role === 'customer' ? 'text-brand-gold hover:text-white' : 'text-slate-400 hover:text-brand-wine'} p-2 mt-0.5 transition-colors`}
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
          className={`h-full ${user.role !== 'customer' ? 'overflow-y-auto' : ''}`}
        >
          {renderContent()}
        </motion.div>
      </main>

      <footer className={`hidden sm:flex h-10 border-t items-center px-8 justify-between shrink-0 ${user.role === 'customer' ? 'bg-black border-brand-gold/20' : 'bg-white border-slate-100'}`}>
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
