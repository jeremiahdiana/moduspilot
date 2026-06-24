import { Tray, Menu, app, dialog } from 'electron';
import path from 'path';
import log from 'electron-log';
import { getBridgeWindow } from './windows';
import { syncTextFolder } from './sync/textFolderSync';
import type { SignedInUser } from '../shared/types';

let tray: Tray | null = null;
let currentUser: SignedInUser | null = null;
let currentFolder: string | null = null;

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

export function getCurrentFolder(): string | null {
  return currentFolder;
}

// Used by the scheduler tick in index.ts — syncs silently if both a signed-in
// user and a chosen folder exist, no-ops otherwise (e.g. before first setup).
export async function syncIfReady(): Promise<void> {
  if (!currentUser || !currentFolder) return;
  await syncTextFolder(getBridgeWindow(), currentUser.uid, currentFolder);
}

function rebuildMenu(): void {
  if (!tray) return;
  const signedIn = !!currentUser;
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
        label: currentFolder ? `Notes folder: ${path.basename(currentFolder)}` : 'Choose notes folder…',
        enabled: signedIn,
        click: handleChooseFolder,
      },
      { label: 'Sync now', enabled: signedIn && !!currentFolder, click: handleSyncNow },
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

async function handleChooseFolder(): Promise<void> {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory'],
    title: 'Choose a folder of .md/.txt notes to sync',
  });
  if (result.canceled || result.filePaths.length === 0) return;
  currentFolder = result.filePaths[0];
  log.info('[sync] notes folder set to', currentFolder);
  rebuildMenu();
}

async function handleSyncNow(): Promise<void> {
  if (!currentUser || !currentFolder) return;
  try {
    await syncTextFolder(getBridgeWindow(), currentUser.uid, currentFolder);
  } catch (err) {
    log.error('[sync] manual sync failed', err);
  }
}
