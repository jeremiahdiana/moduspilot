import { adminDb } from './firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

export interface McpServer {
  id: string;
  name: string;
  url: string;
  authHeader?: string;
  createdAt: string;
}

export async function getMcpServers(uid: string): Promise<McpServer[]> {
  const snap = await adminDb.collection('users').doc(uid).collection('mcpServers').get();
  return snap.docs.map(d => ({
    id: d.id,
    name: d.data().name as string,
    url: d.data().url as string,
    authHeader: d.data().authHeader as string | undefined,
    createdAt: d.data().createdAt?.toDate?.()?.toISOString() ?? new Date().toISOString(),
  }));
}

export async function addMcpServer(uid: string, server: { name: string; url: string; authHeader?: string }): Promise<string> {
  const ref = await adminDb.collection('users').doc(uid).collection('mcpServers').add({
    name: server.name,
    url: server.url,
    authHeader: server.authHeader ?? null,
    createdAt: FieldValue.serverTimestamp(),
  });
  return ref.id;
}

export async function removeMcpServer(uid: string, serverId: string): Promise<void> {
  await adminDb.collection('users').doc(uid).collection('mcpServers').doc(serverId).delete();
}
