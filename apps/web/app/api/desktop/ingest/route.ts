import { requireAuth } from '@/lib/api-auth';
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import type { CollectionReference, Query } from 'firebase-admin/firestore';
import {
  planReconcile,
  reminderDocId,
  contentHash,
  shouldWrite,
  safeId,
  type ReconcileOutcome,
  type SourceSync,
} from '@/lib/desktop/reconcile';

// Ingest endpoint for MODUS Desktop. The desktop app reads local Apple Notes /
// iMessage / Reminders, then POSTs them here authenticated with the user's
// Firebase ID token (pulled from the signed-in website window it hosts) — so
// the agent needs no separate login or its own Firebase auth. Writes the same
// doc shapes the old in-app bridge used, so fetchNotesBlock / fetchMessagesBlock
// (orderBy modifiedAt) keep working unchanged.
//
// Two things this route does that are easy to break:
//
// 1. DELETION. A note deleted (or password-locked) on the Mac has to leave
//    Firestore, or it keeps getting injected into chat context forever. The
//    delete decision lives in lib/desktop/reconcile.ts as a pure function so
//    scripts/verify-sync-reconcile.ts can pin it, and it reconciles against
//    the client's `sync.allIds`, NEVER against the records that arrived —
//    every reader caps its record query, and treating a cap as a deletion is
//    what silently destroyed reminders before this existed.
//
// 2. WRITE VOLUME. This runs every 5 minutes per desktop. Rewriting all ~530
//    docs each time was ~150k writes/day/user (~$8/mo each). Every write is
//    now gated on a content hash.

const MAX_ITEMS = 500; // cap on records accepted per source
const MAX_TITLE = 200;
const MAX_BODY = 20000;

// Firestore caps a batch at 500 operations AND a commit request at ~10MB.
// Note/message bodies clamp at MAX_BODY=20000 chars, so 200 x 20KB ≈ 4MB is
// the binding constraint, not the op count. Task docs are small enough to
// stay on the op count.
const CHUNK_DOCS = 200;
const CHUNK_TASKS = 400;

const REMINDER_SOURCE = 'apple-reminders';
const VALID_PRIORITY = new Set(['high', 'medium', 'low']);
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// ⚠️ MIRRORED BY HAND in apps/desktop/src/shared/types.ts. apps/desktop is not
// in the root workspaces list and its tsconfig sets rootDir:"src", so it cannot
// import from here. Change one, change the other.
interface NoteIn { id?: string; title?: string; body?: string; folder?: string; source?: string; modifiedAt?: number }
interface MsgIn { id?: string; title?: string; body?: string; source?: string; modifiedAt?: number }
interface ReminderIn { id?: string; title?: string; notes?: string; dueDate?: string; completed?: boolean; priority?: string; list?: string }

interface ReminderSyncIn extends SourceSync { completedIds?: string[] }
interface SyncEnvelopeIn {
  v?: number;
  deviceId?: string;
  notes?: SourceSync;
  messages?: SourceSync;
  reminders?: ReminderSyncIn;
}

function clampStr(v: unknown, max: number): string {
  return typeof v === 'string' ? v.slice(0, max) : '';
}

function modTs(v: unknown): Timestamp | null {
  return typeof v === 'number' && isFinite(v) && v > 0 ? Timestamp.fromMillis(v) : null;
}

type Op =
  | { type: 'set'; id: string; data: Record<string, unknown>; merge?: boolean }
  | { type: 'delete'; id: string };

// Sequential on purpose: a parallel partial failure leaves an unpredictable
// half-state, where sequential commits fail at a known point and the next sync
// (5 minutes later) completes the rest.
async function commitOps(col: CollectionReference, ops: Op[], chunk: number): Promise<void> {
  for (let i = 0; i < ops.length; i += chunk) {
    const batch = col.firestore.batch();
    for (const op of ops.slice(i, i + chunk)) {
      if (op.type === 'delete') batch.delete(col.doc(op.id));
      else batch.set(col.doc(op.id), op.data, op.merge ? { merge: true } : {});
    }
    await batch.commit();
  }
}

interface ExistingDoc { contentHash?: string; deviceId?: string }

interface Existing<T> { byId: Map<string, T>; ids: string[] }

