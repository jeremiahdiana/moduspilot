import { requireAuth } from '@/lib/api-auth';
import { adminDb } from '@/lib/firebase-admin';

/**
 * Delete everything MODUS Desktop has synced for a source.
 *
 * The counterpart to the capability toggles. Turning `notesSync` off only ever
 * gated whether chat could READ the notes — the bodies stayed in Firestore
 * indefinitely and the /notes page kept rendering all of them, so "off" did not
 * mean what anyone would reasonably assume it meant. This is the actual delete.
 *
 * ⚠️ Purging is only durable because the ingest route refuses a source whose
 * capability is off (see app/api/desktop/ingest/route.ts). Without that, the
 * desktop would repopulate everything within 5 minutes and this endpoint would
 * be a very convincing no-op.
 */

// Firestore caps a batch at 500 ops. Deletes carry no payload, so the op count
// is the only binding limit here.
const CHUNK = 400;
const SOURCES = { notes: 'notes', messages: 'messages' } as const;
type Source = keyof typeof SOURCES;

async function purge(uid: string, source: Source): Promise<number> {
  const col = adminDb.collection('users').doc(uid).collection(SOURCES[source]);
  // select() with no fields fetches ids only — the bodies run to 20k chars each
  // and we are about to throw them away.
  const snap = await col.select().get();
  const docs = snap.docs;
  for (let i = 0; i < docs.length; i += CHUNK) {
    const batch = col.firestore.batch();
    for (const d of docs.slice(i, i + CHUNK)) batch.delete(d.ref);
    await batch.commit();
  }
  return docs.length;
}

export async function DELETE(req: Request) {
  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;
  const { uid } = auth;

  const param = new URL(req.url).searchParams.get('sources') ?? '';
  const requested = param.split(',').map((s) => s.trim()).filter(Boolean);
  const sources = requested.filter((s): s is Source => s in SOURCES);
  if (sources.length === 0) {
    return Response.json({ error: 'sources must include notes and/or messages' }, { status: 400 });
  }

  try {
    const cleared: Record<string, number> = {};
    for (const s of sources) cleared[s] = await purge(uid, s);
    console.log(`[desktop/clear] uid=${uid} cleared`, cleared);
    return Response.json({ ok: true, cleared });
  } catch (e) {
    console.error('[desktop/clear] failed', e);
    return Response.json({ error: 'clear_failed' }, { status: 500 });
  }
}
