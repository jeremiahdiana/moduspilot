import { initializeApp, getApps, cert, getApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, type Transaction } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';

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

/**
 * Default Storage bucket for generated assets. Set FIREBASE_STORAGE_BUCKET if
 * the project uses a non-default bucket (newer projects use
 * `<projectId>.firebasestorage.app` rather than `<projectId>.appspot.com`).
 */
export function adminBucket() {
  const name = process.env.FIREBASE_STORAGE_BUCKET || `${process.env.FIREBASE_PROJECT_ID}.appspot.com`;
  return getStorage(getAdminApp()).bucket(name);
}

export const adminAuth = {
  verifyIdToken: (token: string) => getAuth(getAdminApp()).verifyIdToken(token),
  getUser: (uid: string) => getAuth(getAdminApp()).getUser(uid),
  getUserByEmail: (email: string) => getAuth(getAdminApp()).getUserByEmail(email),
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
