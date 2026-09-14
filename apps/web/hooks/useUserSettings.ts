'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { doc, onSnapshot, setDoc, collection, addDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { CAPABILITY_DEFAULTS } from '@/lib/capabilities';
import type { User } from 'firebase/auth';

export interface ModelConfig {
  provider: 'platform' | 'openai' | 'anthropic';
  model: string;
  openaiKey?: string;
  anthropicKey?: string;
}

export interface Preset {
  id: string;
  label: string;   // short chip label, e.g. "8th-grade diction"
  text: string;    // the directive injected into the prompt
}

export interface UserSettings {
  personalContext: string;
  responseStyle: 'normal' | 'concise' | 'formal' | 'learning' | 'explanatory' | 'custom';
  customStyle: string;
  // Reusable prompt directives the user can toggle on next to the model picker.
  presets: Preset[];
  // When true, decorative animations/transitions are neutralised app-wide.
  reduceMotion: boolean;
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
    // User's drag-reordered dashboard widget order (keys from DASHBOARD_WIDGETS).
    // Empty = fall back to the default order. Unknown/new keys are appended.
    dashboardOrder?: string[];
  };
}

export interface Memory {
  id: string;
  content: string;
  source: 'manual' | 'generated' | 'onboarding';
  createdAt: Date;
}

// Sensible starter presets seeded from Jeremiah's known writing preferences.
// Users can edit or delete these in Settings → General.
export const DEFAULT_PRESETS: Preset[] = [
  { id: 'no-dashes', label: 'No em dashes / Oxford commas', text: 'Do not use em dashes or Oxford commas anywhere in the response.' },
  { id: 'no-emoji', label: 'No emoji', text: 'Do not use any emoji in the response.' },
  { id: 'grade-8', label: '8th-grade diction', text: 'Write at an 8th-grade reading level: plain words, short sentences, no jargon.' },
];

const DEFAULT_SETTINGS: UserSettings = {
  personalContext: '',
  responseStyle: 'normal',
  customStyle: '',
  presets: DEFAULT_PRESETS,
  reduceMotion: false,
  helpImprove: false,
  dataRetention: false,
  generateMemoryFromChat: false,
  briefingHour: 7,
  briefingTimezone: 'UTC',
  reflectionHour: 21,
  // Shared with the server (the briefing cron reads the same defaults) so the
  // Settings toggle and the job that acts on it cannot disagree again.
  capabilities: { ...CAPABILITY_DEFAULTS },
  sidebar: { hidden: [], workspaceCollapsed: false },
  layout: { dashboardHidden: [], briefingHidden: [], dashboardOrder: [] },
};

