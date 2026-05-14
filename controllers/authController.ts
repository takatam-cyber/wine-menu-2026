import { Response } from "express";
import { authAdmin, dbAdmin, FieldValue } from "../lib/firebase-admin.js";
import { AuthenticatedRequest } from "../middleware/auth.js";

export const setRole = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { uid, role } = req.body;
    const caller = req.user;

    const isSystemAdmin = caller.role === "admin" || caller.email === "takatam40725@gmail.com";
    
    if (!isSystemAdmin) {
      return res.status(403).json({ error: "Forbidden: Admin access required for role management" });
    }

    await authAdmin.setCustomUserClaims(uid, { role });
    await dbAdmin.collection("users").doc(uid).set({ role }, { merge: true });
    res.json({ success: true, message: `Role ${role} assigned correctly to ${uid}.` });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const syncClaims = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { uid, email } = req.user;
    const userDoc = await dbAdmin.collection("users").doc(uid).get();
    
    let role = "customer";
    if (userDoc.exists) {
      role = userDoc.data()?.role || "customer";
    }

    if (email && (email.endsWith("@pieroth.jp") || email === "takatam40725@gmail.com")) {
      role = "admin";
    }

    await authAdmin.setCustomUserClaims(uid, { role });
    
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
