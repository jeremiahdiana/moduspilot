import { app } from 'electron';
import log from 'electron-log';
import { createBridgeWindow, getBridgeWindow } from './windows';
import { createTray, setCurrentUser, syncIfReady } from './tray';
import { startScheduler } from './sync/scheduler';

const SYNC_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes — Phase 0 has no UI to configure this yet.

log.initialize();
log.info('[main] starting MODUS Desktop');

app.whenReady().then(async () => {
  if (process.platform === 'darwin') {
    app.dock?.hide();
  }

  await createBridgeWindow();

  createTray();
  log.info('[main] MODUS Desktop ready (tray-only, no Dock icon)');

  // Restore an existing session on relaunch. Firebase Auth persists the session
  // in the bridge window's IndexedDB (stable across restarts now that the local
  // server uses a fixed port). modusWaitForUser awaits authStateReady() so we
  // don't race Firebase's async session restore (see bridge.ts).
  try {
    const existingUser = await getBridgeWindow().webContents.executeJavaScript('window.modusWaitForUser()');
    if (existingUser) {
      log.info('[auth] restored existing session for', existingUser.uid);
      setCurrentUser(existingUser);
      // Sync once immediately on launch — otherwise a freshly-opened app sits
      // idle until the first scheduler tick (up to SYNC_INTERVAL_MS later).
      syncIfReady().catch((err) => log.error('[sync] startup sync failed', err));
    } else {
      log.info('[auth] no persisted session — waiting for sign-in');
    }
  } catch (err) {
    log.error('[auth] failed to check existing session', err);
  }

  startScheduler(SYNC_INTERVAL_MS, () => {
    syncIfReady().catch((err) => log.error('[sync] scheduled sync failed', err));
  });
});

app.on('window-all-closed', () => {
  // Tray app — the only window is the hidden bridge window; never quit on close.
});
