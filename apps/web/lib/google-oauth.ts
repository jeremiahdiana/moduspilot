import { adminDb } from './firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

export const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/drive.readonly',
  'openid',
  'email',
  'profile',
].join(' ');

export function buildOAuthUrl(uid: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/google/callback`,
    response_type: 'code',
    scope: GOOGLE_SCOPES,
    access_type: 'offline',
    prompt: 'consent',
    state: Buffer.from(JSON.stringify({ uid })).toString('base64url'),
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
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Token exchange failed: ${err}`);
  }
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

export async function storeGoogleTokens(uid: string, tokens: {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  email?: string;
}) {
  await adminDb
    .collection('users').doc(uid)
    .collection('integrations').doc('google')
    .set({
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: Date.now() + tokens.expires_in * 1000,
      email: tokens.email ?? '',
      connectedAt: FieldValue.serverTimestamp(),
    });
}

export async function getValidAccessToken(uid: string): Promise<string | null> {
  const snap = await adminDb
    .collection('users').doc(uid)
    .collection('integrations').doc('google')
    .get();

  if (!snap.exists) return null;

  const data = snap.data()!;
  const buffer = 60 * 1000;

  if (data.expiresAt > Date.now() + buffer) {
    return data.accessToken as string;
  }

  try {
    const refreshed = await refreshAccessToken(data.refreshToken);
    await snap.ref.update({
      accessToken: refreshed.access_token,
      expiresAt: Date.now() + refreshed.expires_in * 1000,
    });
    return refreshed.access_token;
  } catch {
    return null;
  }
}

export async function disconnectGoogle(uid: string) {
  await adminDb
    .collection('users').doc(uid)
    .collection('integrations').doc('google')
    .delete();
}
