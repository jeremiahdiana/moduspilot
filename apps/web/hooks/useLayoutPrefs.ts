'use client';

import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';

/**
 * Live-subscribes to the user's in-app layout prefs (hidden dashboard widgets /
 * briefing sections + the briefing master toggle), stored in Firestore
 * users/{uid}.settings so they sync across web + desktop + iOS. Mirrors
 * useSidebarPrefs in app/(dashboard)/layout.tsx.
 */
export function useLayoutPrefs(uid: string | undefined) {
  const [dashboardHidden, setDashboardHidden] = useState<Set<string>>(new Set());
  const [briefingHidden, setBriefingHidden] = useState<Set<string>>(new Set());
  const [briefingEnabled, setBriefingEnabled] = useState(true); // default ON

  useEffect(() => {
    if (!uid) {
      setDashboardHidden(new Set());
      setBriefingHidden(new Set());
      setBriefingEnabled(true);
      return;
    }
    const unsub = onSnapshot(doc(db, 'users', uid), snap => {
      const s = snap.data()?.settings;
      const l = s?.layout;
      setDashboardHidden(new Set(Array.isArray(l?.dashboardHidden) ? l.dashboardHidden : []));
      setBriefingHidden(new Set(Array.isArray(l?.briefingHidden) ? l.briefingHidden : []));
      setBriefingEnabled(s?.capabilities?.dailyBriefing !== false);
    });
    return unsub;
  }, [uid]);

  return { dashboardHidden, briefingHidden, briefingEnabled };
}
