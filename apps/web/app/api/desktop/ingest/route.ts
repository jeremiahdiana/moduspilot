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

  let body: { notes?: NoteIn[]; messages?: MsgIn[] };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const notes = Array.isArray(body.notes) ? body.notes.slice(0, MAX_ITEMS) : [];
  const messages = Array.isArray(body.messages) ? body.messages.slice(0, MAX_ITEMS) : [];

  let notesWritten = 0;
  let messagesWritten = 0;

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
  } catch (e) {
    console.error('[desktop/ingest] write failed', e);
    return Response.json({ error: 'write_failed' }, { status: 500 });
  }

  return Response.json({ ok: true, notesWritten, messagesWritten });
}
