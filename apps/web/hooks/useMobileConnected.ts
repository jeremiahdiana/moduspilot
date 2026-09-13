'use client';

import { useEffect, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';

/**
 * useMobileConnected — true once the user has the Modus phone app installed and
 * signed in. There is no explicit pairing flag: the mobile app writes a push
 * token to `users/{uid}/expoPushTokens` on launch (apps/mobile/lib/push.ts), so
 * a non-empty collection is the reliable "a phone is connected" signal. Goals
 * and Reminders (phone-sourced workspace surfaces) stay hidden until this is
 * true. Returns false while loading so nothing flashes in before we know.
 */
export function useMobileConnected(uid: string | undefined): boolean {
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!uid) { setConnected(false); return; }
    const unsub = onSnapshot(
      collection(db, 'users', uid, 'expoPushTokens'),
      snap => setConnected(!snap.empty),
      () => setConnected(false),
    );
    return unsub;
  }, [uid]);

  return connected;
}
