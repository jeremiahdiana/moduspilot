import { BrowserWindow } from 'electron';
import path from 'path';
import log from 'electron-log';
import { startLocalServer } from './localServer';

let bridgeWindow: BrowserWindow | null = null;

export async function createBridgeWindow(): Promise<BrowserWindow> {
  if (bridgeWindow) return bridgeWindow;

  bridgeWindow = new BrowserWindow({
    show: false,
    webPreferences: {
      // bridge.js runs as a preload script (not a <script src> page tag) so Node's
      // module system wraps it properly (module/exports/require all work) — a plain
      // browser script tag loading tsc's CommonJS output throws "exports is not defined".
      // contextIsolation:false shares preload's `window.modus*` globals with the page,
      // which is what main's executeJavaScript() calls below evaluate against.
      preload: path.join(__dirname, '../bridge/bridge.js'),
      contextIsolation: false,
      // Default preload sandbox only allows a small built-in module allowlist —
      // blocks `require('firebase/app')`. Safe to disable here: this window only
      // ever loads our own trusted local bridge/index.html, never remote content.
      sandbox: false,
    },
  });

  // signInWithPopup opens the Google consent screen via window.open(), which
  // Electron denies by default. Explicitly allow it for this trusted window.
  bridgeWindow.webContents.setWindowOpenHandler(() => ({ action: 'allow' }));

  // Tray app has no visible terminal for users — forward the bridge renderer's
  // console (including preload errors) into the same electron-log file.
  bridgeWindow.webContents.on('console-message', (_e, _level, message, line, sourceId) => {
    log.info(`[bridge-console] ${message} (${sourceId}:${line})`);
  });
  bridgeWindow.webContents.on('preload-error', (_e, preloadPath, error) => {
    log.error(`[bridge-preload-error] ${preloadPath}`, error);
  });

  const port = await startLocalServer();
  log.info(`[bridge] local auth server listening on http://localhost:${port}`);
  await bridgeWindow.loadURL(`http://localhost:${port}/`);

  return bridgeWindow;
}

export function getBridgeWindow(): BrowserWindow {
  if (!bridgeWindow) throw new Error('Bridge window not created yet');
  return bridgeWindow;
}
