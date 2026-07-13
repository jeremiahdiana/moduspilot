'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  collection, query, orderBy, onSnapshot,
  addDoc, updateDoc, doc, serverTimestamp, Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Message } from 'ai';

export interface Conversation {
  id: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
  deleted: boolean;
  messages: Message[];
  shareId?: string;
  projectId?: string;
  goalId?: string;
  /** MODUS-generated (daily briefing, proactive nudge, check-in) vs. a real user chat. */
  system?: boolean;
}

export function useConversations(uid: string | null) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) { setLoading(false); return; }

    const q = query(
      collection(db, 'users', uid, 'conversations'),
      orderBy('updatedAt', 'desc'),
    );

    const unsub = onSnapshot(q, (snap) => {
      setConversations(
        snap.docs
          .map(d => ({
            id: d.id,
            title: d.data().title || 'New chat',
            createdAt: (d.data().createdAt as Timestamp)?.toDate() ?? new Date(),
            updatedAt: (d.data().updatedAt as Timestamp)?.toDate() ?? new Date(),
            deleted: d.data().deleted ?? false,
            messages: d.data().messages ?? [],
            shareId: d.data().shareId as string | undefined,
            projectId: d.data().projectId as string | undefined,
            goalId: d.data().goalId as string | undefined,
            system: !!(d.data().system || d.data().briefing || d.data().checkin),
          }))
          // Hide empty chats: a conversation is only created lazily on the first
          // message now, so any non-system chat with 0 messages is a stale ghost
          // (also cleans up ones created by the old eager-create behavior).
          .filter(c => !c.deleted && !c.projectId && !c.goalId && (c.system || c.messages.length > 0))
      );
      setLoading(false);
    }, (err) => {
      console.error('[useConversations] snapshot error:', err);
      setLoading(false);
    });

    return unsub;
  }, [uid]);

  const createConversation = useCallback(async (): Promise<string> => {
    if (!uid) return '';
    const ref = await addDoc(collection(db, 'users', uid, 'conversations'), {
      title: 'New chat',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      deleted: false,
      messages: [],
    });
    return ref.id;
  }, [uid]);

  const saveMessages = useCallback(async (convId: string, messages: Message[], title?: string) => {
    if (!uid || !convId) return;
    const update: Record<string, unknown> = {
      // Keep `annotations` when present (used to persist which model Auto routed
      // a message to, so the "routed this to <model>" chip survives a reload).
      messages: messages.map(m => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const annotations = (m as any).annotations;
        return annotations
          ? { id: m.id, role: m.role, content: m.content, annotations }
          : { id: m.id, role: m.role, content: m.content };
      }),
      updatedAt: serverTimestamp(),
    };
    if (title) update.title = title;
    await updateDoc(doc(db, 'users', uid, 'conversations', convId), update);
  }, [uid]);

  const renameConversation = useCallback(async (convId: string, title: string) => {
    if (!uid || !convId) return;
    await updateDoc(doc(db, 'users', uid, 'conversations', convId), { title: title.trim() || 'New chat' });
  }, [uid]);

  const deleteConversation = useCallback(async (convId: string) => {
    if (!uid) return;
    await updateDoc(doc(db, 'users', uid, 'conversations', convId), { deleted: true });
  }, [uid]);

  const restoreConversation = useCallback(async (convId: string) => {
    if (!uid) return;
    await updateDoc(doc(db, 'users', uid, 'conversations', convId), { deleted: false });
  }, [uid]);

  return { conversations, loading, createConversation, saveMessages, renameConversation, deleteConversation, restoreConversation };
}
