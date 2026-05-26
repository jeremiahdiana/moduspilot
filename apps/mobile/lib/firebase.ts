import { initializeApp, getApps, getApp } from 'firebase/app';
import { initializeAuth, getAuth, inMemoryPersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Auth, Persistence } from 'firebase/auth';

// Metro resolves @firebase/auth to the React Native bundle which exports this.
// TypeScript picks the wrong bundle because the package puts "types" before
// "react-native" in its exports map, so we cast via require.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const _rn = require('@firebase/auth') as { getReactNativePersistence?: (s: typeof AsyncStorage) => Persistence };
const getReactNativePersistence = _rn.getReactNativePersistence;

const firebaseConfig = {
  apiKey:            'AIzaSyCVASdBpNKIfmLG7Dw73SLoCCAqIMSqLXo',
  authDomain:        'modus-pilot.firebaseapp.com',
  projectId:         'modus-pilot',
  storageBucket:     'modus-pilot.firebasestorage.app',
  messagingSenderId: '208739557361',
  appId:             '1:208739557361:web:59cc5364fb808f77b52e50',
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// initializeAuth must be called once; subsequent calls throw, so catch and fall back
let auth: Auth;
try {
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence
      ? getReactNativePersistence(AsyncStorage)
      : inMemoryPersistence,
  });
} catch {
  auth = getAuth(app);
}

export { auth };
export const db = getFirestore(app);
