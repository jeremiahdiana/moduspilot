import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { removeMcpServer } from '@/lib/mcp-servers';

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;
  const { uid } = auth;

  const { serverId } = await req.json() as { serverId: string };
  if (!serverId) return NextResponse.json({ error: 'Missing serverId' }, { status: 400 });

  await removeMcpServer(uid, serverId);
  return NextResponse.json({ ok: true });
}
