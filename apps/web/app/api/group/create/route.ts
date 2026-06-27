import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { verifyRequest, getUserGroupId, jsonError } from '@/lib/groups';

// Creates a new group owned by the requester and adds them as the first member.
export async function POST(req: Request) {
  const user = await verifyRequest(req);
  if (!user) return jsonError('Unauthorized', 401);

  // Only the Group plan can create a group (the owner's plan covers all seats;
  // invited members join for free without needing their own plan).
  const userSnap = await adminDb.collection('users').doc(user.uid).get();
  if (userSnap.data()?.plan !== 'group') {
    return jsonError('The Group plan is required to start a group', 402);
  }

  const existing = await getUserGroupId(user.uid);
  if (existing) return jsonError('You are already in a group', 409);

  const { name } = (await req.json().catch(() => ({}))) as { name?: string };
  const groupName = (name ?? '').trim().slice(0, 60) || 'My Group';

  const groupRef = adminDb.collection('groups').doc();
  const memberRef = groupRef.collection('members').doc(user.uid);
  const userRef = adminDb.collection('users').doc(user.uid);

  const batch = adminDb.batch();
  batch.set(groupRef, {
    ownerUid: user.uid,
    name: groupName,
    memberUids: [user.uid],
    createdAt: FieldValue.serverTimestamp(),
  });
  batch.set(memberRef, {
    uid: user.uid,
    email: user.email,
    displayName: user.name,
    role: 'owner',
    sharing: { availability: true },
    joinedAt: FieldValue.serverTimestamp(),
  });
  batch.set(userRef, { groupId: groupRef.id }, { merge: true });
  await batch.commit();

  return Response.json({ groupId: groupRef.id });
}
