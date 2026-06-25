import { app } from 'electron';
import log from 'electron-log';
import { createMainWindow, getMainWindow, showMainWindow } from './windows';
import { createTray, setSignedIn, runSync } from './tray';
import { startScheduler } from './sync/scheduler';
import { initLaunchAtLogin } from './settings';
import { getAuthState } from './sync/ingest';
import { pollNotifications } from './notifications';

const SYNC_INTERVAL_MS = 5 * 60 * 1000;    // background sync cadence
const AUTH_POLL_MS = 60 * 1000;            // how often we re-check sign-in state
const NOTIFICATION_POLL_MS = 60 * 1000;    // how often we check for new notifications

log.initialize();
log.info('[main] starting MODUS Desktop');

// Single instance — a second launch just focuses the existing window.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => showMainWindow());

  app.whenReady().then(async () => {
    initLaunchAtLogin();
    await createMainWindow();
    createTray();
    log.info('[main] MODUS Desktop ready');

    // Reflect sign-in state in the tray, and kick a sync the moment the user
    // transitions from signed-out to signed-in (instead of waiting for the next
    // scheduler tick). getAuthState reads the token from the signed-in window.
    let wasSignedIn = false;
    const refreshAuth = async (): Promise<void> => {
      const { signedIn, email } = await getAuthState();
      setSignedIn(signedIn, email);
      if (signedIn && !wasSignedIn) {
        runSync().catch((err) => log.error('[sync] post-login sync failed', err));
      }
      wasSignedIn = signedIn;
    };

    // Give the web app a few seconds to load + restore its session, then start
    // polling auth and the periodic sync.
    setTimeout(() => { refreshAuth().catch((err) => log.error('[auth] refresh failed', err)); }, 4000);
    setInterval(() => { refreshAuth().catch((err) => log.error('[auth] refresh failed', err)); }, AUTH_POLL_MS);

    startScheduler(SYNC_INTERVAL_MS, () => {
      runSync().catch((err) => log.error('[sync] scheduled sync failed', err));
    });

    // Poll for native desktop notifications (FCM web-push doesn't work in
    // Electron). No-ops until signed in.
    setInterval(() => {
      pollNotifications().catch((err) => log.error('[notifications] poll failed', err));
    }, NOTIFICATION_POLL_MS);
  });

  // Clicking the dock icon (app is not quit, just window hidden) reopens it.
  app.on('activate', () => {
    if (getMainWindow()) showMainWindow();
    else createMainWindow().catch((err) => log.error('[main] re-create window failed', err));
  });

  app.on('before-quit', () => {
    (app as unknown as { isQuitting?: boolean }).isQuitting = true;
  });

  // Tray app: closing the window hides it (handled in windows.ts), so this is a
  // no-op guard — never quit just because no window is visible.
  app.on('window-all-closed', () => { /* keep running in the tray */ });
}
