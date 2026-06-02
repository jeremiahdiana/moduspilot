import crypto from 'crypto';

/**
 * OAuth `state` signing.
 *
 * The state we hand to Google/Slack/Notion/GitHub carries the initiating user's
 * uid so the callback knows which account to attach the connection to. If that
 * state is unsigned (plain base64 JSON), an attacker can forge a state with a
 * VICTIM's uid, complete consent with their own account, and the callback will
 * attach tokens to — and mint a Firebase custom token for — the victim. That is
 * account takeover.
 *
 * Fix: HMAC-sign the state. The callback only trusts a uid that came back inside
 * a state we signed, so an attacker can't substitute someone else's uid. States
 * also expire (the consent round-trip is seconds, not hours).
 *
 * The signing key is derived from FIREBASE_PRIVATE_KEY (always present wherever
 * the Admin SDK runs, never shipped to the client) so no new env var is needed;
 * set OAUTH_STATE_SECRET to override/rotate.
 */
const TTL_MS = 15 * 60 * 1000; // 15 minutes

function signingKey(): Buffer {
  const secret = process.env.OAUTH_STATE_SECRET || process.env.FIREBASE_PRIVATE_KEY || '';
  if (!secret) throw new Error('oauth-state: no signing secret available');
  return crypto.createHash('sha256').update(secret).digest();
}

function b64url(buf: Buffer | string): string {
  return Buffer.from(buf).toString('base64url');
}

export interface OAuthStatePayload {
  uid: string;
  origin?: string;
}

/** Produce a tamper-proof state string: `<payloadB64>.<hmacB64>`. */
export function signOAuthState(payload: OAuthStatePayload): string {
  const body = b64url(JSON.stringify({ ...payload, iat: Date.now() }));
  const sig = b64url(crypto.createHmac('sha256', signingKey()).update(body).digest());
  return `${body}.${sig}`;
}

/**
 * Verify + decode a state. Returns the payload only if the signature is valid
 * and the state hasn't expired; otherwise null. NEVER trust a uid from a state
 * this rejects.
 */
export function verifyOAuthState(state: string | null | undefined): OAuthStatePayload | null {
  if (!state || !state.includes('.')) return null;
  const [body, sig] = state.split('.');
  if (!body || !sig) return null;
  try {
    const expected = crypto.createHmac('sha256', signingKey()).update(body).digest();
    const got = Buffer.from(sig, 'base64url');
    if (expected.length !== got.length || !crypto.timingSafeEqual(expected, got)) return null;
    const decoded = JSON.parse(Buffer.from(body, 'base64url').toString()) as OAuthStatePayload & { iat?: number };
    if (!decoded.uid || typeof decoded.iat !== 'number' || Date.now() - decoded.iat > TTL_MS) return null;
    return { uid: decoded.uid, origin: decoded.origin ?? 'settings' };
  } catch {
    return null;
  }
}

/** Best-effort origin extraction for redirect routing only (NOT for trust). */
export function originFromState(state: string | null | undefined): string {
  return verifyOAuthState(state)?.origin ?? 'settings';
}
