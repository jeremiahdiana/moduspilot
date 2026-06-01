import { adminAuth } from './firebase-admin';

/** Extract the Firebase ID token from an `Authorization: Bearer <token>` header. */
export function getBearerToken(req: Request): string | null {
  return req.headers.get('Authorization')?.replace('Bearer ', '') ?? null;
}

/**
 * Require a valid Firebase ID token. Returns `{ uid }` on success, or a ready
 * 401 `Response` to return directly. Centralizes the auth boilerplate that was
 * duplicated across ~25 route handlers.
 *
 *   const auth = await requireAuth(req);
 *   if (auth instanceof Response) return auth;
 *   const { uid } = auth;
 *
 * Preserves the prior contract exactly: missing OR invalid token →
 * `401 { error: 'Unauthorized' }`.
 */
export async function requireAuth(req: Request): Promise<{ uid: string } | Response> {
  const token = getBearerToken(req);
  if (!token) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const { uid } = await adminAuth.verifyIdToken(token);
    return { uid };
  } catch {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
}

/**
 * Resolve the uid for routes that degrade gracefully for guests (no 401).
 * Returns the uid or null. Use when an endpoint is intentionally public.
 */
export async function getOptionalUid(req: Request): Promise<string | null> {
  const token = getBearerToken(req);
  if (!token) return null;
  try {
    const { uid } = await adminAuth.verifyIdToken(token);
    return uid;
  } catch {
    return null;
  }
}
