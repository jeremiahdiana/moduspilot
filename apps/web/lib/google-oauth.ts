import { adminDb } from './firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

export const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.compose',
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/drive.readonly',
  'openid',
  'email',
  'profile',
].join(' ');

export function buildOAuthUrl(uid: string, origin: string = 'settings'): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/google/callback`,
    response_type: 'code',
    scope: GOOGLE_SCOPES,
    access_type: 'offline',
    // select_account shows account picker; consent forces re-auth so Google always
    // issues a fresh refresh_token — required for reconnect after disconnect.
    prompt: 'select_account consent',
    state: Buffer.from(JSON.stringify({ uid, origin })).toString('base64url'),
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

export async function exchangeCode(code: string): Promise<{
  access_token: string;
  refresh_token: string;
  expires_in: number;
}> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/google/callback`,
      grant_type: 'authorization_code',
    }),
  });
  if (!res.ok) throw new Error(`Token exchange failed: ${await res.text()}`);
  return res.json();
}

async function refreshAccessToken(refreshToken: string): Promise<{ access_token: string; expires_in: number }> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      grant_type: 'refresh_token',
    }),
  });
  if (!res.ok) throw new Error(`Token refresh failed: ${await res.text()}`);
  return res.json();
}

// ── Multi-account storage ─────────────────────────────────────────────────────

function accountsCol(uid: string) {
  return adminDb.collection('users').doc(uid).collection('google_accounts');
}

export async function storeGoogleAccountTokens(uid: string, tokens: {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  email: string;
}) {
  const docId = tokens.email.replace(/\//g, '_');
  const update: Record<string, unknown> = {
    email: tokens.email,
    accessToken: tokens.access_token,
    expiresAt: Date.now() + tokens.expires_in * 1000,
    connectedAt: FieldValue.serverTimestamp(),
  };
  if (tokens.refresh_token) update.refreshToken = tokens.refresh_token;
  await accountsCol(uid).doc(docId).set(update, { merge: true });
}

export async function getAllGoogleAccounts(uid: string): Promise<{
  email: string;
  connectedAt: string | null;
}[]> {
  await migrateLegacyToken(uid);
  const snap = await accountsCol(uid).orderBy('connectedAt', 'asc').get();
  return snap.docs.map(d => ({
    email: d.data().email as string,
    connectedAt: d.data().connectedAt?.toDate?.()?.toISOString() ?? null,
  }));
}

// Returns a valid access token for every connected account (refreshes as needed)
export async function getAllValidAccessTokens(uid: string): Promise<{
  email: string;
  token: string;
}[]> {
  await migrateLegacyToken(uid);
  const snap = await accountsCol(uid).get();
  if (snap.empty) return [];

  const buffer = 60 * 1000;
  const results = await Promise.all(
    snap.docs.map(async docSnap => {
      const data = docSnap.data();
      try {
        const expiresAt = typeof data.expiresAt === 'number' ? data.expiresAt : 0;
        if (expiresAt > Date.now() + buffer) {
          return { email: data.email as string, token: data.accessToken as string };
        }
        if (!data.refreshToken) return null; // no refresh token — account needs reconnect
        const refreshed = await refreshAccessToken(data.refreshToken as string);
        await docSnap.ref.update({
          accessToken: refreshed.access_token,
          expiresAt: Date.now() + refreshed.expires_in * 1000,
        });
        return { email: data.email as string, token: refreshed.access_token };
      } catch {
        return null;
      }
    }),
  );
  return results.filter((r): r is { email: string; token: string } => r !== null);
}

// Backward-compat: return the first account's token (used by calendar/drive)
export async function getValidAccessToken(uid: string): Promise<string | null> {
  const all = await getAllValidAccessTokens(uid);
  return all[0]?.token ?? null;
}

export async function disconnectGoogleAccount(uid: string, email: string) {
  const docId = email.replace(/\//g, '_');
  await accountsCol(uid).doc(docId).delete();
}

// ── Legacy migration ──────────────────────────────────────────────────────────
// On first access, move the old integrations/google doc into google_accounts

async function migrateLegacyToken(uid: string) {
  const legacyRef = adminDb.collection('users').doc(uid).collection('integrations').doc('google');
  const legacySnap = await legacyRef.get();
  if (!legacySnap.exists) return;

  const data = legacySnap.data()!;
  if (!data.email) { await legacyRef.delete(); return; }

  // Only migrate if the new subcollection doesn't already have this account
  const docId = (data.email as string).replace(/\//g, '_');
  const existing = await accountsCol(uid).doc(docId).get();
  if (!existing.exists) {
    await accountsCol(uid).doc(docId).set({
      email: data.email,
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      expiresAt: data.expiresAt,
      connectedAt: data.connectedAt ?? FieldValue.serverTimestamp(),
    });
  }
  await legacyRef.delete();
}

// Keep storeGoogleTokens for any callers that haven't been updated yet
export async function storeGoogleTokens(uid: string, tokens: {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  email?: string;
}) {
  if (!tokens.email) return;
  await storeGoogleAccountTokens(uid, { ...tokens, email: tokens.email });
}

export async function disconnectGoogle(uid: string) {
  // Disconnect all accounts
  const snap = await accountsCol(uid).get();
  await Promise.all(snap.docs.map(d => d.ref.delete()));
  // Also delete legacy doc if it exists
  await adminDb.collection('users').doc(uid).collection('integrations').doc('google').delete().catch(() => {});
}
