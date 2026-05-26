import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase-admin';
import { removeMcpServer } from '@/lib/mcp-servers';

export async function POST(req: NextRequest) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let uid: string;
  try {
    ({ uid } = await adminAuth.verifyIdToken(token));
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { serverId } = await req.json() as { serverId: string };
  if (!serverId) return NextResponse.json({ error: 'Missing serverId' }, { status: 400 });

  await removeMcpServer(uid, serverId);
  return NextResponse.json({ ok: true });
}
