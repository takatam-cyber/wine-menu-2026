import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { WineMaster, UserProfile, Role, Store } from '../types';
import { MASTER_WINES } from './wine-data';
import { auth, db, onAuthStateChanged } from './firebase';
import { doc, getDoc, setDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from './firestore-errors';

interface WineContextType {
  wines: WineMaster[];
  setWines: (wines: WineMaster[]) => void;
  user: UserProfile | null;
  loading: boolean;
  stores: Store[];
  refreshStores: () => Promise<void>;
}

const WineContext = createContext<WineContextType | undefined>(undefined);

export const WineProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [wines, setWines] = useState<WineMaster[]>(MASTER_WINES);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [stores, setStores] = useState<Store[]>([]);

  const fetchProfile = async (uid: string, email: string) => {
    const docPath = `users/${uid}`;
    try {
      const docRef = doc(db, 'users', uid);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        setUser(docSnap.data() as UserProfile);
      } else {
        // デフォルトは顧客(customer)として作成し、管理画面等でロールを昇格させる運用に変更
        const newProfile: UserProfile = {
          uid,
          email,
          name: email.split('@')[0],
          role: 'owner' // Sandbox環境のため、便宜上ownerをデフォルトにする
        };
        await setDoc(docRef, newProfile);
        setUser(newProfile);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, docPath);
    }
  };

  const refreshStores = async () => {
    if (!user) return;
    const path = 'stores';
    try {
      let q;
      if (user.role === 'rep') {
        q = query(collection(db, 'stores'), where('repId', '==', user.uid));
      } else if (user.role === 'owner' && user.storeId) {
        q = query(collection(db, 'stores'), where('id', '==', user.storeId));
      } else {
        q = query(collection(db, 'stores'));
      }

      const querySnapshot = await getDocs(q);
      const fetchedStores = querySnapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as object) } as Store));
      setStores(fetchedStores);
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
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (user) {
      refreshStores();
    }
  }, [user]);

  const contextValue = React.useMemo(() => ({
    wines,
    setWines,
    user,
    loading,
    stores,
    refreshStores
  }), [wines, user, loading, stores]);

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
