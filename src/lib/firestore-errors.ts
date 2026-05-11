import { auth } from './firebase';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  
  // Professional mapping for user-facing messages
  let userFriendlyMessage = "通信に失敗しました。時間をおいて再度お試しください。";
  if (errorMessage.includes("insufficient permissions")) {
    userFriendlyMessage = "アクセス権限がありません。ログイン状態を確認してください。";
  } else if (errorMessage.includes("offline")) {
    userFriendlyMessage = "オフライン状態です。ネットワーク接続を確認してください。";
  } else if (errorMessage.includes("quota exceeded")) {
    userFriendlyMessage = "本日の利用制限（無料枠）に達しました。明日またお試しください。";
  }

  const errInfo: FirestoreErrorInfo = {
    error: errorMessage,
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  
  // Show user friendly alert in dev/prod
  if (typeof window !== 'undefined') {
    // We can use a custom toast if available, but for now console + re-throw
    console.warn("User Message:", userFriendlyMessage);
  }

  throw new Error(JSON.stringify(errInfo));
}
