import crypto from 'crypto';

/**
 * The delete decision for MODUS Desktop sync, as a pure function.
 *
 * Why this is its own module and not inlined in the ingest route: `route.ts`
 * exports only `POST`, so the decision would be unreachable from a verify
 * script. Everything here is deliberately synchronous and Firestore-free so
 * `scripts/verify-sync-reconcile.ts` can pin both directions of it.
 *
 * The one rule that makes the whole thing safe: **reconcile against `allIds`,
 * never against the records that arrived.** Every reader caps its record query
 * (MAX_NOTES=500, MAX_CHATS=30, MAX_REMINDERS=300-per-store) and every reader
 * skips individual rows it fails to decode. If absence-from-records meant
 * "deleted", every one of those caps and skips would silently destroy user
 * data. That is not hypothetical: it is exactly what the reminders path did
 * before this module existed.
 */

export const ALL_IDS_CEILING = 5000;
export const MASS_DELETE_MIN = 100;
export const MASS_DELETE_RATIO = 0.5;

export type SkipReason =
  | 'no-envelope'         // legacy desktop build — it cannot tell us what still exists
  | 'incomplete'          // a read failed or was truncated; the client says so itself
  | 'empty-ids'           // refuse to interpret "nothing" as "delete everything"
  | 'too-many-ids'        // over ceiling — refuse rather than truncate (see below)
  | 'records-not-subset'  // client contradicted itself
  | 'mass-delete-guard'   // disproportionate delete; needs a human to look
  // Never returned by planReconcile — the route reports it when the user has
  // switched the source off, so nothing is ingested and nothing is deleted.
  // It lives in this union because the union is the wire contract.
  | 'capability-off';

export type ReconcileOutcome = { deleted: number } | { skipped: SkipReason };

export interface SourceSync {
  allIds: string[];
  complete: boolean;
}

export interface ReconcileInput {
  /** Doc ids currently in Firestore for this source. */
  existingIds: string[];
  /** Doc ids that arrived in `records`, already through safeId + toDocId. */
  recordDocIds: string[];
  /** The client's envelope for this source. Untrusted — every field is re-checked. */
  sync: { allIds?: unknown; complete?: unknown } | undefined;
  /** Maps a source-level id to a Firestore doc id. Identity for notes/messages. */
  toDocId?: (id: string) => string;
  /** Docs belonging to a different machine. Never deletable by this payload. */
  protectedIds?: ReadonlySet<string>;
}

export interface ReconcilePlan {
  deleteIds: string[];
  keepIds: ReadonlySet<string>;
  skipped: SkipReason | null;
}

/**
 * Firestore doc ids can't contain '/', can't be '.' or '..', must be non-empty
 * and are capped at 1500 bytes (we use a much tighter 256). Shared by the
 * ingest route so a record and its id-list entry normalise identically — if
 * these ever diverged, a note would be written under one id and kept alive
 * under another, and the reconcile would delete it on every sync.
 */
export function safeId(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  if (!t || t.length > 256 || t.includes('/') || t === '.' || t === '..') return null;
  return t;
}

/** The one definition of a reminder's doc id. Mirrored nowhere. */
export function reminderDocId(rid: string): string {
  return `apple-${rid}`.slice(0, 256);
}

export function planReconcile(input: ReconcileInput): ReconcilePlan {
  const { existingIds, recordDocIds, sync, toDocId, protectedIds } = input;
  const none = (skipped: SkipReason): ReconcilePlan => ({
    deleteIds: [],
    keepIds: new Set(),
    skipped,
  });

  if (!sync || typeof sync !== 'object') return none('no-envelope');
  if (!Array.isArray(sync.allIds) || sync.complete !== true) return none('incomplete');

  // NEVER `.slice()` this. Truncating allIds does not "limit the work" — every
  // id past the cutoff becomes a delete, so a defensive slice here IS the mass
  // deletion it looks like it is preventing. Refuse the whole reconcile instead
  // and let the docs go stale, which is recoverable.
  if (sync.allIds.length > ALL_IDS_CEILING) return none('too-many-ids');

  const map = toDocId ?? ((id: string) => id);
  const keepIds = new Set<string>();
  for (const raw of sync.allIds) {
    const id = safeId(raw);
    if (id) keepIds.add(map(id));
  }

  // A user with genuinely zero notes has nothing to delete anyway, so this
  // costs nothing real. What it buys: if a future macOS renames a column and
  // the id query starts returning zero rows without throwing, `complete` is
  // still true and this is the only thing standing between that and wiping
  // the collection. One stale doc is an infinitely better failure than that.
  if (keepIds.size === 0) return none('empty-ids');

  // The client just told us these records exist and then omitted them from its
  // own list of what exists. Version skew or a reader bug — either way its
  // claim about deletions is not trustworthy.
  for (const id of recordDocIds) {
    if (!keepIds.has(id)) return none('records-not-subset');
  }

  const deleteIds = existingIds.filter(
    (id) => !keepIds.has(id) && !protectedIds?.has(id)
  );

  // Deleting a handful of notes is the normal case this feature exists for.
  // Deleting most of the collection is a partially-broken read that passed
  // every check above. Prefer staleness and make the refusal visible.
  if (
    deleteIds.length > MASS_DELETE_MIN &&
    deleteIds.length > MASS_DELETE_RATIO * existingIds.length
  ) {
    return none('mass-delete-guard');
  }

  return { deleteIds, keepIds, skipped: null };
}

/**
 * Stable hash of exactly the fields that would be written, minus `updatedAt`.
 * If this matches what's already stored, the write would have been a no-op,
 * so it is skipped — that is what removes ~150k Firestore writes/day/user.
 *
 * Hash rather than a `modifiedAt` comparison on purpose. Both body decoders
 * are documented approximations (decodeNoteBody's longest-candidate walk,
 * decodeAttributedBody's ASCII-only limit) and will get better. A modifiedAt
 * check would freeze every existing doc at the old decoder's output forever,
 * with no version to bump; a content hash self-heals on the next sync.
 */
export function contentHash(fields: Record<string, unknown>): string {
  const canonical = JSON.stringify(
    Object.keys(fields)
      .sort()
      .map((k) => [k, fields[k] === undefined ? null : fields[k]])
  );
  return crypto.createHash('sha1').update(canonical).digest('hex').slice(0, 16);
}

/** Docs written before contentHash existed have none, so they rewrite once. */
export function shouldWrite(existingHash: string | undefined, nextHash: string): boolean {
  return existingHash !== nextHash;
}
