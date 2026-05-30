import { initializeApp, getApps, getApp } from 'firebase/app';
// getReactNativePersistence ships in Firebase's React Native bundle, but it is
// missing from the package's default type exports, so we silence the type-only
// error here. At runtime (with package exports disabled in metro.config.js) the
// React Native build resolves correctly and the function exists.
// @ts-ignore
import { initializeAuth, getAuth, getReactNativePersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Auth } from 'firebase/auth';

const firebaseConfig = {
  apiKey:            'AIzaSyCVASdBpNKIfmLG7Dw73SLoCCAqIMSqLXo',
  authDomain:        'modus-pilot.firebaseapp.com',
  projectId:         'modus-pilot',
  storageBucket:     'modus-pilot.firebasestorage.app',
  messagingSenderId: '208739557361',
  appId:             '1:208739557361:web:59cc5364fb808f77b52e50',
};

// initializeApp/initializeAuth must run exactly once per app instance. On Fast
// Refresh this module re-evaluates while the native app instance survives, so we
// branch on whether the Firebase app already exists.
const isNew = getApps().length === 0;
const app = isNew ? initializeApp(firebaseConfig) : getApp();

let auth: Auth;
if (isNew) {
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
  });
} else {
  auth = getAuth(app);
}

export { auth };
export const db = getFirestore(app);
