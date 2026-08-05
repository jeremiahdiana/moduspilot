/**
 * One source's claim about what still exists locally.
 *
 * ⚠️ MIRRORED BY HAND in apps/web/app/api/desktop/ingest/route.ts (apps/desktop
 * is not in the root workspaces list and its tsconfig sets rootDir:"src", so it
 * cannot import from apps/web). Change one, change the other.
 *
 * This exists because "absent from the records array" cannot mean "deleted".
 * Every reader caps its record query (MAX_NOTES=500, MAX_CHATS=30,
 * MAX_REMINDERS=300 per store) and skips rows it fails to decode, so records is
 * a lossy view by design. `allIds` is the lossless one, and it is the only
 * thing the server is allowed to delete against.
 */
export interface SourceSync {
  /**
   * Every doc id that SHOULD exist server-side for this source. UNCAPPED, from
   * a dedicated id-only query using eligibility predicates only — no decoding,
   * no LIMIT. Always a superset of the ids in the records array.
   *
   * 🪤 NEVER truncate this. Slicing allIds does not limit work, it converts
   * every id past the cutoff into a deletion.
   */
  allIds: string[];
  /**
   * True only when the read fully succeeded: nothing threw, no per-store
   * failure was swallowed, and every record id appears in allIds. False is
   * always the safe answer — the server then writes but deletes nothing.
   */
  complete: boolean;
}

export interface ReminderSync extends SourceSync {
  /**
   * Ids of reminders completed in Apple. LOAD-BEARING, not a nicety: completed
   * reminders sort last under `ZCOMPLETED ASC, ZDUEDATE ASC` and are the first
   * thing MAX_REMINDERS truncates, so they routinely never reach `records`.
   * Now that falling out of `records` no longer deletes them, this list is the
   * only thing that ever marks them done.
   */
  completedIds: string[];
}

export interface SyncEnvelope {
  v: 2;
  /**
   * Stable per-machine id, so two Macs signed into one MODUS account cannot
   * delete each other's synced docs every 5 minutes. Docs are stamped with it
   * and the server only ever deletes unstamped docs or its own.
   */
  deviceId: string;
  notes?: SourceSync;
  messages?: SourceSync;
  reminders?: ReminderSync;
}

/**
 * The POST body. The three record arrays keep their exact original shape and
 * position — `sync` is a purely additive sidecar. That is deliberate: a server
 * that has not deployed yet reads `Array.isArray(body.notes)`, so turning
 * `notes` into an object would silently ingest NOTHING from every source until
 * the deploy caught up.
 */
export interface IngestPayload {
  notes?: NoteRecord[];
  messages?: ConversationRecord[];
  reminders?: ReminderRecord[];
  sync?: SyncEnvelope;
}

/** What a reader hands back: the capped records plus the lossless id list. */
export interface SourceRead<T> {
  records: T[];
  allIds: string[];
  complete: boolean;
}

export interface NoteRecord {
  id: string;
  title: string;
  body: string;
  folder?: string;
  source: string;
  // Epoch ms of the note's actual last-edit time (e.g. Apple Notes
  // ZMODIFICATIONDATE1) — distinct from Firestore's updatedAt (sync time).
  // A bulk sync writes many notes within the same instant, so updatedAt
  // alone can't be used to find the most recently *edited* notes.
  modifiedAt?: number;
}

// One per iMessage conversation (thread), not per individual message — body
// is a recent-messages transcript. Same modifiedAt rationale as NoteRecord.
export interface ConversationRecord {
  id: string;
  title: string;
  body: string;
  source: string;
  modifiedAt?: number;
}

// One per Apple Reminder — synced into the MODUS reminders section as a task.
// `completed` lets the backend reconcile MODUS task state with Apple's.
export interface ReminderRecord {
  id: string;               // ZIDENTIFIER (stable UUID)
  title: string;
  notes?: string;
  dueDate?: string;         // YYYY-MM-DD in the user's local timezone (matches MODUS Task.dueDate)
  completed: boolean;
  priority?: 'high' | 'medium' | 'low';
  list?: string;
}
