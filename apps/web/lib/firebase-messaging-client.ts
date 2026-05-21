'use client';

import { getMessaging, getToken } from 'firebase/messaging';
import { getApp } from 'firebase/app';
import { doc, setDoc } from 'firebase/firestore';
import { db } from './firebase';

export async function registerPushNotifications(uid: string): Promise<boolean> {
  try {
    if (typeof window === 'undefined') return false;
    if (!('serviceWorker' in navigator) || !('Notification' in window)) return false;

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return false;

    const sw = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
    const messaging = getMessaging(getApp());

    const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
    const token = await getToken(messaging, { vapidKey, serviceWorkerRegistration: sw });
    if (!token) return false;

    await setDoc(doc(db, 'users', uid, 'fcmTokens', token), {
      token,
      registeredAt: new Date().toISOString(),
      userAgent: navigator.userAgent,
    });

    return true;
  } catch (e) {
    console.error('[fcm-client] registerPushNotifications failed:', e);
    return false;
  }
}
