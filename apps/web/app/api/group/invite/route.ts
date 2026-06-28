import { adminDb, adminAuth } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { sendPushToUser } from '@/lib/fcm-admin';
import { verifyRequest, getUserGroupId, jsonError, MAX_GROUP_MEMBERS } from '@/lib/groups';

// Owner-only: invites someone by email to the requester's group.
export async function POST(req: Request) {
  const user = await verifyRequest(req);
  if (!user) return jsonError('Unauthorized', 401);

  const { email } = (await req.json().catch(() => ({}))) as { email?: string };
  const inviteEmail = (email ?? '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inviteEmail)) return jsonError('Enter a valid email');
  if (inviteEmail === user.email?.toLowerCase()) return jsonError('That is your own email');

  const groupId = await getUserGroupId(user.uid);
  if (!groupId) return jsonError('You are not in a group', 404);

  const groupRef = adminDb.collection('groups').doc(groupId);
  const groupSnap = await groupRef.get();
  const group = groupSnap.data();
  if (!group) return jsonError('Group not found', 404);
  if (group.ownerUid !== user.uid) return jsonError('Only the group owner can invite', 403);

  const members: string[] = group.memberUids ?? [];
  if (members.length >= MAX_GROUP_MEMBERS) return jsonError(`A group holds up to ${MAX_GROUP_MEMBERS} people`);

  // No duplicate pending invites for the same email/group.
  const dupe = await adminDb.collection('groupInvites')
    .where('groupId', '==', groupId)
    .where('email', '==', inviteEmail)
    .where('status', '==', 'pending')
    .limit(1).get();
  if (!dupe.empty) return jsonError('That person already has a pending invite');

  // Pending invites count against the seats — caps total (members + pending) at
  // MAX_GROUP_MEMBERS. Without this an owner could spam unlimited invite docs +
  // push notifications to arbitrary emails. (Owner can /api/group/revoke a
  // pending invite to free a seat, e.g. after a typo.)
  const pending = await adminDb.collection('groupInvites')
    .where('groupId', '==', groupId)
    .where('status', '==', 'pending')
    .count().get();
  if (members.length + pending.data().count >= MAX_GROUP_MEMBERS) {
    return jsonError(`No seats left — members plus pending invites already fill the group of ${MAX_GROUP_MEMBERS}. Cancel a pending invite or wait for someone to join.`);
  }

  await adminDb.collection('groupInvites').add({
    groupId,
    groupName: group.name ?? 'Group',
    email: inviteEmail,
    invitedByUid: user.uid,
    invitedByName: user.name,
    status: 'pending',
    createdAt: FieldValue.serverTimestamp(),
  });

  // Best-effort push if the invitee already has a MODUS account. If they don't
  // (sign-up still ahead of them), this silently no-ops — they'll see the invite
  // in their Needs-you feed the moment they open the app.
  try {
    const invitee = await adminAuth.getUserByEmail(inviteEmail);
    await sendPushToUser(
      invitee.uid,
      `${user.name ?? 'Someone'} invited you to a group`,
      `Join "${group.name ?? 'their group'}" on MODUS`,
    );
  } catch { /* no account / no token — non-fatal */ }

  return Response.json({ ok: true });
}
