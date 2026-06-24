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

  // Restore an existing session on relaunch — Firebase Auth persists via the
  // bridge window's normal Chromium session storage across app restarts.
  try {
    const existingUser = await getBridgeWindow().webContents.executeJavaScript('window.modusGetUser()');
    if (existingUser) {
      log.info('[auth] restored existing session for', existingUser.uid);
      setCurrentUser(existingUser);
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
