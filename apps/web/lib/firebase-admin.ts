import { initializeApp, getApps, cert, getApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, type Transaction } from 'firebase-admin/firestore';

function getAdminApp() {
  if (getApps().length) return getApp();
  return initializeApp({
    credential: cert({
      projectId:   process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey:  process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

export const adminAuth = {
  verifyIdToken: (token: string) => getAuth(getAdminApp()).verifyIdToken(token),
  getUser: (uid: string) => getAuth(getAdminApp()).getUser(uid),
  createCustomToken: (uid: string) => getAuth(getAdminApp()).createCustomToken(uid),
  deleteUser: (uid: string) => getAuth(getAdminApp()).deleteUser(uid),
};
export const adminDb = {
  collection: (name: string) => getFirestore(getAdminApp()).collection(name),
  runTransaction: <T>(fn: (txn: Transaction) => Promise<T>) => getFirestore(getAdminApp()).runTransaction(fn),
  doc: (path: string) => getFirestore(getAdminApp()).doc(path),
  batch: () => getFirestore(getAdminApp()).batch(),
  // Recursively deletes a document and all of its subcollections.
  recursiveDelete: (path: string) => {
    const fs = getFirestore(getAdminApp());
    return fs.recursiveDelete(fs.doc(path));
  },
};
