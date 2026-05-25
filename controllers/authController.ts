// controllers/authController.ts
import { Response } from "express";
import { authAdmin, dbAdmin, FieldValue } from "../lib/firebase-admin.js";
import { AuthenticatedRequest } from "../middleware/auth.js";

/**
 * 営業担当・システム管理者による個別ユーザーへのロール割り当て
 */
export const setRole = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { uid, role } = req.body;
    const caller = req.user;

    if (!caller) {
      return res.status(401).json({ error: "Unauthorized: No user context found" });
    }

    // 🚨 セキュリティ強化: 特権IDによる操作であっても、メール認証 (email_verified) が完了していることを絶対条件とする
    const isEmailVerified = caller.email_verified === true;
    const isSystemAdmin = isEmailVerified && (caller.role === "admin" || caller.email === "takatam40725@gmail.com");
    
    if (!isSystemAdmin) {
      return res.status(403).json({ error: "Forbidden: Verified admin access required for role management" });
    }

    // カスタムクレームの設定とFirestoreの同期
    await authAdmin.setCustomUserClaims(uid, { role });
    await dbAdmin.collection("users").doc(uid).set({ role }, { merge: true });
    
    res.json({ success: true, message: `Role ${role} assigned correctly to ${uid}.` });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * サインイン時、Firestoreの登録状態とドメイン、およびメール認証状態を検証してカスタムクレームを物理同期する
 */
export const syncClaims = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized: Missing user token context" });
    }

    const { uid, email, email_verified } = req.user;
    const userDoc = await dbAdmin.collection("users").doc(uid).get();
    
    let role = "customer";
    let storeId = null;
    let repId = null;
    let hasExplicitRole = false;

    // 1. データベース上の設定値をロード
    if (userDoc.exists) {
      const data = userDoc.data();
      const dbRole = data?.role;
      if (dbRole && dbRole !== "customer") {
        role = dbRole;
        hasExplicitRole = true;
      }
      storeId = data?.storeId || null;
      repId = data?.repId || null;
    }

    // 2. 厳格なセキュリティバリデーションゲート
    // 🚨 修正の核心: ドメインの一致だけでなく、Firebase側でメールリンクによる「本人の認証」が完了しているかを厳密にチェック
    const isEmailVerified = email_verified === true;
    const isSecureDomain = email && (email.endsWith("@pieroth.jp") || email === "takatam40725@gmail.com");

    if (isSecureDomain && isEmailVerified) {
      // 正規の管理者・営業ドメインかつ認証済みの場合は、明示的なロールがない限り最上位権限を付与
      if (!hasExplicitRole) {
        role = "admin";
      }
    } else {
      // 🚨 防御機構: 万が一メールアドレスが偽装（未認証）である、または対象外ドメインであるにもかかわらず、
      // データベースやリクエスト上で `admin` 権限を要求しようとした場合、強制的に `owner` または `customer` に降格（制限）させる
      if (role === "admin") {
        role = storeId ? "owner" : "customer"; 
        console.warn(`[Security Alert] Blocked unverified admin claim attempt for UID: ${uid}, Email: ${email}`);
      }
    }

    // 3. 最新のセキュアなクレームをFirebase Authに焼き付ける
    await authAdmin.setCustomUserClaims(uid, { role, storeId, repId });
    
    // 4. Firestore側のユーザーロールメタデータも確定値で補正
    if (userDoc.exists && userDoc.data()?.role !== role) {
      await dbAdmin.collection("users").doc(uid).set({ role }, { merge: true });
    } else if (!userDoc.exists) {
      await dbAdmin.collection("users").doc(uid).set({ 
        role, 
        email: email || "",
        createdAt: FieldValue.serverTimestamp()
      });
    }

    res.json({ success: true, role });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
