import { getMessaging } from 'firebase-admin/messaging';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from './firebase-admin';

/**
 * Push a notification to all of a user's devices. Web/Android register FCM
 * tokens (sent via Firebase Admin); the iOS app registers Expo push tokens
 * (sent via Expo's push service); the desktop app polls a persisted
 * notifications collection (FCM web-push service workers don't run in
 * Electron). All three sinks are best-effort and run in parallel.
 */
export async function sendPushToUser(
  uid: string,
  title: string,
  body: string,
  data?: Record<string, string>,
) {
  await Promise.allSettled([
    sendFcm(uid, title, body, data),
    sendExpo(uid, title, body, data),
    persistNotification(uid, title, body, data),
  ]);
}

// Store the notification so the desktop app (which can't receive FCM web-push)
// can poll + display it natively. Doubles as a notification history.
async function persistNotification(uid: string, title: string, body: string, data?: Record<string, string>) {
  try {
    await adminDb.collection('users').doc(uid).collection('notifications').add({
      title,
      body,
      data: data ?? {},
      seen: false,
      createdAt: FieldValue.serverTimestamp(),
    });
  } catch (e) {
    console.error('[fcm-admin] persistNotification failed:', e);
  }
}

async function sendFcm(uid: string, title: string, body: string, data?: Record<string, string>) {
  try {
    const tokensSnap = await adminDb.collection('users').doc(uid).collection('fcmTokens').get();
    if (tokensSnap.empty) return;

    const tokens = tokensSnap.docs.map(d => d.data().token as string).filter(Boolean);
    if (!tokens.length) return;

    const messaging = getMessaging();
    await Promise.allSettled(
      tokens.map(token =>
        messaging.send({
          token,
          notification: { title, body },
          data,
          webpush: {
            notification: { title, body, icon: '/icon-192.png' },
            fcmOptions: { link: '/briefing' },
          },
        }),
      ),
    );
  } catch (e) {
    console.error('[fcm-admin] sendFcm failed:', e);
  }
}

async function sendExpo(uid: string, title: string, body: string, data?: Record<string, string>) {
  try {
    const tokensSnap = await adminDb.collection('users').doc(uid).collection('expoPushTokens').get();
    if (tokensSnap.empty) return;

    const tokens = tokensSnap.docs.map(d => d.data().token as string).filter(Boolean);
    if (!tokens.length) return;

    // Expo accepts a batch of messages in a single request.
    const messages = tokens.map(to => ({ to, title, body, data, sound: 'default' as const }));
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify(messages),
    });
  } catch (e) {
    console.error('[fcm-admin] sendExpo failed:', e);
  }
}
