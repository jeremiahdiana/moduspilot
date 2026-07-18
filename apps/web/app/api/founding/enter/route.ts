import crypto from 'crypto';
import { cookies } from 'next/headers';
import { adminDb } from '@/lib/firebase-admin';
import {
  hashPassword,
  signGate,
  FOUNDING_COOKIE,
  FOUNDING_COOKIE_MAX_AGE,
} from '@/lib/founding';

// Passwords are the whole security boundary for the founding gate, and they're
// hand-picked (possibly low-entropy), so cap guessing: N attempts per IP per
// window. Backed by a tiny Firestore doc keyed by hashed IP.
const MAX_ATTEMPTS = 10;
const WINDOW_MS = 10 * 60 * 1000; // 10 minutes

async function rateLimited(ip: string): Promise<boolean> {
  const ref = adminDb.collection('foundingAttempts').doc(crypto.createHash('sha256').update(ip).digest('hex'));
  try {
    return await adminDb.runTransaction(async tx => {
      const snap = await tx.get(ref);
      const now = Date.now();
      const data = snap.data() as { count?: number; windowStart?: number } | undefined;
      const fresh = !data || !data.windowStart || now - data.windowStart > WINDOW_MS;
      const count = fresh ? 1 : (data!.count ?? 0) + 1;
      tx.set(ref, { count, windowStart: fresh ? now : data!.windowStart });
      return count > MAX_ATTEMPTS;
    });
  } catch {
    return false; // never let a limiter outage lock everyone out
  }
}

export async function POST(req: Request) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || req.headers.get('x-real-ip')
    || 'unknown';
  if (await rateLimited(ip)) {
    return Response.json({ error: 'Too many attempts. Try again shortly.' }, { status: 429 });
  }

  const { password } = (await req.json().catch(() => ({}))) as { password?: string };
  if (!password || typeof password !== 'string') {
    return Response.json({ error: 'That key isn’t valid.' }, { status: 400 });
  }

  const codeId = hashPassword(password);
  const snap = await adminDb.collection('foundingCodes').doc(codeId).get();
  if (!snap.exists) {
    return Response.json({ error: 'That key isn’t valid.' }, { status: 401 });
  }

  // Reusable entry: a valid key sets a signed cookie that lasts 30 days, so they
  // can come back to finish claiming without re-entering it.
  cookies().set(FOUNDING_COOKIE, signGate(codeId), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production', // Secure breaks http://localhost
    sameSite: 'lax',
    path: '/',
    maxAge: FOUNDING_COOKIE_MAX_AGE,
  });

  return Response.json({ ok: true });
}
