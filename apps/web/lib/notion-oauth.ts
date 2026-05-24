import { adminDb } from './firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

function accountsCol(uid: string) {
  return adminDb.collection('users').doc(uid).collection('notion_accounts');
}

export function buildNotionOAuthUrl(uid: string, origin = 'settings'): string {
  const state = Buffer.from(JSON.stringify({ uid, origin })).toString('base64url');
  const params = new URLSearchParams({
    client_id: process.env.NOTION_CLIENT_ID!,
    response_type: 'code',
    owner: 'user',
    redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/notion/callback`,
    state,
  });
  return `https://api.notion.com/v1/oauth/authorize?${params}`;
}

export async function exchangeNotionCode(code: string): Promise<{
  access_token: string;
  workspace_id: string;
  workspace_name: string;
  workspace_icon: string | null;
  bot_id: string;
  owner_email: string;
}> {
  const credentials = Buffer.from(`${process.env.NOTION_CLIENT_ID}:${process.env.NOTION_CLIENT_SECRET}`).toString('base64');
  const res = await fetch('https://api.notion.com/v1/oauth/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      grant_type: 'authorization_code',
      code,
      redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/notion/callback`,
    }),
  });
  if (!res.ok) throw new Error(`Notion token exchange failed: ${await res.text()}`);
  const data = await res.json();
  return {
    access_token: data.access_token,
    workspace_id: data.workspace_id,
    workspace_name: data.workspace_name ?? 'Notion Workspace',
    workspace_icon: data.workspace_icon ?? null,
    bot_id: data.bot_id,
    owner_email: data.owner?.user?.person?.email ?? data.owner?.user?.name ?? '',
  };
}

export async function storeNotionTokens(uid: string, data: {
  access_token: string;
  workspace_id: string;
  workspace_name: string;
  workspace_icon: string | null;
  bot_id: string;
  owner_email: string;
}) {
  await accountsCol(uid).doc(data.workspace_id).set({
    workspaceId: data.workspace_id,
    workspaceName: data.workspace_name,
    workspaceIcon: data.workspace_icon,
    botId: data.bot_id,
    accessToken: data.access_token,
    ownerEmail: data.owner_email,
    connectedAt: FieldValue.serverTimestamp(),
  });
}

export async function getNotionAccounts(uid: string): Promise<{
  workspaceId: string;
  workspaceName: string;
  workspaceIcon: string | null;
  ownerEmail: string;
  connectedAt: string | null;
}[]> {
  const snap = await accountsCol(uid).orderBy('connectedAt', 'asc').get();
  return snap.docs.map(d => ({
    workspaceId: d.data().workspaceId as string,
    workspaceName: d.data().workspaceName as string,
    workspaceIcon: d.data().workspaceIcon as string | null,
    ownerEmail: d.data().ownerEmail as string,
    connectedAt: d.data().connectedAt?.toDate?.()?.toISOString() ?? null,
  }));
}

export async function getNotionAccessToken(uid: string, workspaceId: string): Promise<string | null> {
  const doc = await accountsCol(uid).doc(workspaceId).get();
  return doc.exists ? (doc.data()!.accessToken as string) : null;
}

export async function disconnectNotionWorkspace(uid: string, workspaceId: string) {
  await accountsCol(uid).doc(workspaceId).delete();
}
