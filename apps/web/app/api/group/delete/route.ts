import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { verifyRequest, getUserGroupId, jsonError } from '@/lib/groups';

// Owner-only: disbands the group, clearing every member's groupId and removing
// the group, its members, shared items, and any pending invites.
export async function POST(req: Request) {
  const user = await verifyRequest(req);
  if (!user) return jsonError('Unauthorized', 401);

  const groupId = await getUserGroupId(user.uid);
  if (!groupId) return jsonError('You are not in a group', 404);

  const groupRef = adminDb.collection('groups').doc(groupId);
  const group = (await groupRef.get()).data();
  if (!group) return jsonError('Group not found', 404);
  if (group.ownerUid !== user.uid) return jsonError('Only the owner can disband the group', 403);

  const memberUids: string[] = group.memberUids ?? [];

  // Clear groupId on every member's user doc + remove any pending invites.
  const batch = adminDb.batch();
  for (const uid of memberUids) {
    batch.set(adminDb.collection('users').doc(uid), { groupId: FieldValue.delete() }, { merge: true });
  }
  const invites = await adminDb.collection('groupInvites').where('groupId', '==', groupId).get();
  invites.forEach(d => batch.delete(d.ref));
  await batch.commit();

  // Tear down the group doc + its members/shared subcollections in one call.
  await adminDb.recursiveDelete(`groups/${groupId}`);

  return Response.json({ ok: true });
}
