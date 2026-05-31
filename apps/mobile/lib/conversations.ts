import {
  collection, query, orderBy, onSnapshot,
  addDoc, updateDoc, getDoc, doc, serverTimestamp,
} from 'firebase/firestore';
import { db } from './firebase';

/**
 * Chat persistence — same `users/{uid}/conversations` schema as the web app, so
 * conversations sync across web and iOS. Messages are stored as
 * { id, role, content }; briefing/check-in docs in the same collection are
 * filtered out of the chat history.
 */

export interface StoredMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ConvSummary {
  id: string;
  title: string;
  updatedAt: Date;
}

export function subscribeConversations(uid: string, cb: (convs: ConvSummary[]) => void) {
  const q = query(collection(db, 'users', uid, 'conversations'), orderBy('updatedAt', 'desc'));
  return onSnapshot(
    q,
    snap => {
      cb(
        snap.docs
          .filter(d => {
            const data = d.data();
            return data.deleted !== true && data.briefing !== true && data.checkin !== true;
          })
          .map(d => ({
            id: d.id,
            title: d.data().title || 'New chat',
            updatedAt: d.data().updatedAt?.toDate?.() ?? d.data().createdAt?.toDate?.() ?? new Date(),
          })),
      );
    },
    () => cb([]),
  );
}

export async function createConversation(uid: string, title: string): Promise<string> {
  const ref = await addDoc(collection(db, 'users', uid, 'conversations'), {
    title: title || 'New chat',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    deleted: false,
    messages: [],
  });
  return ref.id;
}

export async function saveMessages(
  uid: string,
  convId: string,
  messages: StoredMessage[],
  title?: string,
): Promise<void> {
  const update: Record<string, unknown> = {
    messages: messages.map(m => ({ id: m.id, role: m.role, content: m.content })),
    updatedAt: serverTimestamp(),
  };
  if (title) update.title = title;
  await updateDoc(doc(db, 'users', uid, 'conversations', convId), update);
}

export async function loadConversation(uid: string, convId: string): Promise<StoredMessage[]> {
  const snap = await getDoc(doc(db, 'users', uid, 'conversations', convId));
  return (snap.data()?.messages ?? []) as StoredMessage[];
}

export async function deleteConversation(uid: string, convId: string): Promise<void> {
  await updateDoc(doc(db, 'users', uid, 'conversations', convId), { deleted: true });
}

/** Derive a conversation title from the first user message. */
export function deriveTitle(messages: StoredMessage[]): string {
  const first = messages.find(m => m.role === 'user');
  if (!first) return 'New chat';
  const t = first.content.trim().replace(/\s+/g, ' ');
  return t.length > 44 ? t.slice(0, 44) + '…' : t || 'New chat';
}
