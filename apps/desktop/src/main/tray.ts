import { Tray, Menu, app, shell, type MenuItem } from 'electron';
import path from 'path';
import log from 'electron-log';
import { showMainWindow } from './windows';
import { openOverlay, openRegionOverlay, setStealth } from './screen/overlay';
import { screenPermission, openScreenRecordingSettings } from './screen/capture';
import { getScreenAssist, getOpenAppOnTrayClick, setOpenAppOnTrayClick } from './settings';
import { ingest } from './sync/ingest';
import { readAppleNotes, isFullDiskAccessGranted as notesFdaGranted } from './sync/appleNotesSync';
import { readRecentMessages, isFullDiskAccessGranted as messagesFdaGranted } from './sync/appleMessagesSync';
import { readAppleReminders, isFullDiskAccessGranted as remindersFdaGranted } from './sync/appleReminders';

let tray: Tray | null = null;
let syncing = false;
let lastSyncAt: Date | null = null;
let lastNotesCount = 0;
let lastMessagesCount = 0;
let signedIn = false;
let signedInEmail: string | null = null;
/** The accelerator that actually registered, or null when the combo was taken. */
let hotkey: string | null = null;
let regionHotkey: string | null = null;

/**
 * Told by index.ts what really happened when the hotkey was registered.
 *
 * The menu must not print a shortcut that does nothing. globalShortcut.register
 * returns false on a clash rather than throwing, so without this the tray would
 * confidently advertise a key combination the OS has given to somebody else.
 */
export function setHotkeyRegistered(accelerator: string | null): void {
  hotkey = accelerator;
  rebuildMenu();
}

export function setRegionHotkeyRegistered(accelerator: string | null): void {
  regionHotkey = accelerator;
  rebuildMenu();
}

export function createTray(): void {
  const iconPath = path.join(__dirname, '../../assets/tray-icon.png');
  tray = new Tray(iconPath);
  tray.setToolTip('MODUS');
  // 🪤 This used to be an unconditional `showMainWindow()`. A tray icon with a
  // context menu ALREADY responds to a click by opening its menu, so firing this
  // as well threw the full 1200x820 MODUS window in front of whatever you were
  // working on every single time you reached for the menu — including when you
  // reached for it to ask about the screen you were just covering up.
  // Opt-in, off by default.
  tray.on('click', () => { if (getOpenAppOnTrayClick()) showMainWindow(); });
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
    const reminders = remindersFdaGranted() ? readAppleReminders() : [];
    if (notes.length === 0 && messages.length === 0 && reminders.length === 0) {
      log.info('[sync] nothing to sync (Full Disk Access off or no local data)');
      return;
    }
    const result = await ingest({ notes, messages, reminders });
    if (result) {
      lastSyncAt = new Date();
      lastNotesCount = result.notesWritten;
      lastMessagesCount = result.messagesWritten;
      signedIn = true;
      log.info(`[sync] uploaded ${result.notesWritten} note(s), ${result.messagesWritten} conversation(s), ${result.remindersWritten ?? 0} reminder(s)`);
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
  const assist = getScreenAssist();
  const screenPerm = screenPermission();

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
      {
        // The shortcut is shown as a real accelerator only when it registered.
        // `accelerator` here is DISPLAY ONLY — the working binding is the
        // globalShortcut in index.ts, which fires whether or not MODUS is focused.
        label: 'Ask about my screen',
        ...(hotkey ? { accelerator: hotkey } : {}),
        click: () => { void openOverlay(); },
      },
      ...(hotkey ? [] : [{
        label: 'Shortcut unavailable (in use by another app)',
        enabled: false,
      } as Electron.MenuItemConstructorOptions]),
      {
        label: 'Select an area…',
        ...(regionHotkey ? { accelerator: regionHotkey } : {}),
        click: () => { void openRegionOverlay(); },
      },
      {
        label: 'Screen Assist',
        submenu: [
          ...(screenPerm === 'granted' ? [] : [
            {
              label: 'Grant Screen Recording…',
              click: () => openScreenRecordingSettings(),
            } as Electron.MenuItemConstructorOptions,
            {
              label: 'Relaunch required after granting',
              enabled: false,
            } as Electron.MenuItemConstructorOptions,
            { type: 'separator' } as Electron.MenuItemConstructorOptions,
          ]),
          {
            label: 'Hide from screen sharing',
            type: 'checkbox',
            checked: assist.stealth,
            click: (menuItem: MenuItem) => {
              setStealth(menuItem.checked);
              rebuildMenu();
            },
          },
          {
            label: assist.stealth
              ? 'The panel is invisible to Zoom and recordings'
              : 'The panel appears in Zoom and recordings',
            enabled: false,
          },
        ],
      },
      { type: 'separator' },
      { label: syncLabel, enabled: !syncing, click: syncClick },
      { label: lastLine, enabled: false },
      { type: 'separator' },
      {
        label: 'Open MODUS when I click this icon',
        type: 'checkbox',
        checked: getOpenAppOnTrayClick(),
        click: (menuItem: MenuItem) => {
          setOpenAppOnTrayClick(menuItem.checked);
          rebuildMenu();
        },
      },
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
