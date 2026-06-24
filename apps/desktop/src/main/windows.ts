import { BrowserWindow, app, shell } from 'electron';
import log from 'electron-log';

// The desktop app is just the real MODUS web app in a native window. The user
// signs in here once; the background sync agent pulls a fresh Firebase ID token
// from this signed-in page (window.__modusGetToken__, exposed by the web app
// when it sees the "MODUSDesktop" user agent) to authenticate its uploads.
//
// Enter at /login, not / (which is the marketing homepage): /login shows the
// sign-in form when signed out and auto-redirects to /dashboard when a
// persisted session exists — so the desktop always lands in the actual app.
const MODUS_URL = 'https://moduspilot.com/login';

let mainWindow: BrowserWindow | null = null;

export async function createMainWindow(): Promise<BrowserWindow> {
  if (mainWindow) return mainWindow;

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 820,
    minWidth: 880,
    minHeight: 600,
    show: false,
    title: 'MODUS',
    // Loading our own remote web app — keep Electron's secure defaults
    // (contextIsolation on, nodeIntegration off). The sync agent reads the
    // token via webContents.executeJavaScript against the page's main world,
    // so no preload or node exposure to remote content is needed.
    webPreferences: {},
  });

  // Tell the web app it's running inside the desktop shell so it exposes
  // window.__modusGetToken__. setUserAgent (vs a loadURL option) persists the
  // marker across in-app SPA navigations and all subsequent requests.
  const ua = `${mainWindow.webContents.getUserAgent()} MODUSDesktop/0.2`;
  mainWindow.webContents.setUserAgent(ua);

  // Firebase signInWithPopup (Google/Apple) opens an OAuth window via
  // window.open — allow those in-app; send any other external link to the
  // system browser instead of opening a rogue window.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/accounts\.google\.com|appleid\.apple\.com|firebaseapp\.com|moduspilot\.com|__\/auth/.test(url)) {
      return { action: 'allow' };
    }
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.once('ready-to-show', () => mainWindow?.show());

  // Closing the window keeps the app alive in the tray (background sync keeps
  // running). Only a real Quit (sets isQuitting) actually tears it down.
  mainWindow.on('close', (e) => {
    if (!(app as unknown as { isQuitting?: boolean }).isQuitting) {
      e.preventDefault();
      mainWindow?.hide();
    }
  });
  mainWindow.on('closed', () => { mainWindow = null; });

  // Forward the web app's console into the tray app's log file for debugging.
  mainWindow.webContents.on('console-message', (_e, _level, message, line, sourceId) => {
    log.info(`[web-console] ${message} (${sourceId}:${line})`);
  });

  await mainWindow.loadURL(MODUS_URL);
  log.info('[window] loaded MODUS web app');
  return mainWindow;
}

export function getMainWindow(): BrowserWindow | null {
  return mainWindow;
}

export function showMainWindow(): void {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}
