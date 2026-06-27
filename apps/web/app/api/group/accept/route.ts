import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { verifyRequest, getUserGroupId, jsonError, MAX_GROUP_MEMBERS } from '@/lib/groups';

// Invitee accepts a pending invite addressed to their email.
export async function POST(req: Request) {
  const user = await verifyRequest(req);
  if (!user) return jsonError('Unauthorized', 401);
  if (!user.email) return jsonError('Your account has no email', 400);

  const { inviteId } = (await req.json().catch(() => ({}))) as { inviteId?: string };
  if (!inviteId) return jsonError('Missing invite');

  const existing = await getUserGroupId(user.uid);
  if (existing) return jsonError('You are already in a group', 409);

  const inviteRef = adminDb.collection('groupInvites').doc(inviteId);
  const inviteSnap = await inviteRef.get();
  const invite = inviteSnap.data();
  if (!invite || invite.status !== 'pending') return jsonError('Invite not found', 404);
  if (invite.email !== user.email.toLowerCase()) return jsonError('This invite is for a different email', 403);

  const groupRef = adminDb.collection('groups').doc(invite.groupId);

  try {
    await adminDb.runTransaction(async tx => {
      const groupSnap = await tx.get(groupRef);
      const group = groupSnap.data();
      if (!group) throw new Error('group-missing');
      const members: string[] = group.memberUids ?? [];
      if (members.includes(user.uid)) return;
      if (members.length >= MAX_GROUP_MEMBERS) throw new Error('group-full');

      tx.update(groupRef, { memberUids: FieldValue.arrayUnion(user.uid) });
      tx.set(groupRef.collection('members').doc(user.uid), {
        uid: user.uid,
        email: user.email,
        displayName: user.name,
        role: 'member',
        sharing: { availability: true },
        joinedAt: FieldValue.serverTimestamp(),
      });
      tx.set(adminDb.collection('users').doc(user.uid), { groupId: invite.groupId }, { merge: true });
      tx.update(inviteRef, { status: 'accepted', acceptedAt: FieldValue.serverTimestamp() });
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : '';
    if (msg === 'group-full') return jsonError(`A group holds up to ${MAX_GROUP_MEMBERS} people`);
    if (msg === 'group-missing') return jsonError('Group no longer exists', 404);
    return jsonError('Could not accept invite', 500);
  }

  return Response.json({ groupId: invite.groupId });
}
