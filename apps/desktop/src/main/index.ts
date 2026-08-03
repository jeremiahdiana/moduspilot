import { app, globalShortcut } from 'electron';
import log from 'electron-log';
import { createMainWindow, getMainWindow, showMainWindow } from './windows';
import { createTray, setSignedIn, runSync } from './tray';
import { destroyOverlay } from './screen/overlay';
import { registerScreenAssistHotkeys } from './screen/hotkeys';
import { startScheduler } from './sync/scheduler';
import { initLaunchAtLogin } from './settings';
import { getAuthState } from './sync/ingest';
import { pollNotifications } from './notifications';
import { initAutoUpdate } from './updater';

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

  // Anything that throws in here used to take the whole app down silently: the
  // .then() had no .catch(), so the rejection vanished and everything after the
  // throw simply never ran. That is not hypothetical — it is what 0.1.0 did, and
  // it is why a laptop that woke with no network sat on a white window for days.
  app.whenReady().then(async () => {
    initLaunchAtLogin();

    // ORDER IS LOAD-BEARING: the tray and the updater come FIRST, and neither is
    // allowed to sit behind the window.
    //
    // In 0.1.0 `await createMainWindow()` was above these, and it did a bare
    // `await loadURL(https://moduspilot.com/login)` with no catch. Auto-launch at
    // login beats the network stack up, so the load rejected, createMainWindow
    // never returned, and createTray()/initAutoUpdate() never ran. The app was
    // left with no tray, no sync, and a white window — AND, because initAutoUpdate
    // was one of the casualties, it could never download the release that fixed
    // it. A broken window must never be able to disable the thing that repairs it.
    createTray();
    initAutoUpdate();
    registerScreenAssistHotkeys();

    // The window is now the only failure-tolerant step. Its own splash+retry keeps
    // it branded while the network comes up; this catch is the backstop for
    // anything else (a throw here must not kill sync, which is the real product).
    try {
      await createMainWindow();
    } catch (err) {
      log.error('[main] createMainWindow failed — tray + sync continue without it', err);
    }
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
  }).catch((err) => {
    // Without this the startup rejection was swallowed by Node and NOTHING was
    // written anywhere: the log showed "[main] starting MODUS Desktop" and then
    // silence, three launches in a row, with no error to search for. A startup
    // that can fail must say so.
    log.error('[main] STARTUP FAILED', err);
  });

  // Clicking the dock icon (app is not quit, just window hidden) reopens it.
  app.on('activate', () => {
    if (getMainWindow()) showMainWindow();
    else createMainWindow().catch((err) => log.error('[main] re-create window failed', err));
  });

  app.on('before-quit', () => {
    (app as unknown as { isQuitting?: boolean }).isQuitting = true;
    // A global shortcut is registered with the OS, not with the app. Leaving it
    // behind means the combo stays swallowed system-wide after MODUS is gone.
    globalShortcut.unregisterAll();
    // Tears down any in-flight assist request and stops watch mode. Nothing that
    // reads the screen may survive the app that owns it.
    destroyOverlay();
  });

  // Tray app: closing the window hides it (handled in windows.ts), so this is a
  // no-op guard — never quit just because no window is visible.
  app.on('window-all-closed', () => { /* keep running in the tray */ });
}