async function readExisting(q: CollectionReference | Query): Promise<Existing<ExistingDoc>> {
  // .select() is required, not an optimisation: without a projection this
  // pulls up to 500 x 20KB of bodies every sync, which is strictly worse than
  // the writes it exists to remove. (It cuts bandwidth, not read cost —
  // Firestore bills per document read regardless of projection.)
  const snap = await q.select('contentHash', 'deviceId').get();
  const byId = new Map<string, ExistingDoc>();
  const ids: string[] = [];
  snap.docs.forEach((d) => {
    byId.set(d.id, d.data() as ExistingDoc);
    ids.push(d.id);
  });
  return { byId, ids };
}

/** Docs stamped by a different Mac. Never deletable by this payload. */
function protectedFor(existing: Existing<ExistingDoc>, deviceId: string | null): Set<string> {
  const out = new Set<string>();
  if (!deviceId) return out;
  existing.byId.forEach((d, id) => {
    if (d.deviceId && d.deviceId !== deviceId) out.add(id);
  });
  return out;
}

/**
 * Notes and messages are structurally identical (title/body/[folder]/source/
 * modifiedAt), so they share one path — otherwise every rule above has to be
 * written twice and will drift once.
 */
async function syncDocCollection(args: {
  col: CollectionReference;
  records: (NoteIn | MsgIn)[];
  sync: SourceSync | undefined;
  deviceId: string | null;
  defaultSource: string;
  withFolder: boolean;
}): Promise<{ written: number; skipped: number; reconcile: ReconcileOutcome }> {
  const { col, records, sync, deviceId, defaultSource, withFolder } = args;

  const existing = await readExisting(col);
  const ops: Op[] = [];
  const recordDocIds: string[] = [];
  let written = 0;
  let skipped = 0;

  for (const r of records) {
    const id = safeId(r.id);
    if (!id) continue;
    recordDocIds.push(id);

    const fields: Record<string, unknown> = {
      title: clampStr(r.title, MAX_TITLE),
      body: clampStr(r.body, MAX_BODY),
      source: clampStr(r.source, 60) || defaultSource,
      modifiedAt: modTs(r.modifiedAt),
    };
    if (withFolder) {
      fields.folder = typeof (r as NoteIn).folder === 'string' ? (r as NoteIn).folder!.slice(0, 200) : null;
    }

    const hash = contentHash({ ...fields, deviceId });
    const prev = existing.byId.get(id);
    if (prev && !shouldWrite(prev.contentHash, hash)) {
      skipped++;
      continue;
    }
    ops.push({
      type: 'set',
      id,
      data: { ...fields, contentHash: hash, deviceId, updatedAt: FieldValue.serverTimestamp() },
    });
    written++;
  }

  const plan = planReconcile({
    existingIds: existing.ids,
    recordDocIds,
    sync,
    protectedIds: protectedFor(existing, deviceId),
  });
  for (const id of plan.deleteIds) ops.push({ type: 'delete', id });

  await commitOps(col, ops, CHUNK_DOCS);

  return {
    written,
    skipped,
    reconcile: plan.skipped ? { skipped: plan.skipped } : { deleted: plan.deleteIds.length },
  };
}

