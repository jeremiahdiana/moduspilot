import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { experimental_createMCPClient } from 'ai';

const TIMEOUT_MS = 6000;

export async function POST(req: NextRequest) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let uid: string;
  try {
    ({ uid } = await adminAuth.verifyIdToken(token));
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Rate limit: 20 MCP connection tests per hour
  const nowHour = new Date().toISOString().slice(0, 13); // "2026-05-26T14"
  const userRef = adminDb.collection('users').doc(uid);
  const userSnap = await userRef.get();
  const userData = userSnap.data() ?? {};
  const testHour = (userData.mcpTestHour as string) ?? '';
  const testCount = (userData.mcpTestCount as number) ?? 0;
  if (testHour === nowHour && testCount >= 20) {
    return NextResponse.json({ error: 'Rate limit: 20 MCP tests per hour' }, { status: 429 });
  }
  await userRef.set({
    mcpTestHour: nowHour,
    mcpTestCount: testHour === nowHour ? FieldValue.increment(1) : 1,
  }, { merge: true });

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
