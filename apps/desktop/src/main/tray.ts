import { Tray, Menu, app, shell, type MenuItem } from 'electron';
import path from 'path';
import log from 'electron-log';
import { getBridgeWindow } from './windows';
import { readAppleNotes, isFullDiskAccessGranted as notesFdaGranted, FullDiskAccessError as NotesFdaError } from './sync/appleNotesSync';
import { readRecentMessages, isFullDiskAccessGranted as messagesFdaGranted, FullDiskAccessError as MessagesFdaError } from './sync/appleMessagesSync';
import type { SignedInUser } from '../shared/types';

let tray: Tray | null = null;
let currentUser: SignedInUser | null = null;
let lastNotesSyncAt: Date | null = null;
let lastNotesSyncCount = 0;
let lastMessagesSyncAt: Date | null = null;
let lastMessagesSyncCount = 0;
let syncingNotes = false;
let syncingMessages = false;

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
  if (!currentUser) return;
  if (notesFdaGranted()) await runNotesSync();
  if (messagesFdaGranted()) await runMessagesSync();
}

async function runNotesSync(): Promise<void> {
  if (!currentUser || syncingNotes) return;
  syncingNotes = true;
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
      lastNotesSyncCount = written;
    }
    lastNotesSyncAt = new Date();
  } catch (err) {
    if (err instanceof NotesFdaError) {
      log.error('[sync] Full Disk Access not granted for Notes');
    } else {
      log.error('[sync] Apple Notes sync failed', err);
    }
  } finally {
    syncingNotes = false;
    rebuildMenu();
  }
}

async function runMessagesSync(): Promise<void> {
  if (!currentUser || syncingMessages) return;
  syncingMessages = true;
  rebuildMenu();
  try {
    const records = readRecentMessages();
    if (records.length === 0) {
      log.info('[sync] no iMessage conversations found to sync');
    } else {
      const written = (await getBridgeWindow().webContents.executeJavaScript(
        `window.modusWriteMessages(${JSON.stringify(currentUser.uid)}, ${JSON.stringify(records)})`
      )) as number;
      log.info(`[sync] wrote ${written} iMessage conversation(s)`);
      lastMessagesSyncCount = written;
    }
    lastMessagesSyncAt = new Date();
  } catch (err) {
    if (err instanceof MessagesFdaError) {
      log.error('[sync] Full Disk Access not granted for Messages');
    } else {
      log.error('[sync] iMessage sync failed', err);
    }
  } finally {
    syncingMessages = false;
    rebuildMenu();
  }
}

function rebuildMenu(): void {
  if (!tray) return;
  const signedIn = !!currentUser;
  const fdaGranted = notesFdaGranted() && messagesFdaGranted();

  function syncLabel(forSyncing: boolean, name: string): string {
    if (!signedIn) return `Sync ${name} (sign in first)`;
    if (!fdaGranted) return 'Grant Full Disk Access…';
    if (forSyncing) return 'Syncing…';
    return `Sync ${name} now`;
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
        label: syncLabel(syncingNotes, 'Apple Notes'),
        enabled: signedIn && !syncingNotes,
        click: fdaGranted ? handleSyncNotesNow : handleGrantFullDiskAccess,
      },
      {
        label: lastNotesSyncAt
          ? `Last synced ${lastNotesSyncAt.toLocaleTimeString()} (${lastNotesSyncCount} note${lastNotesSyncCount === 1 ? '' : 's'})`
          : 'Notes: not synced yet',
        enabled: false,
      },
      { type: 'separator' },
      {
        label: syncLabel(syncingMessages, 'iMessage'),
        enabled: signedIn && !syncingMessages,
        click: fdaGranted ? handleSyncMessagesNow : handleGrantFullDiskAccess,
      },
      {
        label: lastMessagesSyncAt
          ? `Last synced ${lastMessagesSyncAt.toLocaleTimeString()} (${lastMessagesSyncCount} conversation${lastMessagesSyncCount === 1 ? '' : 's'})`
          : 'iMessage: not synced yet',
        enabled: false,
      },
      { type: 'separator' },
      {
        label: 'Launch at login',
        type: 'checkbox',
        checked: app.getLoginItemSettings().openAtLogin,
        click: handleToggleLaunchAtLogin,
      },
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
    // Sync right away on first sign-in instead of waiting for the next
    // scheduler tick (up to 15 min). No-ops cleanly if FDA isn't granted yet.
    if (user) syncIfReady().catch((err) => log.error('[sync] post-sign-in sync failed', err));
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

async function handleSyncNotesNow(): Promise<void> {
  await runNotesSync();
}

async function handleSyncMessagesNow(): Promise<void> {
  await runMessagesSync();
}

// No programmatic request API exists for Full Disk Access (unlike Contacts/
// Camera) — deep-link straight to the right System Settings pane and let the
// user grant it manually, then retry sync. Notes and Messages share the same
// OS-level Full Disk Access grant.
async function handleGrantFullDiskAccess(): Promise<void> {
  await shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_AllFiles');
  log.info('[sync] opened Full Disk Access settings pane');
}

// Electron toggles the checkbox's `checked` state before firing click, so the
// passed-in menuItem already reflects the desired new value. openAtLogin makes
// macOS auto-launch the agent on boot so background syncs keep running without
// the user reopening it each time.
function handleToggleLaunchAtLogin(menuItem: MenuItem): void {
  app.setLoginItemSettings({ openAtLogin: menuItem.checked });
  log.info('[startup] launch at login set to', menuItem.checked);
}
