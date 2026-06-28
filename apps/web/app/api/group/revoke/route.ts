import { adminDb } from '@/lib/firebase-admin';
import { verifyRequest, jsonError } from '@/lib/groups';

// Owner-only: cancels a pending invite they sent (e.g. a typo'd email, or to
// free a seat). Deletes the invite doc.
export async function POST(req: Request) {
  const user = await verifyRequest(req);
  if (!user) return jsonError('Unauthorized', 401);

  const { inviteId } = (await req.json().catch(() => ({}))) as { inviteId?: string };
  if (!inviteId) return jsonError('Missing invite');

  const inviteRef = adminDb.collection('groupInvites').doc(inviteId);
  const invite = (await inviteRef.get()).data();
  if (!invite) return jsonError('Invite not found', 404);

  // Only the owner of the invite's group may revoke it.
  const group = (await adminDb.collection('groups').doc(invite.groupId).get()).data();
  if (!group || group.ownerUid !== user.uid) {
    return jsonError('Only the group owner can cancel invites', 403);
  }

  await inviteRef.delete();
  return Response.json({ ok: true });
}
