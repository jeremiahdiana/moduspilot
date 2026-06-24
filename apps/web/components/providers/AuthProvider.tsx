'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import type { User } from 'firebase/auth';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { registerPushNotifications } from '@/lib/firebase-messaging-client';

interface AuthCtx {
  user: User | null;
  loading: boolean;
}

const AuthContext = createContext<AuthCtx>({ user: null, loading: true });
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
      // Register push notifications silently after login (no-op if denied)
      if (u) registerPushNotifications(u.uid).catch(() => {});
    });
  }, []);

  useEffect(() => {
    // MODUS Desktop integration: the desktop app loads this site in a window
    // (userAgent marked "MODUSDesktop") and pulls a fresh Firebase ID token on
    // demand via webContents.executeJavaScript to authenticate its background
    // notes/iMessage sync — so the user signs in ONCE here, not separately in
    // the desktop agent. getIdToken() auto-refreshes an expired token.
    if (typeof navigator === 'undefined' || !navigator.userAgent.includes('MODUSDesktop')) return;
    (window as unknown as { __modusGetToken__?: () => Promise<string | null> }).__modusGetToken__ =
      () => (auth.currentUser ? auth.currentUser.getIdToken() : Promise.resolve(null));
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {loading ? (
        <div className="min-h-screen bg-bg flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-brand border-t-transparent rounded-full animate-spin" />
        </div>
      ) : children}
    </AuthContext.Provider>
  );
}
