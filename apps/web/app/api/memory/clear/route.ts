import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { clearMemories } from '@/lib/pinecone';
import { getFirestore } from 'firebase-admin/firestore';
import { initializeApp, getApps, getApp, cert } from 'firebase-admin/app';

function adminApp() {
  if (getApps().length) return getApp();
  return initializeApp({ credential: cert({
    projectId:   process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey:  process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  }) });
}

export async function DELETE(req: Request) {
  try {
    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    let uid: string;
    try {
      const decoded = await adminAuth.verifyIdToken(token);
      uid = decoded.uid;
    } catch {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Clear Pinecone semantic memories
    if (process.env.PINECONE_API_KEY) {
      await clearMemories(uid);
    }

    // Clear Firestore memories subcollection via batch delete
    const db = getFirestore(adminApp());
    const snap = await db.collection('users').doc(uid).collection('memories').get();
    if (!snap.empty) {
      const batch = db.batch();
      snap.docs.forEach(d => batch.delete(d.ref));
      await batch.commit();
    }

    return Response.json({ ok: true, cleared: snap.size });
  } catch (e) {
    console.error('[memory/clear]', e);
    return Response.json({ error: 'Failed to clear memories' }, { status: 500 });
  }
}
