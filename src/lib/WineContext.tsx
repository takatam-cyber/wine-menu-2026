import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { WineMaster, UserProfile, Role, Store } from '../types';
import { auth, db, onAuthStateChanged } from './firebase';
import { doc, getDoc, setDoc, collection, query, where, getDocs, limit, startAfter, QueryDocumentSnapshot, DocumentData } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from './firestore-errors';

interface WineContextType {
  user: UserProfile | null;
  loading: boolean;
}

const WineContext = createContext<WineContextType | undefined>(undefined);

export const WineProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

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
          role: 'customer'
        };
        await setDoc(docRef, profile);
      }
      setUser(profile);
      
      const idTokenResult = await auth.currentUser?.getIdTokenResult();
      if (!idTokenResult?.claims.role || idTokenResult?.claims.role !== profile.role) {
        setLoading(true);
        console.log(`[Enterprise] Syncing role claims for ${profile.role}...`);
        const idToken = await auth.currentUser?.getIdToken();
        await fetch('/api/auth/sync-claims', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${idToken}` 
          }
        });
        await auth.currentUser?.getIdToken(true);
        console.log('[Enterprise] Claims synced and token refreshed.');
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, docPath);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        await fetchProfile(firebaseUser.uid, firebaseUser.email || '');
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
  }), [user, loading]);

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
