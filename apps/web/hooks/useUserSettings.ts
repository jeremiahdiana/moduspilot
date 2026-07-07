'use client';

import { useState, useEffect, useCallback } from 'react';
import { doc, getDoc, setDoc, collection, getDocs, addDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { User } from 'firebase/auth';

export interface ModelConfig {
  provider: 'platform' | 'openai' | 'anthropic';
  model: string;
  openaiKey?: string;
  anthropicKey?: string;
}

export interface UserSettings {
  personalContext: string;
  responseStyle: 'normal' | 'concise' | 'formal' | 'learning' | 'explanatory' | 'custom';
  customStyle: string;
  helpImprove: boolean;
  dataRetention: boolean;
  generateMemoryFromChat: boolean;
  briefingHour: number;       // UTC hour (0-23) when daily briefing fires
  briefingTimezone: string;   // IANA timezone string e.g. "America/New_York"
  reflectionHour: number;     // Local hour (0-23) when end-of-day reflection fires
  modelSettings?: ModelConfig;
  capabilities: {
    dailyBriefing: boolean;
    voiceInput: boolean;
    vectorMemory: boolean;
    webSearch: boolean;
    inboxTriage: boolean;
    relationshipNurture: boolean;
    notesSync: boolean;
    messagesSync: boolean;
  };
  // Per-user sidebar customization (synced across web + desktop + iOS).
  // `hidden` = nav keys the user turned off; hidden items stay reachable via Cmd+K.
  sidebar?: {
    hidden: string[];
    workspaceCollapsed: boolean;
  };
  // Per-user in-app density control (synced across web + desktop + iOS).
  // `dashboardHidden`/`briefingHidden` = widget/section keys the user turned off.
  layout?: {
    dashboardHidden: string[];
    briefingHidden: string[];
  };
}

export interface Memory {
  id: string;
  content: string;
  source: 'manual' | 'generated';
  createdAt: Date;
}

const DEFAULT_SETTINGS: UserSettings = {
  personalContext: '',
  responseStyle: 'normal',
  customStyle: '',
  helpImprove: false,
  dataRetention: false,
  generateMemoryFromChat: false,
  briefingHour: 7,
  briefingTimezone: 'UTC',
  reflectionHour: 21,
  capabilities: {
    dailyBriefing: true,
    voiceInput: false,
    vectorMemory: false,
    webSearch: false,
    inboxTriage: true,
    relationshipNurture: true,
    notesSync: true,
    messagesSync: false,
  },
  sidebar: { hidden: [], workspaceCollapsed: false },
  layout: { dashboardHidden: [], briefingHidden: [] },
};

export function useUserSettings(user: User | null) {
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [plan, setPlan] = useState<'free' | 'modus' | 'pilot'>('free');
  const [usage, setUsage] = useState({ dailyMessages: 0, usageDate: '', dailyTokens: 0, tokenDate: '', weeklyTokens: 0, tokenWeek: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const uid = user?.uid ?? null;

  useEffect(() => {
    if (!uid) { setLoading(false); return; }
    let cancelled = false;

    const load = async () => {
      try {
        const userDoc = await getDoc(doc(db, 'users', uid));
        if (!cancelled && userDoc.exists()) {
          const data = userDoc.data();
          if (data.settings) {
            setSettings({
              ...DEFAULT_SETTINGS,
              ...data.settings,
              capabilities: { ...DEFAULT_SETTINGS.capabilities, ...data.settings?.capabilities },
              sidebar: { ...DEFAULT_SETTINGS.sidebar!, ...data.settings?.sidebar },
              layout: { ...DEFAULT_SETTINGS.layout!, ...data.settings?.layout },
            });
          }
          if (data.plan === 'modus' || data.plan === 'pilot') setPlan(data.plan);
          setUsage({ dailyMessages: data.dailyMessages ?? 0, usageDate: data.usageDate ?? '', dailyTokens: (data.dailyTokens as number) ?? 0, tokenDate: (data.tokenDate as string) ?? '', weeklyTokens: (data.weeklyTokens as number) ?? 0, tokenWeek: (data.tokenWeek as string) ?? '' });
        }

        const memSnap = await getDocs(collection(db, 'users', uid, 'memories'));
        if (!cancelled) {
          const mems: Memory[] = memSnap.docs.map(d => ({
            id: d.id,
            content: d.data().content as string,
            source: (d.data().source as 'manual' | 'generated') ?? 'manual',
            createdAt: d.data().createdAt?.toDate() ?? new Date(),
          }));
          setMemories(mems.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()));
        }
      } catch (e) {
        console.error('[useUserSettings] load error', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [uid]);

  const saveSettings = useCallback(async (updates: Partial<UserSettings>) => {
    if (!user) return;
    setSaving(true);
    try {
      const next = {
        ...settings,
        ...updates,
        capabilities: { ...settings.capabilities, ...(updates.capabilities ?? {}) },
        sidebar: {
          hidden: updates.sidebar?.hidden ?? settings.sidebar?.hidden ?? [],
          workspaceCollapsed: updates.sidebar?.workspaceCollapsed ?? settings.sidebar?.workspaceCollapsed ?? false,
        },
        layout: {
          dashboardHidden: updates.layout?.dashboardHidden ?? settings.layout?.dashboardHidden ?? [],
          briefingHidden: updates.layout?.briefingHidden ?? settings.layout?.briefingHidden ?? [],
        },
      };
      setSettings(next);
      await setDoc(doc(db, 'users', user.uid), { settings: next }, { merge: true });
    } finally {
      setSaving(false);
    }
  }, [user, settings]);

  const addMemory = useCallback(async (content: string) => {
    if (!user || !content.trim()) return;
    const ref = await addDoc(collection(db, 'users', user.uid, 'memories'), {
      content: content.trim(),
      source: 'manual',
      createdAt: serverTimestamp(),
    });
    setMemories(prev => [{ id: ref.id, content: content.trim(), source: 'manual', createdAt: new Date() }, ...prev]);

    // Upsert to Pinecone (fire and forget)
    user.getIdToken().then(token =>
      fetch('/api/memory/upsert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ text: content.trim() }),
      }).catch(e => console.error('[addMemory] Pinecone upsert failed:', e))
    );
  }, [user]);

  const deleteMemory = useCallback(async (id: string) => {
    if (!user) return;
    await deleteDoc(doc(db, 'users', user.uid, 'memories', id));
    setMemories(prev => prev.filter(m => m.id !== id));
  }, [user]);

  return { settings, memories, plan, usage, loading, saving, saveSettings, addMemory, deleteMemory };
}