export function useUserSettings(user: User | null) {
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [plan, setPlan] = useState<'free' | 'modus' | 'pilot' | 'group'>('free');
  const [usage, setUsage] = useState({ dailyMessages: 0, usageDate: '', windowTokens: 0, windowStart: 0, weeklyTokens: 0, tokenWeek: '', limitAddonQty: 0 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const uid = user?.uid ?? null;
  const currentUid = useRef(uid);
  currentUid.current = uid;
  const [loadedUid, setLoadedUid] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    setSettings(DEFAULT_SETTINGS);
    setMemories([]);
    setPlan('free');
    setUsage({ dailyMessages: 0, usageDate: '', windowTokens: 0, windowStart: 0, weeklyTokens: 0, tokenWeek: '', limitAddonQty: 0 });
    setSaving(false);
    setError('');
    setLoading(!!uid);
    setLoadedUid(null);
    if (!uid) return;
    let cancelled = false;
    let accountReady = false;
    let memoriesReady = false;
    const finish = () => {
      if (!cancelled && accountReady && memoriesReady) { setLoadedUid(uid); setLoading(false); }
    };
    const accountStop = onSnapshot(doc(db, 'users', uid), userDoc => {
      if (cancelled) return;
      const data = userDoc.data() ?? {};
      setSettings({
        ...DEFAULT_SETTINGS, ...data.settings,
        capabilities: { ...DEFAULT_SETTINGS.capabilities, ...data.settings?.capabilities },
        sidebar: { ...DEFAULT_SETTINGS.sidebar!, ...data.settings?.sidebar },
        layout: { ...DEFAULT_SETTINGS.layout!, ...data.settings?.layout },
      });
      setPlan(data.plan === 'modus' || data.plan === 'pilot' || data.plan === 'group' ? data.plan : 'free');
      setUsage({ dailyMessages: data.dailyMessages ?? 0, usageDate: data.usageDate ?? '', windowTokens: data.windowTokens ?? 0, windowStart: data.windowStart ?? 0, weeklyTokens: data.weeklyTokens ?? 0, tokenWeek: data.tokenWeek ?? '', limitAddonQty: data.limitAddonQty ?? 0 });
      accountReady = true;
      finish();
    }, () => {
      if (cancelled) return;
      setError('Could not load account settings. Reload to retry.');
      accountReady = true;
      finish();
    });
    const memoriesStop = onSnapshot(collection(db, 'users', uid, 'memories'), snap => {
      if (cancelled) return;
      setMemories(snap.docs.map(d => ({
        id: d.id, content: d.data().content as string,
        source: (d.data().source as Memory['source']) ?? 'manual',
        createdAt: d.data().createdAt?.toDate() ?? new Date(),
      })).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()));
      memoriesReady = true;
      finish();
    }, () => {
      if (cancelled) return;
      setError('Could not load memories. Reload to retry.');
      memoriesReady = true;
      finish();
    });
    return () => { cancelled = true; accountStop(); memoriesStop(); };
  }, [uid]);

  const saveSettings = useCallback(async (updates: Partial<UserSettings>) => {
    if (!user) return;
    setSaving(true);
    setError('');
    try {
      // Only write the fields changed by this action. A second tab or a usage
      // update must not overwrite an unrelated preference with a stale copy.
      await setDoc(doc(db, 'users', user.uid), { settings: updates }, { merge: true });
    } catch (error) {
      if (currentUid.current === user.uid) setError('Could not save settings. Please retry.');
      throw error;
    } finally {
      if (currentUid.current === user.uid) setSaving(false);
    }
  }, [user]);

  const addMemory = useCallback(async (content: string) => {
    if (!user || !content.trim()) return;
    await addDoc(collection(db, 'users', user.uid, 'memories'), {
      content: content.trim(),
      source: 'manual',
      createdAt: serverTimestamp(),
    });


    // Upsert to Pinecone (fire and forget)
    void user.getIdToken().then(token =>
      fetch('/api/memory/upsert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ text: content.trim() }),
      })
    ).catch(e => console.error('[addMemory] Pinecone upsert failed:', e));
  }, [user]);

  const deleteMemory = useCallback(async (id: string) => {
    if (!user) return;
    await deleteDoc(doc(db, 'users', user.uid, 'memories', id));

  }, [user]);

  // Clears every memory (Firestore + Pinecone) via the API, then empties the
  // local list so the UI reflects the wipe immediately instead of showing stale
  // memories until the next reload. Throws on failure so the caller can alert.
  const clearMemories = useCallback(async () => {
    if (!user) return;
    const token = await user.getIdToken();
    const res = await fetch('/api/memory/clear', {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error('Failed to clear memories');
    if (currentUid.current === user.uid) setMemories([]);
  }, [user]);

  /**
   * Delete everything MODUS Desktop has synced for a source.
   *
   * Only durable because the ingest route refuses a source whose capability is
   * off — otherwise the Mac app repopulates it on the next 5-minute tick. Turn
   * the toggle off first, then clear.
   */
  const clearSyncedData = useCallback(async (sources: ('notes' | 'messages')[]) => {
    if (!user || sources.length === 0) return 0;
    const token = await user.getIdToken();
    const res = await fetch(`/api/desktop/clear?sources=${sources.join(',')}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error('Failed to clear synced data');
    const json = (await res.json()) as { cleared?: Record<string, number> };
    return Object.values(json.cleared ?? {}).reduce((a, b) => a + b, 0);
  }, [user]);

  const ready = uid === loadedUid;
  return { settings: ready ? settings : DEFAULT_SETTINGS, memories: ready ? memories : [], plan: ready ? plan : 'free' as const, usage: ready ? usage : { dailyMessages: 0, usageDate: '', windowTokens: 0, windowStart: 0, weeklyTokens: 0, tokenWeek: '', limitAddonQty: 0 }, loading: loading || (!!uid && !ready), error, saving, saveSettings, addMemory, deleteMemory, clearMemories, clearSyncedData };
}
