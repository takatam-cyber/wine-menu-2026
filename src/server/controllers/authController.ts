import { Request, Response } from "express";
import admin from "firebase-admin";

export const authController = {
  async setRole(req: Request, res: Response) {
    try {
      const { uid, role } = req.body;
      const caller = (req as any).user;

      const isSystemAdmin = caller.role === "admin" || caller.email === "takatam40725@gmail.com";
      
      if (!isSystemAdmin) {
        return res.status(403).json({ error: "Forbidden: Admin access required for role management" });
      }

      await admin.auth().setCustomUserClaims(uid, { role });
      await admin.firestore().collection("users").doc(uid).set({ role }, { merge: true });
      res.json({ success: true, message: `Role ${role} assigned correctly to ${uid}.` });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },

  async syncClaims(req: Request, res: Response) {
    try {
      const { uid, email } = (req as any).user;
      const db = admin.firestore();
      const userDoc = await db.collection("users").doc(uid).get();
      
      let role = "customer";
      if (userDoc.exists) {
        role = userDoc.data()?.role || "customer";
      }

      if (email && (email.endsWith("@pieroth.jp") || email === "takatam40725@gmail.com")) {
        role = "admin";
      }

      await admin.auth().setCustomUserClaims(uid, { role });
      
      if (userDoc.exists && userDoc.data()?.role !== role) {
        await db.collection("users").doc(uid).set({ role }, { merge: true });
      } else if (!userDoc.exists) {
        await db.collection("users").doc(uid).set({ 
          role, 
          email: email || "",
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
      }

      res.json({ success: true, role });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
};
