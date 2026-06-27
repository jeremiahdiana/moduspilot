import { adminAuth, adminDb } from '@/lib/firebase-admin';

// MODUS Group: up to 5 private agents under one shared group.
export const MAX_GROUP_MEMBERS = 5;

export interface VerifiedUser {
  uid: string;
  email: string | null;
  name: string | null;
}

// Verifies the Firebase ID token on a request. Returns null on any failure so
// callers can respond with 401 uniformly.
export async function verifyRequest(req: Request): Promise<VerifiedUser | null> {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return null;
  try {
    const decoded = await adminAuth.verifyIdToken(token);
    return {
      uid: decoded.uid,
      email: decoded.email ?? null,
      name: (decoded.name as string | undefined) ?? null,
    };
  } catch {
    return null;
  }
}

// The single group a user currently belongs to (v1: one group per user).
export async function getUserGroupId(uid: string): Promise<string | null> {
  const snap = await adminDb.collection('users').doc(uid).get();
  return (snap.data()?.groupId as string | undefined) ?? null;
}

export function jsonError(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}
