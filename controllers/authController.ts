// controllers/authController.ts
import { RequestHandler } from "express";
import { authAdmin, dbAdmin, FieldValue } from "../lib/firebase-admin.js";

export const setRole: RequestHandler = async (req, res, next) => {
  try {
    const { uid, role } = req.body;
    const caller = (req as any).user;

    if (!caller) {
      res.status(401).json({ error: "Unauthorized: No user context found" });
      return;
    }

    const isEmailVerified = caller.email_verified === true;
    const isSystemAdmin = isEmailVerified && (caller.role === "admin" || caller.email === "takatam40725@gmail.com");
    
    if (!isSystemAdmin) {
      res.status(403).json({ error: "Forbidden: Verified admin access required for role management" });
      return;
    }

    await authAdmin.setCustomUserClaims(uid, { role });
    await dbAdmin.collection("users").doc(uid).set({ role }, { merge: true });
    
    res.json({ success: true, message: `Role ${role} assigned correctly to ${uid}.` });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const syncClaims: RequestHandler = async (req, res, next) => {
  try {
    const caller = (req as any).user;
    if (!caller) {
      res.status(401).json({ error: "Unauthorized: Missing user token context" });
      return;
    }

    const { uid, email, email_verified } = caller;
    const userDoc = await dbAdmin.collection("users").doc(uid).get();
    
    let role = "customer";
    let storeId = null;
    let repId = null;
    let hasExplicitRole = false;

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

    const isEmailVerified = email_verified === true;
    const isSecureDomain = email && (email.endsWith("@pieroth.jp") || email === "takatam40725@gmail.com");

    if (isSecureDomain && isEmailVerified) {
      if (!hasExplicitRole) {
        role = "admin";
      }
    } else {
      if (role === "admin") {
        role = storeId ? "owner" : "customer"; 
        console.warn(`[Security Alert] Blocked unverified admin claim attempt for UID: ${uid}, Email: ${email}`);
      }
    }

    await authAdmin.setCustomUserClaims(uid, { role, storeId, repId });
    
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
