import { adminDb } from './firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

export const GITHUB_SCOPES = ['repo', 'read:user', 'read:org'].join(' ');

function accountsCol(uid: string) {
  return adminDb.collection('users').doc(uid).collection('github_accounts');
}

export function buildGitHubOAuthUrl(uid: string, origin = 'settings'): string {
  const state = Buffer.from(JSON.stringify({ uid, origin })).toString('base64url');
  const params = new URLSearchParams({
    client_id: process.env.GITHUB_CLIENT_ID!,
    scope: GITHUB_SCOPES,
    redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/github/callback`,
    state,
  });
  return `https://github.com/login/oauth/authorize?${params}`;
}

export async function exchangeGitHubCode(code: string): Promise<{
  access_token: string;
  scope: string;
}> {
  const res = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      client_id: process.env.GITHUB_CLIENT_ID!,
      client_secret: process.env.GITHUB_CLIENT_SECRET!,
      code,
      redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/github/callback`,
    }),
  });
  if (!res.ok) throw new Error(`GitHub token exchange failed: ${await res.text()}`);
  const data = await res.json();
  if (data.error) throw new Error(`GitHub error: ${data.error_description}`);
  return { access_token: data.access_token, scope: data.scope ?? '' };
}

export async function fetchGitHubUser(accessToken: string): Promise<{
  login: string;
  name: string | null;
  avatarUrl: string;
}> {
  const res = await fetch('https://api.github.com/user', {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/vnd.github+json' },
  });
  if (!res.ok) throw new Error('Failed to fetch GitHub user');
  const data = await res.json();
  return { login: data.login, name: data.name ?? null, avatarUrl: data.avatar_url };
}

export async function storeGitHubTokens(uid: string, data: {
  access_token: string;
  login: string;
  name: string | null;
  avatarUrl: string;
}) {
  await accountsCol(uid).doc(data.login).set({
    login: data.login,
    name: data.name,
    avatarUrl: data.avatarUrl,
    accessToken: data.access_token,
    connectedAt: FieldValue.serverTimestamp(),
  });
}

export async function getGitHubAccounts(uid: string): Promise<{
  login: string;
  name: string | null;
  avatarUrl: string;
  connectedAt: string | null;
}[]> {
  const snap = await accountsCol(uid).orderBy('connectedAt', 'asc').get();
  return snap.docs.map(d => ({
    login: d.data().login as string,
    name: d.data().name as string | null,
    avatarUrl: d.data().avatarUrl as string,
    connectedAt: d.data().connectedAt?.toDate?.()?.toISOString() ?? null,
  }));
}

export async function getGitHubAccessToken(uid: string, login: string): Promise<string | null> {
  const doc = await accountsCol(uid).doc(login).get();
  return doc.exists ? (doc.data()!.accessToken as string) : null;
}

export async function getFirstGitHubToken(uid: string): Promise<{ token: string; login: string } | null> {
  const snap = await accountsCol(uid).limit(1).get();
  if (snap.empty) return null;
  const d = snap.docs[0].data();
  return { token: d.accessToken as string, login: d.login as string };
}

export async function disconnectGitHubAccount(uid: string, login: string) {
  await accountsCol(uid).doc(login).delete();
}
