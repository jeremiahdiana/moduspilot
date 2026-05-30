import { adminAuth, adminDb } from '@/lib/firebase-admin';

/**
 * Permanently deletes the authenticated user's account: all Firestore data
 * (user doc + every subcollection) and the Firebase Auth user. Runs with the
 * Admin SDK because clients are blocked from deleting the user doc (which would
 * otherwise let them reset rate limits / trial by deleting and recreating it).
 */
export async function POST(req: Request) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  let uid: string;
  try {
    uid = (await adminAuth.verifyIdToken(token)).uid;
  } catch {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Deletes users/{uid} and all of its subcollections (goals, tasks, habits,
    // conversations, memories, etc.).
    await adminDb.recursiveDelete(`users/${uid}`);
    await adminAuth.deleteUser(uid);
    return Response.json({ ok: true });
  } catch (err) {
    console.error(`[account/delete] failed for uid ${uid}:`, err);
    return Response.json({ error: 'delete_failed' }, { status: 500 });
  }
}
