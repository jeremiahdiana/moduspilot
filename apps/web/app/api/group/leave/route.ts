import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { verifyRequest, getUserGroupId, jsonError } from '@/lib/groups';

// A non-owner member leaves the group. (Owners disband via /api/group/delete.)
export async function POST(req: Request) {
  const user = await verifyRequest(req);
  if (!user) return jsonError('Unauthorized', 401);

  const groupId = await getUserGroupId(user.uid);
  if (!groupId) return jsonError('You are not in a group', 404);

  const groupRef = adminDb.collection('groups').doc(groupId);
  const group = (await groupRef.get()).data();
  if (!group) {
    await adminDb.collection('users').doc(user.uid).set({ groupId: FieldValue.delete() }, { merge: true });
    return Response.json({ ok: true });
  }
  if (group.ownerUid === user.uid) {
    return jsonError('Owners disband the group instead of leaving', 400);
  }

  const batch = adminDb.batch();
  batch.update(groupRef, { memberUids: FieldValue.arrayRemove(user.uid) });
  batch.delete(groupRef.collection('members').doc(user.uid));
  batch.set(adminDb.collection('users').doc(user.uid), { groupId: FieldValue.delete() }, { merge: true });
  await batch.commit();

  return Response.json({ ok: true });
}
