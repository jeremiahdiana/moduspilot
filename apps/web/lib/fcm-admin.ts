import { getMessaging } from 'firebase-admin/messaging';
import { adminDb } from './firebase-admin';

export async function sendPushToUser(
  uid: string,
  title: string,
  body: string,
  data?: Record<string, string>,
) {
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
            notification: {
              title,
              body,
              icon: '/icon-192.png',
            },
            fcmOptions: { link: '/briefing' },
          },
        }),
      ),
    );
  } catch (e) {
    console.error('[fcm-admin] sendPushToUser failed:', e);
  }
}
