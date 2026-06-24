import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, type User } from 'firebase/auth';
import { initializeFirestore, doc, setDoc, writeBatch, collection, serverTimestamp, Timestamp } from 'firebase/firestore';
import type { ConversationRecord, NoteRecord, SignedInUser } from '../shared/types';

// Same Firebase project as apps/web and apps/mobile. These are the public
// client-side config values (already shipped in the web bundle) — not secrets.
const firebaseConfig = {
  apiKey: 'AIzaSyCVASdBpNKIfmLG7Dw73SLoCCAqIMSqLXo',
  authDomain: 'modus-pilot.firebaseapp.com',
  projectId: 'modus-pilot',
  storageBucket: 'modus-pilot.firebasestorage.app',
  messagingSenderId: '208739557361',
  appId: '1:208739557361:web:59cc5364fb808f77b52e50',
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
// Firebase 11.x has a fatal Firestore assertion bug (see apps/web) — stay on 10.x SDK.
const db = initializeFirestore(app, { experimentalForceLongPolling: true });

declare global {
  interface Window {
    modusSignIn: () => Promise<SignedInUser | null>;
    modusSignOut: () => Promise<void>;
    modusGetUser: () => Promise<SignedInUser | null>;
    modusWriteTestDoc: (uid: string) => Promise<boolean>;
    modusWriteNotes: (uid: string, records: NoteRecord[]) => Promise<number>;
    modusWriteMessages: (uid: string, records: ConversationRecord[]) => Promise<number>;
  }
}

function toPlainUser(user: User | null): SignedInUser | null {
  if (!user) return null;
  return { uid: user.uid, email: user.email, displayName: user.displayName };
}

window.modusSignIn = async () => {
  const provider = new GoogleAuthProvider();
  const result = await signInWithPopup(auth, provider);
  return toPlainUser(result.user);
};

window.modusSignOut = async () => {
  await signOut(auth);
};

window.modusGetUser = async () => {
  return toPlainUser(auth.currentUser);
};

// Throwaway connectivity check — confirms auth + Firestore writes work end to end
// before any real connector exists. Safe to delete once a real sync path lands.
window.modusWriteTestDoc = async (uid: string) => {
  await setDoc(doc(db, 'users', uid, '_desktopPing', 'ping'), {
    pingedAt: serverTimestamp(),
    source: 'desktop',
  });
  return true;
};

// Mirrors apps/mobile's syncContactsToFirestore batching pattern.
window.modusWriteNotes = async (uid: string, records: NoteRecord[]) => {
  const notesCol = collection(db, 'users', uid, 'notes');
  const batch = writeBatch(db);
  for (const r of records) {
    batch.set(doc(notesCol, r.id), {
      title: r.title,
      body: r.body,
      folder: r.folder ?? null,
      source: r.source,
      modifiedAt: r.modifiedAt != null ? Timestamp.fromMillis(r.modifiedAt) : null,
      updatedAt: serverTimestamp(),
    });
  }
  await batch.commit();
  return records.length;
};

// Mirrors modusWriteNotes — one doc per conversation (thread), not per message.
window.modusWriteMessages = async (uid: string, records: ConversationRecord[]) => {
  const messagesCol = collection(db, 'users', uid, 'messages');
  const batch = writeBatch(db);
  for (const r of records) {
    batch.set(doc(messagesCol, r.id), {
      title: r.title,
      body: r.body,
      source: r.source,
      modifiedAt: r.modifiedAt != null ? Timestamp.fromMillis(r.modifiedAt) : null,
      updatedAt: serverTimestamp(),
    });
  }
  await batch.commit();
  return records.length;
};
