import { Tray, Menu, app, shell } from 'electron';
import path from 'path';
import log from 'electron-log';
import { getBridgeWindow } from './windows';
import { readAppleNotes, isFullDiskAccessGranted, FullDiskAccessError } from './sync/appleNotesSync';
import type { SignedInUser } from '../shared/types';

let tray: Tray | null = null;
let currentUser: SignedInUser | null = null;
let lastSyncAt: Date | null = null;
let lastSyncCount = 0;
let syncing = false;

export function createTray(): void {
  const iconPath = path.join(__dirname, '../../assets/tray-icon.png');
  tray = new Tray(iconPath);
  tray.setToolTip('MODUS Desktop');
  rebuildMenu();
}

export function getCurrentUser(): SignedInUser | null {
  return currentUser;
}

export function setCurrentUser(user: SignedInUser | null): void {
  currentUser = user;
  rebuildMenu();
}

// Used by the scheduler tick in index.ts — syncs silently if signed in and
// Full Disk Access is already granted, no-ops otherwise.
export async function syncIfReady(): Promise<void> {
  if (!currentUser || !isFullDiskAccessGranted()) return;
  await runSync();
}

async function runSync(): Promise<void> {
  if (!currentUser || syncing) return;
  syncing = true;
  rebuildMenu();
  try {
    const records = readAppleNotes();
    if (records.length === 0) {
      log.info('[sync] no Apple Notes found to sync');
    } else {
      const written = (await getBridgeWindow().webContents.executeJavaScript(
        `window.modusWriteNotes(${JSON.stringify(currentUser.uid)}, ${JSON.stringify(records)})`
      )) as number;
      log.info(`[sync] wrote ${written} Apple Note(s)`);
      lastSyncCount = written;
    }
    lastSyncAt = new Date();
  } catch (err) {
    if (err instanceof FullDiskAccessError) {
      log.error('[sync] Full Disk Access not granted');
    } else {
      log.error('[sync] Apple Notes sync failed', err);
    }
  } finally {
    syncing = false;
    rebuildMenu();
  }
}

function rebuildMenu(): void {
  if (!tray) return;
  const signedIn = !!currentUser;
  const fdaGranted = isFullDiskAccessGranted();

  let syncLabel: string;
  if (!signedIn) {
    syncLabel = 'Sync Apple Notes (sign in first)';
  } else if (!fdaGranted) {
    syncLabel = 'Grant Full Disk Access…';
  } else if (syncing) {
    syncLabel = 'Syncing…';
  } else {
    syncLabel = 'Sync Apple Notes now';
  }

  tray.setContextMenu(
    Menu.buildFromTemplate([
      {
        label: signedIn ? `Signed in as ${currentUser?.email ?? currentUser?.uid}` : 'Not signed in',
        enabled: false,
      },
      { type: 'separator' },
      signedIn
        ? { label: 'Sign out', click: handleSignOut }
        : { label: 'Sign in with Google', click: handleSignIn },
      { type: 'separator' },
      {
        label: syncLabel,
        enabled: signedIn && !syncing,
        click: fdaGranted ? handleSyncNow : handleGrantFullDiskAccess,
      },
      {
        label: lastSyncAt
          ? `Last synced ${lastSyncAt.toLocaleTimeString()} (${lastSyncCount} note${lastSyncCount === 1 ? '' : 's'})`
          : 'Not synced yet',
        enabled: false,
      },
      { type: 'separator' },
      { label: 'Write test doc', enabled: signedIn, click: handleWriteTestDoc },
      { type: 'separator' },
      { label: 'Quit', click: () => app.quit() },
    ])
  );
}

async function handleSignIn(): Promise<void> {
  try {
    const win = getBridgeWindow();
    const user = (await win.webContents.executeJavaScript('window.modusSignIn()')) as SignedInUser | null;
    currentUser = user;
    log.info('[auth] signed in', user?.uid);
  } catch (err) {
    log.error('[auth] sign-in failed', err);
  }
  rebuildMenu();
}
// (handleSignIn/handleSignOut set currentUser directly + rebuildMenu; setCurrentUser
// above is just for the one external call-site in index.ts restoring a saved session.)

async function handleSignOut(): Promise<void> {
  try {
    const win = getBridgeWindow();
    await win.webContents.executeJavaScript('window.modusSignOut()');
    currentUser = null;
    log.info('[auth] signed out');
  } catch (err) {
    log.error('[auth] sign-out failed', err);
  }
  rebuildMenu();
}

async function handleWriteTestDoc(): Promise<void> {
  if (!currentUser) return;
  try {
    const win = getBridgeWindow();
    await win.webContents.executeJavaScript(`window.modusWriteTestDoc(${JSON.stringify(currentUser.uid)})`);
    log.info('[firestore] test doc written for', currentUser.uid);
  } catch (err) {
    log.error('[firestore] test doc write failed', err);
  }
}

async function handleSyncNow(): Promise<void> {
  await runSync();
}

// No programmatic request API exists for Full Disk Access (unlike Contacts/
// Camera) — deep-link straight to the right System Settings pane and let the
// user grant it manually, then retry sync.
async function handleGrantFullDiskAccess(): Promise<void> {
  await shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_AllFiles');
  log.info('[sync] opened Full Disk Access settings pane');
}
