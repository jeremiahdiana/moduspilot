import crypto from 'crypto';
import { adminDb } from '@/lib/firebase-admin';

/**
 * Founding Members — the first 100 people Jeremiah invites personally.
 *
 * Each person gets a unique password. It gates the `/grandfathering` page: enter
 * the right password → a signed cookie unlocks the founding offer (reusable
 * entry), and the spot can be claimed exactly once. Claiming starts a Stripe
 * subscription on the $24 price stamped with `plan: 'pilot'`, so the existing
 * webhook grants full PILOT access for $24/mo — no webhook change needed.
 *
 * The plaintext password is NEVER stored: the Firestore doc id IS the SHA-256 of
 * the password, so a lookup is O(1) and the DB only holds hashes. Jeremiah keeps
 * the plaintext list (scripts/founding-codes.local.json) as his own record.
 */

export const FOUNDING_CAP = 100;
export const FOUNDING_COOKIE = 'founding_gate';
export const FOUNDING_COOKIE_MAX_AGE = 30 * 24 * 60 * 60; // seconds (30 days) — reusable entry
const COOKIE_TTL_MS = FOUNDING_COOKIE_MAX_AGE * 1000;

/** The Firestore doc id for a code is the hash of its password. */
export function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password.trim()).digest('hex');
}

// Sign the gate cookie so a codeId can't be forged client-side. Same key
// derivation as lib/oauth-state.ts — always present wherever Admin SDK runs,
// never shipped to the client. Set OAUTH_STATE_SECRET to override/rotate.
function signingKey(): Buffer {
  const secret = process.env.OAUTH_STATE_SECRET || process.env.FIREBASE_PRIVATE_KEY || '';
  if (!secret) throw new Error('founding: no signing secret available');
  return crypto.createHash('sha256').update(secret).digest();
}

function b64url(buf: Buffer | string): string {
  return Buffer.from(buf).toString('base64url');
}

/** Produce a tamper-proof gate cookie value: `<payloadB64>.<hmacB64>`. */
export function signGate(codeId: string): string {
  const body = b64url(JSON.stringify({ codeId, iat: Date.now() }));
  const sig = b64url(crypto.createHmac('sha256', signingKey()).update(body).digest());
  return `${body}.${sig}`;
}

/** Return the codeId only if the cookie is validly signed and not expired. */
export function verifyGate(value: string | null | undefined): string | null {
  if (!value || !value.includes('.')) return null;
  const [body, sig] = value.split('.');
  if (!body || !sig) return null;
  try {
    const expected = crypto.createHmac('sha256', signingKey()).update(body).digest();
    const got = Buffer.from(sig, 'base64url');
    if (expected.length !== got.length || !crypto.timingSafeEqual(expected, got)) return null;
    const decoded = JSON.parse(Buffer.from(body, 'base64url').toString()) as { codeId?: string; iat?: number };
    if (!decoded.codeId || typeof decoded.iat !== 'number' || Date.now() - decoded.iat > COOKIE_TTL_MS) return null;
    return decoded.codeId;
  } catch {
    return null;
  }
}

export interface FoundingCode {
  label: string;
  foundingNumber: number;
  status: 'available' | 'claimed';
  claimedByUid: string | null;
}

export async function getFoundingCode(codeId: string): Promise<FoundingCode | null> {
  const snap = await adminDb.collection('foundingCodes').doc(codeId).get();
  if (!snap.exists) return null;
  const d = snap.data() as Record<string, unknown>;
  return {
    label: (d.label as string) ?? '',
    foundingNumber: (d.foundingNumber as number) ?? 0,
    status: (d.status as 'available' | 'claimed') ?? 'available',
    claimedByUid: (d.claimedByUid as string | null) ?? null,
  };
}

/** How many of the 100 spots have been claimed (for the live counter). */
export async function claimedCount(): Promise<number> {
  try {
    const snap = await adminDb.collection('foundingCodes').where('status', '==', 'claimed').count().get();
    return snap.data().count;
  } catch {
    return 0;
  }
}
