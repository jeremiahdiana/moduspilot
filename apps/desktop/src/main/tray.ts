import { Tray, Menu, app, shell, type MenuItem } from 'electron';
import path from 'path';
import log from 'electron-log';
import { showMainWindow } from './windows';
import { ingest } from './sync/ingest';
import { readAppleNotes, isFullDiskAccessGranted as notesFdaGranted } from './sync/appleNotesSync';
import { readRecentMessages, isFullDiskAccessGranted as messagesFdaGranted } from './sync/appleMessagesSync';

let tray: Tray | null = null;
let syncing = false;
let lastSyncAt: Date | null = null;
let lastNotesCount = 0;
let lastMessagesCount = 0;
let signedIn = false;
let signedInEmail: string | null = null;

export function createTray(): void {
  const iconPath = path.join(__dirname, '../../assets/tray-icon.png');
  tray = new Tray(iconPath);
  tray.setToolTip('MODUS');
  // Clicking the menu-bar icon opens the app window (in addition to the menu).
  tray.on('click', () => showMainWindow());
  rebuildMenu();
}

// Called by the auth poller in index.ts so the tray reflects sign-in state.
export function setSignedIn(state: boolean, email: string | null): void {
  signedIn = state;
  signedInEmail = email;
  rebuildMenu();
}

const fullDiskAccess = (): boolean => notesFdaGranted() && messagesFdaGranted();

// Reads local Apple Notes + iMessage and uploads them via the web ingest
// endpoint (authenticated with the signed-in window's token). Safe to call on
// a schedule — no-ops cleanly when not signed in or Full Disk Access is off.
export async function runSync(): Promise<void> {
  if (syncing) return;
  syncing = true;
  rebuildMenu();
  try {
    const notes = notesFdaGranted() ? readAppleNotes() : [];
    const messages = messagesFdaGranted() ? readRecentMessages() : [];
    if (notes.length === 0 && messages.length === 0) {
      log.info('[sync] nothing to sync (Full Disk Access off or no local data)');
      return;
    }
    const result = await ingest({ notes, messages });
    if (result) {
      lastSyncAt = new Date();
      lastNotesCount = result.notesWritten;
      lastMessagesCount = result.messagesWritten;
      signedIn = true;
      log.info(`[sync] uploaded ${result.notesWritten} note(s), ${result.messagesWritten} conversation(s)`);
    } else {
      log.info('[sync] skipped — open MODUS and sign in first');
    }
  } catch (err) {
    log.error('[sync] failed', err);
  } finally {
    syncing = false;
    rebuildMenu();
  }
}

function rebuildMenu(): void {
  if (!tray) return;
  const fda = fullDiskAccess();

  let syncLabel: string;
  let syncClick: (() => void) | (() => Promise<void>);
  if (syncing) {
    syncLabel = 'Syncing…';
    syncClick = () => {};
  } else if (!fda) {
    syncLabel = 'Grant Full Disk Access…';
    syncClick = handleGrantFullDiskAccess;
  } else {
    syncLabel = 'Sync now';
    syncClick = () => { runSync(); };
  }

  const lastLine = lastSyncAt
    ? `Last synced ${lastSyncAt.toLocaleTimeString()} (${lastNotesCount} notes, ${lastMessagesCount} chats)`
    : 'Not synced yet';

  tray.setContextMenu(
    Menu.buildFromTemplate([
      {
        label: signedInEmail
          ? `Signed in as ${signedInEmail}`
          : (signedIn ? 'Signed in' : 'Open MODUS to sign in'),
        enabled: false,
      },
      { type: 'separator' },
      { label: 'Open MODUS', click: () => showMainWindow() },
      { type: 'separator' },
      { label: syncLabel, enabled: !syncing, click: syncClick },
      { label: lastLine, enabled: false },
      { type: 'separator' },
      {
        label: 'Launch at login',
        type: 'checkbox',
        checked: app.getLoginItemSettings().openAtLogin,
        click: (menuItem: MenuItem) => {
          app.setLoginItemSettings({ openAtLogin: menuItem.checked });
          log.info('[startup] launch at login set to', menuItem.checked);
        },
      },
      { type: 'separator' },
      {
        label: 'Quit MODUS',
        click: () => {
          (app as unknown as { isQuitting?: boolean }).isQuitting = true;
          app.quit();
        },
      },
    ])
  );
}

// No programmatic request API exists for Full Disk Access (unlike Contacts/
// Camera) — deep-link to the right System Settings pane and let the user grant
// it, then retry sync. Notes and Messages share the same OS-level grant.
async function handleGrantFullDiskAccess(): Promise<void> {
  await shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_AllFiles');
  log.info('[sync] opened Full Disk Access settings pane');
}
