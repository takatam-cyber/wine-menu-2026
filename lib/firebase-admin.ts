import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import { readFileSync } from "fs";
import path from "path";
import { google } from "googleapis";

const configPath = path.join(process.cwd(), "firebase-applet-config.json");
const firebaseConfig = JSON.parse(readFileSync(configPath, "utf-8"));

if (!admin.apps.length) {
  admin.initializeApp({
    projectId: firebaseConfig.projectId
  });
}

// Google Drive API setup
const auth = new google.auth.GoogleAuth({
  scopes: ["https://www.googleapis.com/auth/drive.readonly"]
});

export const drive = google.drive({ version: "v3", auth });
export const firebaseApp = admin.app();
export const dbAdmin = getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId);
export const authAdmin = admin.auth(firebaseApp);
export const FieldValue = admin.firestore.FieldValue;
export const FieldPath = admin.firestore.FieldPath;

export default admin;