export async function POST(req: Request) {
  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;
  const { uid } = auth;

  let body: { notes?: NoteIn[]; messages?: MsgIn[]; reminders?: ReminderIn[]; sync?: SyncEnvelopeIn };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const notes = Array.isArray(body.notes) ? body.notes.slice(0, MAX_ITEMS) : [];
  const messages = Array.isArray(body.messages) ? body.messages.slice(0, MAX_ITEMS) : [];
  const reminders = Array.isArray(body.reminders) ? body.reminders.slice(0, MAX_ITEMS) : [];

  // ⚠️ The record arrays above are sliced. The id lists inside `sync` are NOT,
  // and must never be — truncating allIds turns every id past the cutoff into a
  // delete. planReconcile refuses an over-ceiling list instead.
  const env = body.sync && typeof body.sync === 'object' ? body.sync : undefined;
  const deviceId = env && typeof env.deviceId === 'string' ? env.deviceId.slice(0, 128) : null;

  // The capability toggles now gate INGESTION, not just whether chat may read
  // the result. Previously "Apple Notes: off" left every synced body sitting in
  // Firestore and the /notes page rendering all of them, which is not what off
  // means to anyone. It is also what makes /api/desktop/clear durable: without
  // this, a purge is undone by the next sync 5 minutes later.
  //
  // Enforced server-side on purpose — it takes effect the moment the user flips
  // the toggle, with no desktop release and no version skew.
  const userSnap = await adminDb.collection('users').doc(uid).get();
  const userData = (userSnap.data() ?? {}) as {
    capabilities?: Record<string, boolean>;
    settings?: { capabilities?: Record<string, boolean> };
  };
  const caps: Record<string, boolean> = {
    ...(userData.capabilities ?? {}),
    ...(userData.settings?.capabilities ?? {}),
  };
  // Matches the defaults the chat route reads: notesSync defaults ON,
  // messagesSync defaults OFF (it carries other people's messages).
  const notesAllowed = caps.notesSync !== false;
  const messagesAllowed = caps.messagesSync === true;

  // A source runs when it has records to write, or when a complete envelope
  // says something should be deleted. The second half is what lets "the user
  // deleted their last few notes" reconcile; the first half preserves the old
  // property that a legacy all-empty payload is a total no-op.
  const active = (recs: unknown[], s: SourceSync | undefined) =>
    recs.length > 0 || (s?.complete === true && (s.allIds?.length ?? 0) > 0);

  // What to report when a source never ran. Mirrors planReconcile's early
  // returns rather than defaulting to 'no-envelope', so "FDA was revoked" and
  // "this build is too old" stay distinguishable in the desktop log. A wrong
  // reason here is not a data bug, but it is the difference between diagnosing
  // a silent sync in one log line and not diagnosing it at all.
  const idleOutcome = (s: SourceSync | undefined): ReconcileOutcome => {
    if (!s || typeof s !== 'object') return { skipped: 'no-envelope' };
    if (!Array.isArray(s.allIds) || s.complete !== true) return { skipped: 'incomplete' };
    if (s.allIds.length === 0) return { skipped: 'empty-ids' };
    return { deleted: 0 };
  };

  let notesWritten = 0;
  let messagesWritten = 0;
  let remindersWritten = 0;
  let notesSkipped = 0;
  let messagesSkipped = 0;
  let remindersSkipped = 0;
  const capOff: ReconcileOutcome = { skipped: 'capability-off' };
  const reconcile: { notes: ReconcileOutcome; messages: ReconcileOutcome; reminders: ReconcileOutcome } = {
    notes: notesAllowed ? idleOutcome(env?.notes) : capOff,
    messages: messagesAllowed ? idleOutcome(env?.messages) : capOff,
    reminders: idleOutcome(env?.reminders),
  };

  try {
    if (notesAllowed && active(notes, env?.notes)) {
      const r = await syncDocCollection({
        col: adminDb.collection('users').doc(uid).collection('notes'),
        records: notes,
        sync: env?.notes,
        deviceId,
        defaultSource: 'desktop-apple-notes',
        withFolder: true,
      });
      notesWritten = r.written;
      notesSkipped = r.skipped;
      reconcile.notes = r.reconcile;
    }

    if (messagesAllowed && active(messages, env?.messages)) {
      const r = await syncDocCollection({
        col: adminDb.collection('users').doc(uid).collection('messages'),
        records: messages,
        sync: env?.messages,
        deviceId,
        defaultSource: 'desktop-imessage',
        withFolder: false,
      });
      messagesWritten = r.written;
      messagesSkipped = r.skipped;
      reconcile.messages = r.reconcile;
    }

    // Apple Reminders → MODUS tasks (shows in the Reminders section). One-way
    // sync that respects the user's own edits: existing tasks keep their MODUS
    // done/deleted state; reminders completed/removed in Apple are reflected;
    // tasks the user manually created (no apple-reminders source) are untouched.
    if (active(reminders, env?.reminders)) {
      const col = adminDb.collection('users').doc(uid).collection('tasks');

      // Single-field where → no composite index needed.
      type TaskDoc = ExistingDoc & { done?: boolean; deleted?: boolean };
      const snap = await col
        .where('source', '==', REMINDER_SOURCE)
        .select('contentHash', 'deviceId', 'done', 'deleted')
        .get();
      const existing: Existing<TaskDoc> = { byId: new Map<string, TaskDoc>(), ids: [] };
      snap.docs.forEach((d) => {
        existing.byId.set(d.id, d.data() as TaskDoc);
        existing.ids.push(d.id);
      });

      const ops: Op[] = [];
      const recordDocIds: string[] = [];

      for (const r of reminders) {
        const rid = safeId(r.id);
        if (!rid) continue;
        const docId = reminderDocId(rid);
        recordDocIds.push(docId);
        const prev = existing.byId.get(docId);

        if (r.completed) {
          // Completed in Apple → mark done in MODUS (only if we already track it).
          if (prev && prev.done !== true) {
            ops.push({ type: 'set', id: docId, data: { done: true, updatedAt: FieldValue.serverTimestamp() }, merge: true });
          }
          continue;
        }

        // Active reminder: fields that always mirror Apple.
        const fields: Record<string, unknown> = {
          title: clampStr(r.title, MAX_TITLE),
          description: typeof r.notes === 'string' ? r.notes.slice(0, 2000) : '',
          dueDate: typeof r.dueDate === 'string' && DATE_RE.test(r.dueDate) ? r.dueDate : null,
          priority: typeof r.priority === 'string' && VALID_PRIORITY.has(r.priority) ? r.priority : null,
          source: REMINDER_SOURCE,
        };
        // Hash covers only the Apple-mirrored fields — never done/deleted/
        // createdAt, which are MODUS-owned and must not force a rewrite.
        const hash = contentHash({ ...fields, deviceId });

        if (prev && !shouldWrite(prev.contentHash, hash)) {
          remindersSkipped++;
          continue;
        }
        const data: Record<string, unknown> = {
          ...fields,
          contentHash: hash,
          deviceId,
          updatedAt: FieldValue.serverTimestamp(),
        };
        if (!prev) {
          // New task — initialize MODUS-managed state. (Don't touch these on
          // update, so the user checking it off / deleting it in MODUS sticks.)
          data.done = false;
          data.deleted = false;
          data.createdAt = FieldValue.serverTimestamp();
        }
        ops.push({ type: 'set', id: docId, data, merge: true });
        remindersWritten++;
      }

      // Completed reminders sort LAST under `ZCOMPLETED ASC, ZDUEDATE ASC` and
      // are the first thing MAX_REMINDERS truncates, so they routinely never
      // reach `records`. Without this list they would sit open in MODUS
      // forever now that falling out of `records` no longer deletes them.
      const completedIds = Array.isArray(env?.reminders?.completedIds) ? env.reminders.completedIds : [];
      for (const raw of completedIds) {
        const rid = safeId(raw);
        if (!rid) continue;
        const docId = reminderDocId(rid);
        const prev = existing.byId.get(docId);
        if (prev && prev.done !== true) {
          ops.push({ type: 'set', id: docId, data: { done: true, updatedAt: FieldValue.serverTimestamp() }, merge: true });
        }
      }

      // Reminders removed from Apple → soft-delete (not hard, unlike notes:
      // a task carries the user's own done/deleted state).
      const plan = planReconcile({
        existingIds: existing.ids,
        recordDocIds,
        sync: env?.reminders,
        toDocId: reminderDocId,
        protectedIds: protectedFor(existing, deviceId),
      });
      for (const id of plan.deleteIds) {
        // Already tombstoned — re-writing it every 5 minutes forever was pure
        // write amplification that grew with lifetime deletions.
        if (existing.byId.get(id)?.deleted === true) continue;
        ops.push({ type: 'set', id, data: { deleted: true, updatedAt: FieldValue.serverTimestamp() }, merge: true });
      }

      await commitOps(col, ops, CHUNK_TASKS);
      reconcile.reminders = plan.skipped ? { skipped: plan.skipped } : { deleted: plan.deleteIds.length };
    }

    // Once the per-doc updatedAt stops moving (that is the point of the content
    // hash), this is the only remaining "is this user's desktop alive" signal.
    // One write per sync, not five hundred.
    await adminDb.collection('users').doc(uid).set(
      { desktopLastSyncAt: FieldValue.serverTimestamp() },
      { merge: true }
    );
  } catch (e) {
    console.error('[desktop/ingest] write failed', e);
    return Response.json({ error: 'write_failed' }, { status: 500 });
  }

  return Response.json({
    ok: true,
    notesWritten,
    messagesWritten,
    remindersWritten,
    notesSkipped,
    messagesSkipped,
    remindersSkipped,
    reconcile,
  });
}
