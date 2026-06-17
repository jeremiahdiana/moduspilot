import { requireAuth } from '@/lib/api-auth';
import { adminDb } from '@/lib/firebase-admin';

export async function GET(req: Request) {
  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;
  const { uid } = auth;

  try {
    const [userSnap, contactsSnap] = await Promise.all([
      adminDb.collection('users').doc(uid).get(),
      adminDb.collection('users').doc(uid).collection('contacts').count().get(),
    ]);

    const data = userSnap.data() ?? {};
    const perms: Record<string, string> = data.mobilePermissions ?? {};
    const deviceAccess: Record<string, boolean> = data.settings?.deviceAccess ?? {};

    return Response.json({
      contacts: {
        count: contactsSnap.data().count,
        permission: perms.contacts ?? null,
        enabled: deviceAccess.contacts !== false,
      },
      health: {
        permission: perms.health ?? null,
        enabled: deviceAccess.health !== false,
      },
      photos: {
        permission: perms.photos ?? null,
        enabled: deviceAccess.photos !== false,
      },
    });
  } catch {
    return Response.json({
      contacts: { count: 0, permission: null, enabled: true },
      health: { permission: null, enabled: true },
      photos: { permission: null, enabled: true },
    });
  }
}
