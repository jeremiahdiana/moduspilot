import { createOpenAI } from '@ai-sdk/openai';
import { experimental_generateImage as generateImage } from 'ai';
import { requireAuth } from '@/lib/api-auth';
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { hasActiveAccess } from '@/lib/plan';

// Daily image-generation cap per user. Image models cost real money per call,
// so gate to paid/grandfathered users and cap generously but finitely.
const DAILY_IMAGE_LIMIT = 20;

export async function POST(req: Request) {
  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;
  const { uid } = auth;

  const openAIKey = process.env.OPENAI_API_KEY?.trim();
  if (!openAIKey) {
    return Response.json({ error: 'Image generation is not configured.' }, { status: 500 });
  }

  const { prompt, size } = await req.json().catch(() => ({})) as { prompt?: string; size?: string };
  const cleanPrompt = (prompt ?? '').trim().slice(0, 4000);
  if (!cleanPrompt) return Response.json({ error: 'Missing prompt.' }, { status: 400 });

  const userRef = adminDb.collection('users').doc(uid);
  const snap = await userRef.get();
  const userData = snap.data() ?? {};
  if (!hasActiveAccess(userData)) {
    return Response.json({ error: 'subscription_required' }, { status: 402 });
  }

  // Atomic daily-cap check + increment (resets on date change), matching the
  // transaction pattern used for chat limits.
  const today = new Date().toISOString().slice(0, 10);
  try {
    await adminDb.runTransaction(async (txn) => {
      const doc = await txn.get(userRef);
      const d = doc.data() ?? {};
      const count = d.imageGenDate === today ? (d.imageGenCount ?? 0) : 0;
      if (count >= DAILY_IMAGE_LIMIT) throw new Error('image_limit_reached');
      txn.set(userRef, { imageGenDate: today, imageGenCount: count + 1, imageGenAt: FieldValue.serverTimestamp() }, { merge: true });
    });
  } catch (e) {
    if ((e as Error).message === 'image_limit_reached') {
      return Response.json({ error: 'image_limit_reached' }, { status: 429 });
    }
    // Non-cap transaction failure — let generation proceed rather than block.
  }

  const openai = createOpenAI({ apiKey: openAIKey });
  const allowedSize = ['1024x1024', '1024x1536', '1536x1024'].includes(size ?? '') ? size! : '1024x1024';

  try {
    const { image } = await generateImage({
      model: openai.image('gpt-image-1'),
      prompt: cleanPrompt,
      size: allowedSize as `${number}x${number}`,
    });
    return Response.json({ image: `data:image/png;base64,${image.base64}` });
  } catch (primaryErr) {
    // gpt-image-1 requires OpenAI org verification; fall back to DALL·E 3.
    try {
      const { image } = await generateImage({
        model: openai.image('dall-e-3'),
        prompt: cleanPrompt,
        size: '1024x1024',
      });
      return Response.json({ image: `data:image/png;base64,${image.base64}` });
    } catch (fallbackErr) {
      console.error('[generate/image] failed:', String(primaryErr), '||', String(fallbackErr));
      return Response.json({ error: 'generation_failed' }, { status: 502 });
    }
  }
}
