import { adminDb } from './firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

// Transport the plugin's MCP endpoint speaks. Legacy servers (no field stored)
// were all added over SSE, so an absent value defaults to 'sse'.
export type McpTransport = 'sse' | 'http';

export interface McpServer {
  id: string;
  name: string;
  url: string;
  authHeader?: string;
  transport: McpTransport;
  createdAt: string;
}

// Every chat message read this collection, even for the majority of users who
// have zero plugins. Cache per-uid on the warm lambda. Writes go through
// add/remove below, which invalidate this instance's entry; another warm
// instance can still serve a stale list until its TTL lapses, so a just-added
// plugin may take up to CACHE_TTL_MS to appear in chat. Acceptable at 60s —
// don't raise the TTL without revisiting that.
const CACHE_TTL_MS = 60_000;
const cache = new Map<string, { servers: McpServer[]; exp: number }>();

export function invalidateMcpServers(uid: string): void {
  cache.delete(uid);
}

export async function getMcpServers(uid: string): Promise<McpServer[]> {
  const hit = cache.get(uid);
  if (hit && hit.exp > Date.now()) return hit.servers;

  const snap = await adminDb.collection('users').doc(uid).collection('mcpServers').get();
  const servers = snap.docs.map(d => ({
    id: d.id,
    name: d.data().name as string,
    url: d.data().url as string,
    authHeader: d.data().authHeader as string | undefined,
    transport: (d.data().transport as McpTransport) ?? 'sse',
    createdAt: d.data().createdAt?.toDate?.()?.toISOString() ?? new Date().toISOString(),
  }));
  // Caching the empty result is the point: it's the common case.
  cache.set(uid, { servers, exp: Date.now() + CACHE_TTL_MS });
  return servers;
}

export async function addMcpServer(uid: string, server: { name: string; url: string; authHeader?: string; transport?: McpTransport }): Promise<string> {
  const ref = await adminDb.collection('users').doc(uid).collection('mcpServers').add({
    name: server.name,
    url: server.url,
    authHeader: server.authHeader ?? null,
    transport: server.transport ?? 'http',
    createdAt: FieldValue.serverTimestamp(),
  });
  invalidateMcpServers(uid);
  return ref.id;
}

export async function removeMcpServer(uid: string, serverId: string): Promise<void> {
  await adminDb.collection('users').doc(uid).collection('mcpServers').doc(serverId).delete();
  invalidateMcpServers(uid);
}
