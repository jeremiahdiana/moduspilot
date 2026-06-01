import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getMcpServers } from '@/lib/mcp-servers';

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;
  const { uid } = auth;

  const servers = await getMcpServers(uid);
  return NextResponse.json({ servers });
}
