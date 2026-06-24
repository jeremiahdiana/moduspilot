import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import type { BrowserWindow } from 'electron';
import log from 'electron-log';
import type { NoteRecord } from '../../shared/types';

const TEXT_EXTENSIONS = new Set(['.md', '.txt']);
const MAX_BODY_CHARS = 20000;

// Stable per-file id so re-syncing the same file overwrites its doc instead
// of creating duplicates (mirrors apps/mobile contacts using a stable id).
function idForPath(filePath: string): string {
  return crypto.createHash('sha1').update(filePath).digest('hex').slice(0, 24);
}

// Throwaway de-risk connector: proves folder-read -> Firestore sync works
// before the real Apple Notes parser (SQLite + gzip + protobuf) exists.
// Delete this file once notesSync.ts (the real connector) is wired up.
export async function syncTextFolder(
  bridge: BrowserWindow,
  uid: string,
  folderPath: string
): Promise<number> {
  let entries: string[];
  try {
    entries = fs.readdirSync(folderPath);
  } catch (err) {
    log.error('[sync] failed to read folder', folderPath, err);
    return 0;
  }

  const records: NoteRecord[] = [];
  for (const entry of entries) {
    const ext = path.extname(entry).toLowerCase();
    if (!TEXT_EXTENSIONS.has(ext)) continue;

    const fullPath = path.join(folderPath, entry);
    let stat: fs.Stats;
    try {
      stat = fs.statSync(fullPath);
    } catch (err) {
      log.error('[sync] failed to stat', fullPath, err);
      continue;
    }
    if (!stat.isFile()) continue;

    let body: string;
    try {
      body = fs.readFileSync(fullPath, 'utf8');
    } catch (err) {
      log.error('[sync] failed to read', fullPath, err);
      continue;
    }

    records.push({
      id: idForPath(fullPath),
      title: path.basename(entry, ext),
      body: body.slice(0, MAX_BODY_CHARS),
      source: 'desktop-textfile',
    });
  }

  if (records.length === 0) {
    log.info('[sync] no .md/.txt files found in', folderPath);
    return 0;
  }

  const written = (await bridge.webContents.executeJavaScript(
    `window.modusWriteNotes(${JSON.stringify(uid)}, ${JSON.stringify(records)})`
  )) as number;

  log.info(`[sync] wrote ${written} note(s) from ${folderPath}`);
  return written;
}
