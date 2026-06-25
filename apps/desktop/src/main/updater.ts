import { app } from 'electron';
import { autoUpdater } from 'electron-updater';
import log from 'electron-log';

const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000; // re-check every 6 hours

// Checks GitHub Releases (configured in electron-builder.yml `publish`) for a
// newer signed+notarized build, downloads it in the background, and installs it
// on the next quit. No-ops in dev (electron-updater requires a packaged app).
export function initAutoUpdate(): void {
  if (!app.isPackaged) {
    log.info('[update] skipped — not a packaged app (dev)');
    return;
  }

  autoUpdater.logger = log;
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('checking-for-update', () => log.info('[update] checking…'));
  autoUpdater.on('update-available', (info) => log.info('[update] available:', info.version));
  autoUpdater.on('update-not-available', () => log.info('[update] up to date'));
  autoUpdater.on('download-progress', (p) => log.info(`[update] downloading ${Math.round(p.percent)}%`));
  autoUpdater.on('update-downloaded', (info) => log.info('[update] downloaded', info.version, '— installs on quit'));
  autoUpdater.on('error', (err) => log.error('[update] error', err));

  const check = () => autoUpdater.checkForUpdates().catch((e) => log.error('[update] check failed', e));
  setTimeout(check, 10_000);            // shortly after launch
  setInterval(check, CHECK_INTERVAL_MS); // and periodically
}
