import { requireAuth } from '@/lib/api-auth';
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';

// Ingest endpoint for MODUS Desktop. The desktop app reads local Apple Notes /
// iMessage, then POSTs them here authenticated with the user's Firebase ID
// token (pulled from the signed-in website window it hosts) — so the agent
// needs no separate login or its own Firebase auth. Writes the same doc shapes
// the old in-app bridge used, so fetchNotesBlock / fetchMessagesBlock
// (orderBy modifiedAt) keep working unchanged.

const MAX_ITEMS = 500; // Firestore batch cap
const MAX_TITLE = 200;
const MAX_BODY = 20000;

interface NoteIn { id?: string; title?: string; body?: string; folder?: string; source?: string; modifiedAt?: number }
interface MsgIn { id?: string; title?: string; body?: string; source?: string; modifiedAt?: number }
interface ReminderIn { id?: string; title?: string; notes?: string; dueDate?: string; completed?: boolean; priority?: string; list?: string }

const REMINDER_SOURCE = 'apple-reminders';
const VALID_PRIORITY = new Set(['high', 'medium', 'low']);
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function clampStr(v: unknown, max: number): string {
  return typeof v === 'string' ? v.slice(0, max) : '';
}

function safeId(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  // Firestore doc IDs can't contain '/', can't be '.'/'..', must be non-empty.
  if (!t || t.length > 256 || t.includes('/') || t === '.' || t === '..') return null;
  return t;
}

function modTs(v: unknown): Timestamp | null {
  return typeof v === 'number' && isFinite(v) && v > 0 ? Timestamp.fromMillis(v) : null;
}

export async function POST(req: Request) {
  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;
  const { uid } = auth;

  let body: { notes?: NoteIn[]; messages?: MsgIn[]; reminders?: ReminderIn[] };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const notes = Array.isArray(body.notes) ? body.notes.slice(0, MAX_ITEMS) : [];
  const messages = Array.isArray(body.messages) ? body.messages.slice(0, MAX_ITEMS) : [];
  const reminders = Array.isArray(body.reminders) ? body.reminders.slice(0, MAX_ITEMS) : [];

  let notesWritten = 0;
  let messagesWritten = 0;
  let remindersWritten = 0;

  try {
    if (notes.length > 0) {
      const col = adminDb.collection('users').doc(uid).collection('notes');
      const batch = col.firestore.batch();
      for (const r of notes) {
        const id = safeId(r.id);
        if (!id) continue;
        batch.set(col.doc(id), {
          title: clampStr(r.title, MAX_TITLE),
          body: clampStr(r.body, MAX_BODY),
          folder: typeof r.folder === 'string' ? r.folder.slice(0, 200) : null,
          source: clampStr(r.source, 60) || 'desktop-apple-notes',
          modifiedAt: modTs(r.modifiedAt),
          updatedAt: FieldValue.serverTimestamp(),
        });
        notesWritten++;
      }
      await batch.commit();
    }

    if (messages.length > 0) {
      const col = adminDb.collection('users').doc(uid).collection('messages');
      const batch = col.firestore.batch();
      for (const r of messages) {
        const id = safeId(r.id);
        if (!id) continue;
        batch.set(col.doc(id), {
          title: clampStr(r.title, MAX_TITLE),
          body: clampStr(r.body, MAX_BODY),
          source: clampStr(r.source, 60) || 'desktop-imessage',
          modifiedAt: modTs(r.modifiedAt),
          updatedAt: FieldValue.serverTimestamp(),
        });
        messagesWritten++;
      }
      await batch.commit();
    }

    // Apple Reminders → MODUS tasks (shows in the Reminders section). One-way
    // sync that respects the user's own edits: existing tasks keep their MODUS
    // done/deleted state; reminders completed/removed in Apple are reflected;
    // tasks the user manually created (no apple-reminders source) are untouched.
    if (reminders.length > 0) {
      const col = adminDb.collection('users').doc(uid).collection('tasks');

      // Existing apple-sourced tasks, keyed by their reminder id (doc id is
      // `apple-<reminderId>`). Single-field where → no composite index needed.
      const existingSnap = await col.where('source', '==', REMINDER_SOURCE).get();
      const existingIds = new Set(existingSnap.docs.map((d) => d.id));

      // Collect all writes, then commit in <=400-op chunks (Firestore caps a
      // batch at 500) so a large reminder list + reconciliation can't overflow.
      const ops: { id: string; data: Record<string, unknown> }[] = [];
      const incomingDocIds = new Set<string>();

      for (const r of reminders) {
        const rid = safeId(r.id);
        if (!rid) continue;
        const docId = `apple-${rid}`.slice(0, 256);
        incomingDocIds.add(docId);
        const exists = existingIds.has(docId);

        if (r.completed) {
          // Completed in Apple → mark done in MODUS (only if we already track it).
          if (exists) ops.push({ id: docId, data: { done: true, updatedAt: FieldValue.serverTimestamp() } });
          continue;
        }

        // Active reminder: fields that always mirror Apple.
        const fields: Record<string, unknown> = {
          title: clampStr(r.title, MAX_TITLE),
          description: typeof r.notes === 'string' ? r.notes.slice(0, 2000) : '',
          dueDate: typeof r.dueDate === 'string' && DATE_RE.test(r.dueDate) ? r.dueDate : null,
          priority: typeof r.priority === 'string' && VALID_PRIORITY.has(r.priority) ? r.priority : null,
          source: REMINDER_SOURCE,
          updatedAt: FieldValue.serverTimestamp(),
        };
        if (!exists) {
          // New task — initialize MODUS-managed state. (Don't touch these on
          // update, so the user checking it off / deleting it in MODUS sticks.)
          fields.done = false;
          fields.deleted = false;
          fields.createdAt = FieldValue.serverTimestamp();
        }
        ops.push({ id: docId, data: fields });
        remindersWritten++;
      }

      // Reminders removed from Apple (no longer in the payload) → soft-delete the
      // corresponding MODUS task so it leaves the active list.
      existingSnap.docs.forEach((d) => {
        if (!incomingDocIds.has(d.id)) {
          ops.push({ id: d.id, data: { deleted: true, updatedAt: FieldValue.serverTimestamp() } });
        }
      });

      for (let i = 0; i < ops.length; i += 400) {
        const batch = col.firestore.batch();
        for (const op of ops.slice(i, i + 400)) batch.set(col.doc(op.id), op.data, { merge: true });
        await batch.commit();
      }
    }
  } catch (e) {
    console.error('[desktop/ingest] write failed', e);
    return Response.json({ error: 'write_failed' }, { status: 500 });
  }

  return Response.json({ ok: true, notesWritten, messagesWritten, remindersWritten });
}
