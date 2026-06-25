import fs from 'fs';
import os from 'os';
import path from 'path';
import Database from 'better-sqlite3';
import log from 'electron-log';
import type { ReminderRecord } from '../../shared/types';

// Apple Reminders are Core Data SQLite stores, one per account, under the
// Reminders group container. Unlike Notes, the schema is plain columns
// (ZTITLE/ZNOTES/ZDUEDATE/ZCOMPLETED/ZPRIORITY) — no protobuf decoding needed.
const STORES_DIR = path.join(
  os.homedir(),
  'Library/Group Containers/group.com.apple.reminders/Container_v1/Stores'
);

const CORE_DATA_EPOCH_OFFSET_SECONDS = 978307200; // 2001-01-01 vs Unix epoch
const MAX_REMINDERS = 300;

export class FullDiskAccessError extends Error {
  constructor() {
    super('Full Disk Access not granted for Reminders');
    this.name = 'FullDiskAccessError';
  }
}

export function isFullDiskAccessGranted(): boolean {
  try {
    fs.accessSync(STORES_DIR, fs.constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

// Apple priority scheme: 1 = high, 5 = medium, 9 = low, 0 = none.
function mapPriority(p: number | null): 'high' | 'medium' | 'low' | undefined {
  if (p === 1) return 'high';
  if (p === 5) return 'medium';
  if (p === 9) return 'low';
  return undefined;
}

// Core Data seconds → local YYYY-MM-DD (the format MODUS Task.dueDate uses).
// Formatted in local time since this runs on the user's own Mac.
function toLocalDateStr(coreDataSeconds: number): string {
  const d = new Date((coreDataSeconds + CORE_DATA_EPOCH_OFFSET_SECONDS) * 1000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

interface RawReminderRow {
  // ZIDENTIFIER is stored as a 16-byte UUID BLOB, so better-sqlite3 hands it
  // back as a Buffer (not a string) — convert to hex for a stable string id.
  identifier: Buffer | string | null;
  title: string | null;
  notes: string | null;
  due: number | null;
  display: number | null;
  completed: number | null;
  priority: number | null;
  list: string | null;
}

function toIdString(v: Buffer | string | null): string | null {
  if (v == null) return null;
  if (Buffer.isBuffer(v)) return v.toString('hex');
  return typeof v === 'string' && v.length > 0 ? v : null;
}

// Same lock-avoidance pattern as Notes/Messages — Reminders.app holds the store
// open, so snapshot before reading.
function snapshot(dbPath: string, tmpDir: string, index: number): string {
  const dest = path.join(tmpDir, `reminders-${index}.sqlite`);
  fs.copyFileSync(dbPath, dest);
  for (const suffix of ['-wal', '-shm']) {
    if (fs.existsSync(dbPath + suffix)) fs.copyFileSync(dbPath + suffix, dest + suffix);
  }
  return dest;
}

export function readAppleReminders(): ReminderRecord[] {
  if (!isFullDiskAccessGranted()) throw new FullDiskAccessError();

  let storePaths: string[];
  try {
    storePaths = fs
      .readdirSync(STORES_DIR)
      .filter((f) => f.startsWith('Data-') && f.endsWith('.sqlite'))
      .map((f) => path.join(STORES_DIR, f));
  } catch (err) {
    log.error('[appleReminders] failed to list stores', err);
    throw new FullDiskAccessError();
  }

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'modus-reminders-'));
  const records: ReminderRecord[] = [];

  try {
    storePaths.forEach((storePath, i) => {
      let db: Database.Database | null = null;
      try {
        const snap = snapshot(storePath, tmpDir, i);
        db = new Database(snap, { readonly: true, fileMustExist: true });

        // Skip stores without the reminder table (e.g. the empty local store).
        const hasTable = db
          .prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='ZREMCDREMINDER'")
          .get();
        if (!hasTable) return;

        const rows = db
          .prepare(
            `SELECT
               r.ZIDENTIFIER as identifier,
               r.ZTITLE as title,
               r.ZNOTES as notes,
               r.ZDUEDATE as due,
               r.ZDISPLAYDATEDATE as display,
               r.ZCOMPLETED as completed,
               r.ZPRIORITY as priority,
               l.ZNAME as list
             FROM ZREMCDREMINDER r
             LEFT JOIN ZREMCDOBJECT l ON l.Z_PK = r.ZLIST
             WHERE r.ZTITLE IS NOT NULL
             ORDER BY r.ZCOMPLETED ASC, r.ZDUEDATE ASC
             LIMIT ?`
          )
          .all(MAX_REMINDERS) as RawReminderRow[];

        for (const row of rows) {
          const id = toIdString(row.identifier);
          if (!id || !row.title) continue;
          const rawDate = row.due ?? row.display;
          records.push({
            id,
            title: row.title.slice(0, 200),
            notes: row.notes ? row.notes.slice(0, 2000) : undefined,
            dueDate: rawDate != null ? toLocalDateStr(rawDate) : undefined,
            completed: row.completed === 1,
            priority: mapPriority(row.priority),
            list: row.list ?? undefined,
          });
        }
      } catch (err) {
        log.error('[appleReminders] failed to read a store', storePath, err);
      } finally {
        db?.close();
      }
    });
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }

  log.info(`[appleReminders] read ${records.length} reminder(s)`);
  return records;
}
