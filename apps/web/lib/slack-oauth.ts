import { adminDb } from './firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

export const SLACK_SCOPES = [
  'channels:read',
  'channels:history',
  'groups:read',
  'groups:history',
  'im:read',
  'im:history',
  'users:read',
  'chat:write',
  'files:read',
].join(',');

function accountsCol(uid: string) {
  return adminDb.collection('users').doc(uid).collection('slack_accounts');
}

export function buildSlackOAuthUrl(uid: string, origin = 'settings'): string {
  const state = Buffer.from(JSON.stringify({ uid, origin })).toString('base64url');
  const params = new URLSearchParams({
    client_id: process.env.SLACK_CLIENT_ID!,
    scope: SLACK_SCOPES,
    redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/slack/callback`,
    state,
  });
  return `https://slack.com/oauth/v2/authorize?${params}`;
}

export async function exchangeSlackCode(code: string): Promise<{
  access_token: string;
  team_id: string;
  team_name: string;
  authed_user_id: string;
}> {
  const res = await fetch('https://slack.com/api/oauth.v2.access', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: process.env.SLACK_CLIENT_ID!,
      client_secret: process.env.SLACK_CLIENT_SECRET!,
      redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/slack/callback`,
    }),
  });
  if (!res.ok) throw new Error(`Slack token exchange failed: ${await res.text()}`);
  const data = await res.json();
  if (!data.ok) throw new Error(`Slack error: ${data.error}`);
  return {
    access_token: data.access_token,
    team_id: data.team?.id ?? data.team_id,
    team_name: data.team?.name ?? '',
    authed_user_id: data.authed_user?.id ?? '',
  };
}

export async function storeSlackTokens(uid: string, data: {
  access_token: string;
  team_id: string;
  team_name: string;
  authed_user_id: string;
}) {
  await accountsCol(uid).doc(data.team_id).set({
    teamId: data.team_id,
    teamName: data.team_name,
    authedUserId: data.authed_user_id,
    accessToken: data.access_token,
    connectedAt: FieldValue.serverTimestamp(),
  });
}

export async function getSlackAccounts(uid: string): Promise<{
  teamId: string;
  teamName: string;
  connectedAt: string | null;
}[]> {
  const snap = await accountsCol(uid).orderBy('connectedAt', 'asc').get();
  return snap.docs.map(d => ({
    teamId: d.data().teamId as string,
    teamName: d.data().teamName as string,
    connectedAt: d.data().connectedAt?.toDate?.()?.toISOString() ?? null,
  }));
}

export async function getSlackAccessToken(uid: string, teamId: string): Promise<string | null> {
  const doc = await accountsCol(uid).doc(teamId).get();
  return doc.exists ? (doc.data()!.accessToken as string) : null;
}

export async function disconnectSlackWorkspace(uid: string, teamId: string) {
  await accountsCol(uid).doc(teamId).delete();
}
