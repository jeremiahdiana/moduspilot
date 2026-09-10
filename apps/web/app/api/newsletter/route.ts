import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

/**
 * Newsletter / updates capture from the marketing footer. Deliberately tiny: it
 * stores an email in Firestore so the list is real, not a dead form. No provider
 * (Buttondown etc.) is wired yet — this is the collection point.
 *
 * Doc id is the lowercased email so a repeat signup is idempotent (no dupes).
 */
export async function POST(req: Request): Promise<Response> {
  let email = '';
  try {
    const body = await req.json();
    email = String(body?.email ?? '').trim().toLowerCase();
  } catch {
    return Response.json({ error: 'bad_request' }, { status: 400 });
  }

  // Minimal, permissive email check. The point is to reject obvious garbage, not
  // to validate deliverability.
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || email.length > 254) {
    return Response.json({ error: 'invalid_email' }, { status: 400 });
  }

  try {
    const id = email.replace(/[^a-z0-9._%+-@]/g, '_');
    await adminDb.collection('newsletterSignups').doc(id).set(
      { email, createdAt: FieldValue.serverTimestamp(), source: 'footer' },
      { merge: true },
    );
  } catch (e) {
    console.error('[newsletter] write failed:', e);
    return Response.json({ error: 'server_error' }, { status: 500 });
  }

  return Response.json({ ok: true });
}
