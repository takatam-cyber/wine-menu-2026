import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { WineMaster, UserProfile, Role, Store } from '../types';
import { auth, db, onAuthStateChanged } from './firebase';
import { doc, getDoc, setDoc, collection, query, where, getDocs, limit, startAfter, QueryDocumentSnapshot, DocumentData } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from './firestore-errors';

interface WineContextType {
  wines: WineMaster[];
  setWines: (wines: WineMaster[]) => void;
  user: UserProfile | null;
  loading: boolean;
  stores: Store[];
  refreshStores: (isNext?: boolean, limitCount?: number) => Promise<void>;
  refreshWines: (isNext?: boolean, limitCount?: number) => Promise<void>;
  searchMasterWines: (term: string) => Promise<void>;
  hasMoreStores: boolean;
  hasMoreWines: boolean;
}

const WineContext = createContext<WineContextType | undefined>(undefined);

export const WineProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [wines, setWines] = useState<WineMaster[]>([]);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [stores, setStores] = useState<Store[]>([]);
  
  const [lastStoreDoc, setLastStoreDoc] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [lastWineDoc, setLastWineDoc] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [hasMoreStores, setHasMoreStores] = useState(true);
  const [hasMoreWines, setHasMoreWines] = useState(true);

  const fetchProfile = async (uid: string, email: string) => {
    const docPath = `users/${uid}`;
    try {
      const docRef = doc(db, 'users', uid);
      const docSnap = await getDoc(docRef);
      let profile: UserProfile;

      if (docSnap.exists()) {
        profile = docSnap.data() as UserProfile;
      } else {
        profile = {
          uid,
          email,
          name: email.split('@')[0],
          role: 'customer' // Default to safest role for production
        };
        await setDoc(docRef, profile);
      }
      setUser(profile);

      // --- Sync Custom Claims for Enterprise-grade performance ---
      const idTokenResult = await auth.currentUser?.getIdTokenResult();
      if (idTokenResult?.claims.role !== profile.role) {
        console.log(`[Enterprise] Syncing role claims for ${profile.role}...`);
        const idToken = await auth.currentUser?.getIdToken();
        await fetch('/api/auth/sync-claims', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${idToken}` 
          }
        });
        await auth.currentUser?.getIdToken(true); // Refresh token
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, docPath);
    }
  };

  const refreshWines = async (isNext: boolean = false, limitCount: number = 20) => {
    const path = 'winesMaster';
    try {
      let q = query(collection(db, 'winesMaster'), limit(limitCount));
      
      if (isNext && lastWineDoc) {
        q = query(collection(db, 'winesMaster'), startAfter(lastWineDoc), limit(limitCount));
      }

      const querySnapshot = await getDocs(q);
      const fetchedWines = querySnapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as object) } as WineMaster));
      
      if (isNext) {
        setWines(prev => [...prev, ...fetchedWines]);
      } else {
        setWines(fetchedWines);
      }

      setLastWineDoc(querySnapshot.docs[querySnapshot.docs.length - 1] || null);
      setHasMoreWines(querySnapshot.docs.length === limitCount);
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  };

  const searchMasterWines = async (term: string) => {
    if (!term) {
      refreshWines(false);
      return;
    }
    setLoading(true);
    try {
      // Basic prefix search (case sensitive and limited in Firestore, better to use multiple queries or separate search index)
      // Here we simulate by searching for ID match first, then filtering if small or just communicating limit
      const q = query(collection(db, 'winesMaster'), where('name_jp', '>=', term), where('name_jp', '<=', term + '\uf8ff'), limit(20));
      const snap = await getDocs(q);
      const results = snap.docs.map(d => ({ id: d.id, ...d.data() } as WineMaster));
      setWines(results);
      setHasMoreWines(false);
    } catch (error) {
      console.error("Search error:", error);
    } finally {
      setLoading(false);
    }
  };

  const refreshStores = async (isNext: boolean = false, limitCount: number = 20) => {
    if (!user) return;
    const path = 'stores';
    try {
      let q;
      const constraints = [];
      
      if (user.role === 'rep') {
        constraints.push(where('repId', '==', user.uid));
      } else if (user.role === 'owner' && user.storeId) {
        constraints.push(where('id', '==', user.storeId));
      }
      
      constraints.push(limit(limitCount));
      if (isNext && lastStoreDoc) {
        constraints.push(startAfter(lastStoreDoc));
      }

      q = query(collection(db, 'stores'), ...constraints);

      const querySnapshot = await getDocs(q);
      const fetchedStores = querySnapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as object) } as Store));
      
      if (isNext) {
        setStores(prev => [...prev, ...fetchedStores]);
      } else {
        setStores(fetchedStores);
      }

      setLastStoreDoc(querySnapshot.docs[querySnapshot.docs.length - 1] || null);
      setHasMoreStores(querySnapshot.docs.length === limitCount);
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        await fetchProfile(firebaseUser.uid, firebaseUser.email || '');
      } else {
        setUser(null);
        setStores([]);
        setWines([]);
        setLastStoreDoc(null);
        setLastWineDoc(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (user) {
      refreshStores(false);
      refreshWines(false);
    }
  }, [user]);

  const contextValue = React.useMemo(() => ({
    wines,
    setWines,
    user,
    loading,
    stores,
    refreshStores,
    refreshWines,
    searchMasterWines,
    hasMoreStores,
    hasMoreWines
  }), [wines, user, loading, stores, hasMoreStores, hasMoreWines]);

  return (
    <WineContext.Provider value={contextValue}>
      {children}
    </WineContext.Provider>
  );
};

export const useWines = () => {
  const context = useContext(WineContext);
  if (!context) {
    throw new Error('useWines must be used within a WineProvider');
  }
  return context;
};
