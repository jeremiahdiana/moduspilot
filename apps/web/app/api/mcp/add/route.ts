import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { addMcpServer, getMcpServers } from '@/lib/mcp-servers';
import { assertPublicUrl } from '@/lib/ssrf';

const MAX_SERVERS = 10;

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;
  const { uid } = auth;

  const { name, url, authHeader } = await req.json() as { name: string; url: string; authHeader?: string };
  if (!name?.trim() || !url?.trim()) {
    return NextResponse.json({ error: 'Name and URL are required' }, { status: 400 });
  }

  try { await assertPublicUrl(url); } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Invalid URL' }, { status: 400 });
  }

  const existing = await getMcpServers(uid);
  if (existing.length >= MAX_SERVERS) {
    return NextResponse.json({ error: `Maximum ${MAX_SERVERS} MCP servers allowed` }, { status: 400 });
  }

  const id = await addMcpServer(uid, { name: name.trim(), url: url.trim(), authHeader: authHeader?.trim() || undefined });
  return NextResponse.json({ id });
}
