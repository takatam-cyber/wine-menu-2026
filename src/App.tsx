import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useParams, useNavigate } from 'react-router-dom';
import { AdminView } from './views/AdminView';
import { OwnerView } from './views/OwnerView';
import { CustomerView } from './views/CustomerView';
import { LoginView } from './components/LoginView';
import { useWines } from './lib/WineContext';
import { Role } from './types';
import { User, Shield, Wine, Menu as MenuIcon, X, LogOut, Loader2, Eye, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { logout, signInAnonymously, auth } from './lib/firebase';

// Global Layout for admin/owner
const DashboardLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useWines();
  const location = useLocation();
  
  if (!user) return <Navigate to="/login" replace />;

  const isOwnerView = location.pathname.startsWith('/owner');
  const navigate = useNavigate();

  return (
    <div className="flex flex-col min-h-screen bg-[#FDFCFB] text-slate-900 font-sans selection:bg-brand-gold/30">
      <header className="h-16 md:h-20 bg-white border-slate-200 backdrop-blur-xl flex items-center justify-between px-4 md:px-8 border-b shadow-sm shrink-0 z-50">
        <div className="flex items-center space-x-3 md:space-x-4">
          <div className="w-8 h-8 md:w-10 md:h-10 border border-brand-gold bg-brand-gold text-brand-wine rounded-full flex items-center justify-center shadow-sm">
            <span className="serif text-lg md:text-xl font-bold">W</span>
          </div>
          <h1 className="text-slate-900 text-lg md:text-2xl font-serif tracking-[0.1em] md:tracking-[0.2em] uppercase truncate max-w-[150px] md:max-w-none">
            Wine <span className="text-brand-gold font-light opacity-80 italic">Menu System</span>
          </h1>
        </div>
        
        <div className="flex items-center gap-3 md:gap-6">
          {(user.role === 'admin' || user.role === 'rep') && (
            <button
              onClick={() => isOwnerView ? navigate('/admin') : (user.storeId ? navigate(`/owner/${user.storeId}`) : navigate('/admin'))}
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
              logout().then(() => navigate('/login'));
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
          <span className="text-[9px] text-slate-400 uppercase font-bold tracking-widest opacity-60">WINE SELECTION SYSTEM</span>
        </div>
        <div className="flex items-center space-x-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-brand-gold animate-pulse text-xs"></div>
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Secure Access</span>
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
        !user ? <Navigate to="/login" replace /> : 
        (user.role === 'admin' || user.role === 'rep') ? <Navigate to="/admin" replace /> : 
        (user.role === 'owner' && user.storeId) ? <Navigate to={`/owner/${user.storeId}`} replace /> :
        (user.role === 'owner' && !user.storeId) ? (
          <div className="min-h-screen bg-brand-wine flex flex-col items-center justify-center gap-6 text-center px-4">
            <AlertCircle className="w-12 h-12 text-brand-gold" />
            <p className="serif italic text-brand-gold/60 text-lg tracking-widest uppercase">店舗情報が未設定です。管理者に連絡してください。</p>
            <button onClick={() => logout()} className="text-brand-gold underline uppercase text-xs tracking-widest">ログアウト</button>
          </div>
        ) : (
          <div className="min-h-screen bg-brand-wine flex flex-col items-center justify-center gap-6 text-center px-4">
            <Loader2 className="w-12 h-12 animate-spin text-brand-gold" />
            <p className="serif italic text-brand-gold/60 text-lg tracking-widest uppercase">権限を確認中...</p>
          </div>
        )
      } />

      {/* Public / Login */}
      <Route path="/login" element={
        user ? <Navigate to="/" replace /> : <LoginView />
      } />

      {/* Customer Menu */}
      <Route path="/menu/:storeId" element={
        <CustomerView />
      } />

      {/* Admin Section */}
      <Route path="/admin" element={
        <AdminRoute>
          <AdminView />
        </AdminRoute>
      } />

      {/* Owner Section */}
      <Route path="/owner/:storeId" element={
        <OwnerRoute>
          <OwnerView />
        </OwnerRoute>
      } />

      {/* Catch all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
