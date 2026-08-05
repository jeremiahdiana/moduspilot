/**
 * End-to-end proof that /api/desktop/ingest actually deletes, actually refuses
 * to delete, and actually skips unchanged writes — against the real route, real
 * Firebase auth and real Firestore.
 *
 * verify-sync-reconcile.ts pins the decision. This pins the plumbing around it:
 * the envelope surviving JSON, the batching, hard vs soft delete, and the
 * backward compatibility that lets an old desktop keep working.
 *
 * Runs entirely under a throwaway uid and deletes it afterwards, so it never
 * touches a real account. Needs the dev server up:
 *
 *   cd apps/web && npm run dev
 *   cd apps/web && npx tsx scripts/verify-sync-ingest-live.ts
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';

for (const line of readFileSync(resolve(process.cwd(), '.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (!m) continue;
  let v = m[2];
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  if (!(m[1] in process.env)) process.env[m[1]] = v;
}

const BASE = process.env.INGEST_BASE ?? 'http://localhost:3000';
const UID = `__verify_sync_${Date.now()}`;

let failures = 0;
function check(name: string, ok: boolean, why: string) {
  if (!ok) failures++;
  console.log(`${ok ? '✅' : '❌'} ${name}  — ${why}`);
}

interface Envelope {
  v: 2;
  deviceId: string;
  notes?: { allIds: string[]; complete: boolean };
  reminders?: { allIds: string[]; complete: boolean; completedIds: string[] };
}
interface IngestBody {
  notes?: unknown[];
  reminders?: unknown[];
  sync?: Envelope;
}
interface IngestRes {
  ok?: boolean;
  notesWritten?: number;
  notesSkipped?: number;
  remindersWritten?: number;
  reconcile?: Record<string, { deleted?: number; skipped?: string }>;
  error?: string;
}

const note = (id: string, body = 'x') => ({
  id,
  title: `note ${id}`,
  body,
  folder: 'Notes',
  source: 'desktop-apple-notes',
  modifiedAt: 1_700_000_000_000,
});

async function main() {
  const { adminDb, adminAuth } = await import('@/lib/firebase-admin');

  // Mint a real ID token for the throwaway uid: custom token → Identity
  // Toolkit exchange. requireAuth calls verifyIdToken, so nothing here is
  // mocked or bypassed.
  const customToken = await adminAuth.createCustomToken(UID);
  const key = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if (!key) throw new Error('NEXT_PUBLIC_FIREBASE_API_KEY missing from .env.local');
  const exchange = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${key}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: customToken, returnSecureToken: true }),
    }
  );
  const exchanged = (await exchange.json()) as { idToken?: string; error?: { message: string } };
  if (!exchanged.idToken) throw new Error(`token exchange failed: ${JSON.stringify(exchanged.error)}`);
  const idToken = exchanged.idToken;

  const post = async (body: IngestBody): Promise<IngestRes> => {
    const res = await fetch(`${BASE}/api/desktop/ingest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
      body: JSON.stringify(body),
    });
    return (await res.json()) as IngestRes;
  };

  const noteIds = async (): Promise<string[]> => {
    const snap = await adminDb.collection('users').doc(UID).collection('notes').get();
    return snap.docs.map((d) => d.id).sort();
  };
  const taskState = async (): Promise<Record<string, { deleted?: boolean; done?: boolean }>> => {
    const snap = await adminDb.collection('users').doc(UID).collection('tasks').get();
    const out: Record<string, { deleted?: boolean; done?: boolean }> = {};
    snap.docs.forEach((d) => {
      const v = d.data() as { deleted?: boolean; done?: boolean };
      out[d.id] = { deleted: v.deleted, done: v.done };
    });
    return out;
  };

  const dev = 'device-A';

  try {
    console.log(`\nuid ${UID}  base ${BASE}`);

    // ── 1. Legacy desktop: writes land, nothing is ever deleted ──────────
    console.log('\n── legacy (no envelope) ──');
    let r = await post({ notes: [note('n1'), note('n2'), note('n3')] });
    check(
      'legacy payload writes all 3 notes',
      r.notesWritten === 3 && (await noteIds()).length === 3,
      'an old desktop build must keep working unchanged',
    );
    check(
      'legacy payload reports no-envelope',
      r.reconcile?.notes?.skipped === 'no-envelope',
      'the reconcile key doubles as the server capability probe',
    );

    r = await post({ notes: [note('n1')] });
    check(
      'legacy payload with fewer notes deletes nothing',
      (await noteIds()).length === 3,
      'BUG shape: absence from records must never mean deletion',
    );

    // ── 2. The actual ask: a deleted note leaves Firestore ───────────────
    console.log('\n── v2 envelope: deletion ──');
    r = await post({
      notes: [note('n1'), note('n2')],
      sync: { v: 2, deviceId: dev, notes: { allIds: ['n1', 'n2'], complete: true } },
    });
    check(
      'note deleted on the Mac is hard-deleted in Firestore',
      r.reconcile?.notes?.deleted === 1 && JSON.stringify(await noteIds()) === JSON.stringify(['n1', 'n2']),
      'the question that started this: it now leaves chat context too',
    );

    // ── 3. Unchanged content does not write ─────────────────────────────
    console.log('\n── write skip ──');
    r = await post({
      notes: [note('n1'), note('n2')],
      sync: { v: 2, deviceId: dev, notes: { allIds: ['n1', 'n2'], complete: true } },
    });
    check(
      'identical resync writes 0 and skips 2',
      r.notesWritten === 0 && r.notesSkipped === 2,
      'this is the ~150k writes/day/user that used to be spent on nothing',
    );

    r = await post({
      notes: [note('n1', 'edited body'), note('n2')],
      sync: { v: 2, deviceId: dev, notes: { allIds: ['n1', 'n2'], complete: true } },
    });
    check(
      'an edited note still writes',
      r.notesWritten === 1 && r.notesSkipped === 1,
      'the skip must not freeze real edits out of the model',
    );

    // ── 4. Every refusal path, against the real route ───────────────────
    console.log('\n── refusals ──');
    r = await post({
      notes: [],
      sync: { v: 2, deviceId: dev, notes: { allIds: ['n1'], complete: false } },
    });
    check(
      'incomplete read deletes nothing',
      r.reconcile?.notes?.skipped === 'incomplete' && (await noteIds()).length === 2,
      'a failed snapshot or revoked FDA costs staleness, never data',
    );

    r = await post({
      notes: [],
      sync: { v: 2, deviceId: dev, notes: { allIds: [], complete: true } },
    });
    check(
      'empty id list deletes nothing',
      r.reconcile?.notes?.skipped === 'empty-ids' && (await noteIds()).length === 2,
      'a future macOS schema change must not wipe the collection',
    );

    r = await post({
      notes: [note('ghost')],
      sync: { v: 2, deviceId: dev, notes: { allIds: ['n1', 'n2'], complete: true } },
    });
    check(
      'self-inconsistent payload deletes nothing',
      r.reconcile?.notes?.skipped === 'records-not-subset',
      'it sent a record it then omitted from its own id list',
    );

    // ── 5. Another Mac cannot delete this Mac's notes ────────────────────
    console.log('\n── two Macs ──');
    await post({
      notes: [note('n1'), note('n2')],
      sync: { v: 2, deviceId: dev, notes: { allIds: ['n1', 'n2'], complete: true } },
    });
    r = await post({
      notes: [note('b1')],
      sync: { v: 2, deviceId: 'device-B', notes: { allIds: ['b1'], complete: true } },
    });
    check(
      "device B does not delete device A's notes",
      (await noteIds()).includes('n1') && (await noteIds()).includes('b1'),
      'otherwise two Macs wipe each other every 5 minutes, forever',
    );

    // ── 6. Chunking: more ops than CHUNK_DOCS in one request ─────────────
    console.log('\n── batching ──');
    const many = Array.from({ length: 260 }, (_, i) => note(`bulk${i}`));
    r = await post({
      notes: many,
      sync: {
        v: 2,
        deviceId: dev,
        notes: { allIds: many.map((n) => n.id), complete: true },
      },
    });
    {
      // 260 sets + the deletes for n1/n2, past CHUNK_DOCS=200 in one request.
      // b1 belongs to device B and must survive, so the expected total is 261,
      // not 260 — that is the device scoping from the previous check still
      // holding while a bulk write goes through.
      const after = await noteIds();
      check(
        '260 writes commit across chunks alongside deletes',
        r.notesWritten === 260 &&
          many.every((n) => after.includes(n.id)) &&
          after.includes('b1') &&
          !after.includes('n1'),
        'the old single batch sat at exactly the 500-op limit with zero headroom',
      );
    }

    // ── 7. Reminders: soft delete, and the two confirmed bugs ────────────
    console.log('\n── reminders ──');
    const rem = (id: string, completed = false) => ({
      id, title: `rem ${id}`, notes: '', dueDate: '2026-09-01', completed, priority: 'low',
    });
    r = await post({
      reminders: [rem('r1'), rem('r2'), rem('r3')],
      sync: {
        v: 2, deviceId: dev,
        reminders: { allIds: ['r1', 'r2', 'r3'], complete: true, completedIds: [] },
      },
    });
    check(
      '3 reminders become 3 tasks',
      r.remindersWritten === 3 && Object.keys(await taskState()).length === 3,
      '',
    );

    // BUG 1: one of two account stores failed → partial list, complete:false
    r = await post({
      reminders: [rem('r1')],
      sync: {
        v: 2, deviceId: dev,
        reminders: { allIds: ['r1'], complete: false, completedIds: [] },
      },
    });
    {
      const t = await taskState();
      check(
        'BUG 1 fixed: a failed store does not soft-delete the other account',
        r.reconcile?.reminders?.skipped === 'incomplete' &&
          t['apple-r2']?.deleted !== true && t['apple-r3']?.deleted !== true,
        'this used to permanently delete every task from the failed account',
      );
    }

    // BUG 2: the 300-per-store cap truncated records, not allIds
    r = await post({
      reminders: [rem('r1')],
      sync: {
        v: 2, deviceId: dev,
        reminders: { allIds: ['r1', 'r2', 'r3'], complete: true, completedIds: [] },
      },
    });
    {
      const t = await taskState();
      check(
        'BUG 2 fixed: a capped record list does not soft-delete the remainder',
        r.reconcile?.reminders?.deleted === 0 &&
          t['apple-r2']?.deleted !== true && t['apple-r3']?.deleted !== true,
        'reminders past the cap used to be deleted on every single sync',
      );
    }

    // A reminder genuinely removed in Apple
    r = await post({
      reminders: [rem('r1'), rem('r2')],
      sync: {
        v: 2, deviceId: dev,
        reminders: { allIds: ['r1', 'r2'], complete: true, completedIds: [] },
      },
    });
    check(
      'a reminder removed in Apple is soft-deleted',
      r.reconcile?.reminders?.deleted === 1 && (await taskState())['apple-r3']?.deleted === true,
      'soft, not hard: a task carries the user\'s own done/deleted state',
    );

    // completedIds marks done even when the record was truncated away
    r = await post({
      reminders: [rem('r1')],
      sync: {
        v: 2, deviceId: dev,
        reminders: { allIds: ['r1', 'r2'], complete: true, completedIds: ['r2'] },
      },
    });
    check(
      'completedIds marks a truncated-away reminder done',
      (await taskState())['apple-r2']?.done === true,
      'completed reminders sort last and are the first thing the cap drops',
    );
  } finally {
    await adminDb.recursiveDelete(`users/${UID}`);
    await adminAuth.deleteUser(UID).catch(() => {});
    console.log(`\ncleaned up ${UID}`);
  }

  console.log(`\n${failures === 0 ? '✅ all checks passed' : `❌ ${failures} check(s) failed`}`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => { console.error('FATAL:', e); process.exit(1); });
