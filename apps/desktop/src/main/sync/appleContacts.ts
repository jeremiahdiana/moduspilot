import fs from 'fs';
import os from 'os';
import path from 'path';
import Database from 'better-sqlite3';
import log from 'electron-log';

// macOS Contacts stores each account ("source") as its own SQLite DB. iCloud,
// "On My Mac", and Exchange each get a folder under Sources/; older installs
// also keep a top-level AddressBook-v22.abcddb. We read every one we find and
// merge them into a single lookup.
const ADDRESS_BOOK_DIR = path.join(os.homedir(), 'Library/Application Support/AddressBook');
const DB_FILENAME = 'AddressBook-v22.abcddb';

export interface ContactLookup {
  /** Returns a contact's display name for a phone/email handle, or null. */
  resolve(handle: string): string | null;
  readonly size: number;
}

const EMPTY_LOOKUP: ContactLookup = { resolve: () => null, size: 0 };

function findAddressBookDbs(): string[] {
  const dbs: string[] = [];
  const top = path.join(ADDRESS_BOOK_DIR, DB_FILENAME);
  if (fs.existsSync(top)) dbs.push(top);
  const sourcesDir = path.join(ADDRESS_BOOK_DIR, 'Sources');
  if (fs.existsSync(sourcesDir)) {
    for (const entry of fs.readdirSync(sourcesDir)) {
      const p = path.join(sourcesDir, entry, DB_FILENAME);
      if (fs.existsSync(p)) dbs.push(p);
    }
  }
  return dbs;
}

// iMessage handle IDs and stored numbers are both usually E.164 (+1##########),
// but stored numbers can carry formatting and handles can omit the country
// code. Key on all-digits AND last-10-digits so "+14155551234", "14155551234",
// "(415) 555-1234" and "4155551234" all collide onto the same contact.
function phoneKeys(raw: string): string[] {
  const digits = raw.replace(/\D/g, '');
  if (!digits) return [];
  return digits.length > 10 ? [digits, digits.slice(-10)] : [digits];
}

interface RawContactRow {
  ZFIRSTNAME: string | null;
  ZLASTNAME: string | null;
  ZNICKNAME: string | null;
  ZORGANIZATION: string | null;
  value: string | null;
}

function displayName(r: RawContactRow): string | null {
  const full = [r.ZFIRSTNAME, r.ZLASTNAME].filter(Boolean).join(' ').trim();
  return full || r.ZNICKNAME || r.ZORGANIZATION || null;
}

// Same lock-contention guard as Notes/Messages — Contacts.app holds these DBs
// open, so snapshot before reading.
function snapshot(dbPath: string, tmpDir: string, index: number): string {
  const dest = path.join(tmpDir, `contacts-${index}.abcddb`);
  fs.copyFileSync(dbPath, dest);
  for (const suffix of ['-wal', '-shm']) {
    if (fs.existsSync(dbPath + suffix)) fs.copyFileSync(dbPath + suffix, dest + suffix);
  }
  return dest;
}

/**
 * Build a phone/email → name lookup from the local macOS Contacts DBs.
 * Best-effort: any failure (no Full Disk Access, schema drift, locked file)
 * returns an empty lookup so message sync still works with raw handle IDs.
 */
export function buildContactLookup(): ContactLookup {
  const dbPaths = findAddressBookDbs();
  if (dbPaths.length === 0) return EMPTY_LOOKUP;

  let tmpDir: string;
  try {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'modus-contacts-'));
  } catch (err) {
    log.error('[appleContacts] failed to create temp dir', err);
    return EMPTY_LOOKUP;
  }

  const byKey = new Map<string, string>();

  try {
    dbPaths.forEach((dbPath, i) => {
      let db: Database.Database | null = null;
      try {
        const snap = snapshot(dbPath, tmpDir, i);
        db = new Database(snap, { readonly: true, fileMustExist: true });

        const phoneRows = db
          .prepare(
            `SELECT r.ZFIRSTNAME, r.ZLASTNAME, r.ZNICKNAME, r.ZORGANIZATION, p.ZFULLNUMBER as value
             FROM ZABCDPHONENUMBER p
             JOIN ZABCDRECORD r ON r.Z_PK = p.ZOWNER
             WHERE p.ZFULLNUMBER IS NOT NULL`
          )
          .all() as RawContactRow[];

        for (const row of phoneRows) {
          const name = displayName(row);
          if (!name || !row.value) continue;
          for (const key of phoneKeys(row.value)) {
            if (!byKey.has(key)) byKey.set(key, name);
          }
        }

        const emailRows = db
          .prepare(
            `SELECT r.ZFIRSTNAME, r.ZLASTNAME, r.ZNICKNAME, r.ZORGANIZATION, e.ZADDRESS as value
             FROM ZABCDEMAILADDRESS e
             JOIN ZABCDRECORD r ON r.Z_PK = e.ZOWNER
             WHERE e.ZADDRESS IS NOT NULL`
          )
          .all() as RawContactRow[];

        for (const row of emailRows) {
          const name = displayName(row);
          if (!name || !row.value) continue;
          const key = `email:${row.value.trim().toLowerCase()}`;
          if (!byKey.has(key)) byKey.set(key, name);
        }
      } catch (err) {
        log.error('[appleContacts] failed to read a contacts source', dbPath, err);
      } finally {
        db?.close();
      }
    });
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }

  log.info(`[appleContacts] built lookup with ${byKey.size} key(s)`);

  return {
    size: byKey.size,
    resolve(handle: string): string | null {
      if (!handle) return null;
      if (handle.includes('@')) {
        return byKey.get(`email:${handle.trim().toLowerCase()}`) ?? null;
      }
      for (const key of phoneKeys(handle)) {
        const name = byKey.get(key);
        if (name) return name;
      }
      return null;
    },
  };
}
