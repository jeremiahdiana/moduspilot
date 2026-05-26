import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase-admin';
import { experimental_createMCPClient } from 'ai';

const TIMEOUT_MS = 6000;

export async function POST(req: NextRequest) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    await adminAuth.verifyIdToken(token);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { url, authHeader } = await req.json() as { url: string; authHeader?: string };
  if (!url) return NextResponse.json({ error: 'Missing url' }, { status: 400 });

  try {
    new URL(url); // validate format
  } catch {
    return NextResponse.json({ error: 'Invalid URL format' }, { status: 400 });
  }

  let client: Awaited<ReturnType<typeof experimental_createMCPClient>> | null = null;
  try {
    const connectPromise = experimental_createMCPClient({
      transport: {
        type: 'sse',
        url,
        headers: authHeader ? { Authorization: authHeader } : undefined,
      },
    });

    client = await Promise.race([
      connectPromise,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Connection timed out')), TIMEOUT_MS)
      ),
    ]);

    const tools = await client.tools();
    const toolNames = Object.keys(tools);

    return NextResponse.json({ ok: true, tools: toolNames });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Connection failed';
    return NextResponse.json({ ok: false, error: msg }, { status: 200 });
  } finally {
    if (client) {
      try { await client.close(); } catch {}
    }
  }
}
