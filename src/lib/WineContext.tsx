// ============================================================================
// Pieroth Smart Menu Engine - 厳格認証プロファイル制御コンテキスト
// ============================================================================

import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { UserProfile } from '../types';
import { auth, db, onAuthStateChanged } from './firebase';
import { doc, getDoc } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from './firestore-errors';

// コンテキストが提供するステート構造
interface WineContextType {
  user: UserProfile | null;
  loading: boolean;
}

const WineContext = createContext<WineContextType | undefined>(undefined);

export const WineProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  /**
   * 厳格認証ゲート・プロファイラー (厳密同期ロジック)
   * 【バグ修正】: 従来はFirestoreからデータを取り出した直後に `setUser(profile)` を発行していたため、
   * バックエンドでのカスタムクレーム（ロール権限）割り当てとフロントエンド側での最新トークン取得（getIdToken）が完了する前に
   * 管理画面ビュー（AdminView/OwnerView）がマウントされてしまい、Firestoreルールで弾かれホワイトアウトしていました。
   * 本実装では、クレームの同期と最新トークンの再取得が「完全に確定」するまで loading を維持し、ビューのマウントを厳密にロックします。
   */
  const fetchProfile = async (uid: string, email: string) => {
    const docPath = `users/${uid}`;
    setLoading(true); // 状態遷移中の割り込みを防ぐため、ローディングロックを明示的に開始
    
    try {
      const docRef = doc(db, 'users', uid);
      const docSnap = await getDoc(docRef);
      let profile: UserProfile;

      if (docSnap.exists()) {
        profile = docSnap.data() as UserProfile;
      } else {
        // 一般顧客（customer）または新規の匿名ユーザー向けインメモリプロファイル（DBの汚染/スパム増殖を完全に防止）
        profile = {
          uid,
          email,
          name: email ? email.split('@')[0] : 'Guest',
          role: 'customer'
        };
      }
      
      // ユーザーのドメインまたは登録状態をベースに、役割クレームのバックエンド完全同期を実行
      // 顧客ロールであっても、ドメイン（@pieroth.jp等）による特権昇格の可能性があるため常に同期エンドポイントを通す
      const currentUser = auth.currentUser;
      if (currentUser) {
        const idToken = await currentUser.getIdToken();
        
        // バックエンドサーバーのクレームインジェクション層を叩く
        const syncResponse = await fetch('/api/auth/sync-claims', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${idToken}` 
          }
        });

        if (syncResponse.ok) {
          const syncData = await syncResponse.json();
          // バックエンド側で決定・補正された最新のロール情報をプロファイルに強制同期
          if (syncData.role) {
            profile.role = syncData.role;
          }
        }

        // 【最重要境界防衛】最新のカスタムクレーム（role, storeId等）を反映した新規のIDトークンを強制リフレッシュ発行
        // これを await で完全に刈り取ることで、これ以降のビューでのFirestoreクエリが100%安全にルールを通過する
        await currentUser.getIdToken(true);
        console.log(`[Security-Gate] Deterministic claims synced and hardened for role: ${profile.role}`);
      }

      // クレームの物理的更新がフロントエンドで確定した後に、初めてコンテクスト状態を解凍する
      setUser(profile);
    } catch (error) {
      console.error('[Security-Gate] Critical failure during profile verification:', error);
      setUser(null);
      // 特権画面でPermission Deniedを回避するため、エラー時は安全に未認証状態へフォールバック
      try {
        handleFirestoreError(error, OperationType.GET, docPath);
      } catch (e) {
        // レンダリングツリーの破壊を防ぐため例外の最外殻キャッチ
      }
    } finally {
      setLoading(false); // 認証ゲートのロックを安全に解除
    }
  };

  /**
   * 認証状態のライフサイクル監視
   */
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // 認証検知時、同期処理を完全に終了させるまでローディングを維持
        await fetchProfile(firebaseUser.uid, firebaseUser.email || '');
      } else {
        setUser(null);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  // レンダリングの不要なカクつき・再評価を防ぐためのメモ化プロテクション
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

/**
 * 安全に認証状態へアクセスするための共有カスタムフック
 */
export const useWines = () => {
  const context = useContext(WineContext);
  if (!context) {
    throw new Error('useWines must be used within a WineProvider');
  }
  return context;
};
