import { app } from 'electron';
import fs from 'fs';
import path from 'path';
import log from 'electron-log';

interface DesktopSettings {
  loginItemInitialized?: boolean;
}

function settingsFile(): string {
  return path.join(app.getPath('userData'), 'modus-settings.json');
}

function read(): DesktopSettings {
  try {
    return JSON.parse(fs.readFileSync(settingsFile(), 'utf8')) as DesktopSettings;
  } catch {
    return {};
  }
}

function write(s: DesktopSettings): void {
  try {
    fs.writeFileSync(settingsFile(), JSON.stringify(s));
  } catch (err) {
    log.error('[settings] failed to persist', err);
  }
}

// A background sync agent is only useful if it's actually running, so default
// to launching at login on the very first run. Only sets it once (tracked via
// a marker file) so it respects the user toggling it off later in the tray.
export function initLaunchAtLogin(): void {
  const s = read();
  if (s.loginItemInitialized) return;
  app.setLoginItemSettings({ openAtLogin: true });
  write({ ...s, loginItemInitialized: true });
  log.info('[settings] enabled launch-at-login by default (first run)');
}
