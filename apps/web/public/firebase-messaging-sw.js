importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: self.FIREBASE_API_KEY || '',
  authDomain: 'modus-pilot.firebaseapp.com',
  projectId: 'modus-pilot',
  storageBucket: 'modus-pilot.firebasestorage.app',
  messagingSenderId: '208739557361',
  appId: '1:208739557361:web:59cc5364fb808f77b52e50',
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage(payload => {
  const { title, body } = payload.notification ?? {};
  self.registration.showNotification(title ?? 'MODUS', {
    body: body ?? '',
    icon: '/icon-192.png',
    data: payload.data,
  });
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = event.notification.data?.link ?? '/briefing';
  event.waitUntil(clients.openWindow(url));
});
