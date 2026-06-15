import {
  doc, getDoc, setDoc, collection, query, orderBy, onSnapshot,
  addDoc, deleteDoc, serverTimestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import { auth } from './firebase';
import { API_BASE, getAuthHeader } from './api';

/**
 * In-app settings — reads/writes the same `users/{uid}.settings` object and
 * `users/{uid}/memories` subcollection as the web app, so preferences stay in
 * sync across web and iOS.
 */

export interface ModelSettings {
  provider: 'platform' | 'groq' | 'openai' | 'anthropic';
  model?: string;
  openaiKey?: string;
  anthropicKey?: string;
}

export interface Capabilities {
  webSearch?: boolean;
  voiceInput?: boolean;
  dailyBriefing?: boolean;
  vectorMemory?: boolean;
  inboxTriage?: boolean;
  relationshipNurture?: boolean;
}

export interface UserSettings {
  personalContext?: string;
  responseStyle?: string;
  customStyle?: string;
  capabilities?: Capabilities;
  modelSettings?: ModelSettings;
  ttsVoice?: string;
}

export interface Memory {
  id: string;
  content: string;
  source: string;
  createdAt?: Date;
}

export async function getSettings(uid: string): Promise<UserSettings> {
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    return (snap.data()?.settings as UserSettings) ?? {};
  } catch {
    return {};
  }
}

/** Merge `updates` into existing settings and persist (matches web's saveSettings). */
export async function saveSettings(
  uid: string,
  current: UserSettings,
  updates: Partial<UserSettings>,
): Promise<UserSettings> {
  const next: UserSettings = {
    ...current,
    ...updates,
    capabilities: { ...current.capabilities, ...(updates.capabilities ?? {}) },
    modelSettings: updates.modelSettings
      ? { ...current.modelSettings, ...updates.modelSettings }
      : current.modelSettings,
  };
  await setDoc(doc(db, 'users', uid), { settings: next }, { merge: true });
  return next;
}

export function subscribeMemories(uid: string, cb: (memories: Memory[]) => void) {
  const q = query(collection(db, 'users', uid, 'memories'), orderBy('createdAt', 'desc'));
  return onSnapshot(
    q,
    snap => cb(snap.docs.map(d => ({
      id: d.id,
      content: d.data().content ?? '',
      source: d.data().source ?? 'manual',
      createdAt: d.data().createdAt?.toDate?.(),
    }))),
    () => cb([]),
  );
}

export async function addMemory(uid: string, content: string): Promise<void> {
  const text = content.trim();
  if (!text) return;
  await addDoc(collection(db, 'users', uid, 'memories'), {
    content: text,
    source: 'manual',
    createdAt: serverTimestamp(),
  });
  // Fire-and-forget Pinecone upsert via the web API (keeps vector memory in sync).
  try {
    const headers = await getAuthHeader();
    fetch(`${API_BASE}/api/memory/upsert`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify({ text }),
    }).catch(() => {});
  } catch {
    /* non-fatal */
  }
}

export async function deleteMemory(uid: string, id: string): Promise<void> {
  await deleteDoc(doc(db, 'users', uid, 'memories', id));
}

/** Convenience: current uid or null. */
export function currentUid(): string | null {
  return auth.currentUser?.uid ?? null;
}
