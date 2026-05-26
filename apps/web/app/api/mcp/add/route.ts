import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase-admin';
import { addMcpServer, getMcpServers } from '@/lib/mcp-servers';

const MAX_SERVERS = 10;

export async function POST(req: NextRequest) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let uid: string;
  try {
    ({ uid } = await adminAuth.verifyIdToken(token));
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { name, url, authHeader } = await req.json() as { name: string; url: string; authHeader?: string };
  if (!name?.trim() || !url?.trim()) {
    return NextResponse.json({ error: 'Name and URL are required' }, { status: 400 });
  }

  try { new URL(url); } catch {
    return NextResponse.json({ error: 'Invalid URL format' }, { status: 400 });
  }

  const existing = await getMcpServers(uid);
  if (existing.length >= MAX_SERVERS) {
    return NextResponse.json({ error: `Maximum ${MAX_SERVERS} MCP servers allowed` }, { status: 400 });
  }

  const id = await addMcpServer(uid, { name: name.trim(), url: url.trim(), authHeader: authHeader?.trim() || undefined });
  return NextResponse.json({ id });
}
