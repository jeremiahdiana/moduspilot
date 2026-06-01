import { adminDb } from '@/lib/firebase-admin';
import { requireAuth } from '@/lib/api-auth';
import { clearMemories } from '@/lib/pinecone';

export async function DELETE(req: Request) {
  try {
    const auth = await requireAuth(req);
    if (auth instanceof Response) return auth;
    const { uid } = auth;

    // Clear Pinecone semantic memories
    if (process.env.PINECONE_API_KEY) {
      await clearMemories(uid);
    }

    // Clear Firestore memories subcollection via batch delete
    const memoriesRef = adminDb.collection('users').doc(uid).collection('memories');
    const snap = await memoriesRef.get();
    if (!snap.empty) {
      const batch = memoriesRef.firestore.batch();
      snap.docs.forEach(d => batch.delete(d.ref));
      await batch.commit();
    }

    return Response.json({ ok: true, cleared: snap.size });
  } catch (e) {
    console.error('[memory/clear]', e);
    return Response.json({ error: 'Failed to clear memories' }, { status: 500 });
  }
}
