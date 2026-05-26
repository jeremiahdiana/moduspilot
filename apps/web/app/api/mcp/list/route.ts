import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase-admin';
import { getMcpServers } from '@/lib/mcp-servers';

export async function GET(req: NextRequest) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let uid: string;
  try {
    ({ uid } = await adminAuth.verifyIdToken(token));
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const servers = await getMcpServers(uid);
  return NextResponse.json({ servers });
}
