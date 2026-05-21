import { 
  collection, 
  query, 
  where, 
  getDocs, 
  getDoc,
  doc,
  updateDoc,
  deleteDoc,
  setDoc,
  limit, 
  startAfter, 
  QueryDocumentSnapshot, 
  DocumentData,
  orderBy
} from 'firebase/firestore';
import { db } from '../firebase';
import { Store, UserProfile, WineMaster } from '../../types';
import { PaginatedResult } from './wineRepository';

export const storeRepository = {
  async getStores(user: UserProfile, pageSize: number = 12, lastDoc?: QueryDocumentSnapshot<DocumentData> | null): Promise<PaginatedResult<Store>> {
    const constraints: any[] = [orderBy('name'), limit(pageSize)];
    
    if (user.role === 'rep') {
      constraints.push(where('repId', '==', user.uid));
    } else if (user.role === 'owner' && user.storeId) {
      constraints.push(where('id', '==', user.storeId));
    }

    if (lastDoc) {
      constraints.push(startAfter(lastDoc));
    }

    const q = query(collection(db, 'stores'), ...constraints);
    const snapshot = await getDocs(q);
    
    const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Store));
    const lastVisible = snapshot.docs[snapshot.docs.length - 1] || null;
    
    return {
      data,
      lastDoc: lastVisible,
      hasMore: snapshot.docs.length === pageSize
    };
  },

  async getStoreById(id: string): Promise<Store | null> {
    const d = await getDoc(doc(db, 'stores', id));
    if (!d.exists()) return null;
    return { id: d.id, ...d.data() } as Store;
  },

  async getStoreInventory(storeId: string): Promise<any[]> {
    const q = query(collection(db, 'stores', storeId, 'inventory'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ ...d.data(), id: d.id }));
  },

  async invalidateServerCache(storeId: string): Promise<void> {
    try {
      await fetch(`/api/menu/${storeId}/invalidate`, { method: 'POST' });
    } catch (e) {
      console.warn('[Cache Invalidation] Failed to contact Express cache buster:', e);
    }
  },

  async updateStore(storeId: string, data: Partial<Store>): Promise<void> {
    const d = doc(db, 'stores', storeId);
    await updateDoc(d, data);
    this.invalidateServerCache(storeId).catch(() => {});
  },

  async updateInventoryItem(storeId: string, itemId: string, data: any): Promise<void> {
    const d = doc(db, 'stores', storeId, 'inventory', itemId);
    await updateDoc(d, data);
    this.invalidateServerCache(storeId).catch(() => {});
  },

  async deleteInventoryItem(storeId: string, itemId: string): Promise<void> {
    const d = doc(db, 'stores', storeId, 'inventory', itemId);
    await deleteDoc(d);
    this.invalidateServerCache(storeId).catch(() => {});
  },

  async addInventoryItem(storeId: string, itemId: string, data: any): Promise<void> {
    const d = doc(db, 'stores', storeId, 'inventory', itemId);
    await setDoc(d, data);
    this.invalidateServerCache(storeId).catch(() => {});
  }
};
