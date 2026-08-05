import fs from 'fs';
import os from 'os';
import path from 'path';
import Database from 'better-sqlite3';
import log from 'electron-log';
import type { ReminderRecord } from '../../shared/types';

export interface RemindersRead {
  records: ReminderRecord[];
  allIds: string[];
  completedIds: string[];
  complete: boolean;
}

// Apple Reminders are Core Data SQLite stores, one per account, under the
// Reminders group container. Unlike Notes, the schema is plain columns
// (ZTITLE/ZNOTES/ZDUEDATE/ZCOMPLETED/ZPRIORITY) — no protobuf decoding needed.
const STORES_DIR = path.join(
  os.homedir(),
  'Library/Group Containers/group.com.apple.reminders/Container_v1/Stores'
);

const CORE_DATA_EPOCH_OFFSET_SECONDS = 978307200; // 2001-01-01 vs Unix epoch
// PER STORE, and there is one store per Apple account. This caps how many full
// reminder BODIES ship, nothing else.
//
// 🪤 This used to also decide deletions, because the server reconciled against
// whatever arrived in `records`. Ordering is `ZCOMPLETED ASC, ZDUEDATE ASC`, so
// every reminder past #300 in an account — the completed ones and the furthest
// -future dated ones — was soft-deleted in MODUS on every single sync, and
// never came back, because the server only resets `deleted:false` on first
// insert. allIds below is uncapped for exactly this reason.
const MAX_REMINDERS = 300;
/** Mirrors ALL_IDS_CEILING in apps/web/lib/desktop/reconcile.ts. */
const ALL_IDS_CEILING = 5000;

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

export function readAppleReminders(): RemindersRead {
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
  const allIds: string[] = [];
  const completedIds: string[] = [];
  // 🚨 Starts true and is cleared by ANY swallowed per-store failure below.
  // This flag is the entire fix for the worst bug in the sync: one store per
  // Apple account, a catch INSIDE the loop, and a server that treated the
  // resulting partial list as the truth — so an iCloud store that failed to
  // snapshot while an Exchange store succeeded soft-deleted every task from
  // the iCloud account, permanently.
  let complete = true;

  try {
    storePaths.forEach((storePath, i) => {
      let db: Database.Database | null = null;
      try {
        const snap = snapshot(storePath, tmpDir, i);
        db = new Database(snap, { readonly: true, fileMustExist: true });

        // Skip stores without the reminder table (e.g. the empty local store).
        // ⚠️ Deliberately does NOT clear `complete`: an empty local store is
        // the expected state on most Macs, not a read failure. Clearing it here
        // would disable reconciliation for nearly everyone.
        const hasTable = db
          .prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='ZREMCDREMINDER'")
          .get();
        if (!hasTable) return;

        // Uncapped id pass, identical predicate to the record query below.
        for (const row of db
          .prepare(
            `SELECT r.ZIDENTIFIER as identifier, r.ZCOMPLETED as completed
             FROM ZREMCDREMINDER r
             WHERE r.ZTITLE IS NOT NULL`
          )
          .all() as { identifier: Buffer | string | null; completed: number | null }[]) {
          const id = toIdString(row.identifier);
          if (!id) continue;
          allIds.push(id);
          if (row.completed === 1) completedIds.push(id);
        }

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
        // Logging this and carrying on is correct — one broken account should
        // not block the others. Marking the read incomplete is what stops the
        // server from reading the survivors as "everything else was deleted".
        complete = false;
        log.error('[appleReminders] failed to read a store, reconciliation disabled this sync', storePath, err);
      } finally {
        db?.close();
      }
    });
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }

  if (allIds.length > ALL_IDS_CEILING) {
    log.error(`[appleReminders] ${allIds.length} reminders exceeds the ${ALL_IDS_CEILING} id ceiling — no deletions will be reconciled`);
    complete = false;
  }

  log.info(`[appleReminders] read ${records.length} reminder(s) of ${allIds.length} (${completedIds.length} completed), complete=${complete}`);
  return { records, allIds, completedIds, complete };
}
