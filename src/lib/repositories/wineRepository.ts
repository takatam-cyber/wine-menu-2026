import { 
  collection, 
  query, 
  where, 
  getDocs, 
  limit, 
  startAfter, 
  doc, 
  getDoc, 
  QueryDocumentSnapshot, 
  DocumentData,
  orderBy
} from 'firebase/firestore';
import { db } from '../firebase';
import { WineMaster } from '../../types';

export interface PaginatedResult<T> {
  data: T[];
  lastDoc: QueryDocumentSnapshot<DocumentData> | null;
  hasMore: boolean;
}

export const wineRepository = {
  async getWinesMaster(pageSize: number = 20, lastDoc?: QueryDocumentSnapshot<DocumentData> | null): Promise<PaginatedResult<WineMaster>> {
    const constraints: any[] = [orderBy('name_jp'), limit(pageSize)];
    if (lastDoc) {
      constraints.push(startAfter(lastDoc));
    }

    const q = query(collection(db, 'winesMaster'), ...constraints);
    const snapshot = await getDocs(q);
    
    const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as WineMaster));
    const lastVisible = snapshot.docs[snapshot.docs.length - 1] || null;
    
    return {
      data,
      lastDoc: lastVisible,
      hasMore: snapshot.docs.length === pageSize
    };
  },

  async searchWinesMaster(term: string, pageSize: number = 20): Promise<WineMaster[]> {
    if (!term) return [];
    // Basic prefix search
    const q = query(
      collection(db, 'winesMaster'), 
      where('name_jp', '>=', term), 
      where('name_jp', '<=', term + '\uf8ff'), 
      limit(pageSize)
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as WineMaster));
  },

  async getWineById(id: string): Promise<WineMaster | null> {
    const d = await getDoc(doc(db, 'winesMaster', id));
    if (!d.exists()) return null;
    return { id: d.id, ...d.data() } as WineMaster;
  }
};
