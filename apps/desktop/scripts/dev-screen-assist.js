/**
 * Run Screen Assist against the real app, without disturbing the installed one.
 *
 *   cd apps/desktop && npm run dev:assist
 *
 * Boots the REAL windows.ts / overlay.ts / capture.ts / assist.ts — the shipping
 * code, not a mock — but skips the tray, the sync scheduler and the
 * single-instance lock, so it can run side by side with the MODUS Desktop in
 * /Applications instead of fighting it for the lock.
 *
 * 🪤 TWO THINGS THIS EXISTS TO GET RIGHT, both of which bit during development:
 *
 *   1. It must live INSIDE apps/desktop. A copy of this script anywhere else
 *      (a temp dir, the Desktop) cannot resolve `electron-log` or any other
 *      dependency, and Electron reports that as a main-process crash dialog —
 *      which reads like the app is broken when it is only the runner that is.
 *   2. `--user-data-dir` does NOT isolate Electron's single-instance lock. Only
 *      app.setPath('userData', …) before ready does, which is why that happens at
 *      the top of this file rather than on the command line.
 *
 * The dev profile is seeded from a COPY of the real one on first run, so the
 * window is already signed in and getIdToken() works. Copy, never move — the
 * installed app keeps its own profile untouched.
 */
const path = require('path');
const fs = require('fs');
const { app, globalShortcut } = require('electron');

const REAL_PROFILE = path.join(app.getPath('appData'), 'modus-desktop');
const DEV_PROFILE = path.join(app.getPath('appData'), 'modus-desktop-dev');

if (!fs.existsSync(DEV_PROFILE) && fs.existsSync(REAL_PROFILE)) {
  console.log('[dev:assist] seeding dev profile from the installed app (one time)…');
  try {
    fs.cpSync(REAL_PROFILE, DEV_PROFILE, { recursive: true });
  } catch (err) {
    console.warn('[dev:assist] could not copy the profile — you will need to sign in:', err.message);
  }
}
// Before ready, and before anything reads a path off the app.
app.setPath('userData', DEV_PROFILE);

const log = require('electron-log');
log.initialize();

app.whenReady().then(async () => {
  const { createMainWindow } = require('../dist/main/windows');
  const { openOverlay, destroyOverlay } = require('../dist/main/screen/overlay');
  const { registerScreenAssistHotkeys } = require('../dist/main/screen/hotkeys');
  const { getScreenAssist } = require('../dist/main/settings');
  const { screenPermission } = require('../dist/main/screen/capture');
  // The REAL tray, so the Screen Assist menu items can be seen and clicked.
  // Without this the dev runner silently skipped the entire menu-bar surface,
  // which meant those items shipped unverified — you cannot review a menu you
  // have never rendered. A second MODUS icon appears next to the installed app's
  // while this runs; the right-hand one is the dev build.
  const { createTray } = require('../dist/main/tray');

  console.log(`[dev:assist] profile: ${DEV_PROFILE}`);
  console.log(`[dev:assist] screen recording permission: ${screenPermission()}`);

  // The signed-in window is where getIdToken() reads the Firebase token from, so
  // Screen Assist genuinely cannot work without it.
  await createMainWindow();
  console.log('[dev:assist] main window ready');

  createTray();

  // The SAME registration the shipping app runs — not a re-implementation.
  registerScreenAssistHotkeys();
  const { hotkey, regionHotkey } = getScreenAssist();
  console.log(`[dev:assist] ${hotkey} toggles the panel · ${regionHotkey} selects an area`);
  console.log('[dev:assist] (check the log above for either being taken by another app)');

  await openOverlay();

  app.on('will-quit', () => {
    globalShortcut.unregisterAll();
    destroyOverlay();
  });
}).catch((err) => {
  console.error('[dev:assist] STARTUP FAILED', err);
  app.exit(1);
});
