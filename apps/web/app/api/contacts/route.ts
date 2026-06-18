import { requireAuth } from '@/lib/api-auth';
import { adminDb } from '@/lib/firebase-admin';

export async function GET(req: Request) {
  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;
  const { uid } = auth;

  try {
    const snap = await adminDb
      .collection('users').doc(uid)
      .collection('contacts')
      .orderBy('name')
      .limit(200)
      .get();

    const contacts = snap.docs.map(d => {
      const data = d.data();
      return {
        id: d.id,
        name: data.name ?? '',
        email: data.email ?? null,
        phone: data.phone ?? null,
        company: data.company ?? null,
        jobTitle: data.jobTitle ?? null,
        userCategory: data.userCategory ?? null,
      };
    });

    return Response.json({ contacts });
  } catch {
    return Response.json({ contacts: [] });
  }
}
