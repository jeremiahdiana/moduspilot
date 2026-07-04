import { createHash } from 'crypto';
import { createOpenAI } from '@ai-sdk/openai';
import { experimental_generateImage as generateImage } from 'ai';
import { requireAuth } from '@/lib/api-auth';
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { hasActiveAccess } from '@/lib/plan';
import { uploadGeneratedImage } from '@/lib/storage';

// Daily image-generation cap per user. Image models cost real money per call,
// so gate to paid/grandfathered users and cap generously but finitely. Cache
// hits (identical prompt) do not consume the cap.
const DAILY_IMAGE_LIMIT = 20;
const ALLOWED_SIZES = ['1024x1024', '1024x1536', '1536x1024'];

export async function POST(req: Request) {
  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;
  const { uid } = auth;

  const openAIKey = process.env.OPENAI_API_KEY?.trim();
  if (!openAIKey) {
    return Response.json({ error: 'Image generation is not configured.' }, { status: 500 });
  }

  const { prompt, size, force } = await req.json().catch(() => ({})) as { prompt?: string; size?: string; force?: boolean };
  const cleanPrompt = (prompt ?? '').trim().slice(0, 4000);
  if (!cleanPrompt) return Response.json({ error: 'Missing prompt.' }, { status: 400 });
  const allowedSize = ALLOWED_SIZES.includes(size ?? '') ? size! : '1024x1024';

  const userRef = adminDb.collection('users').doc(uid);
  const snap = await userRef.get();
  const userData = snap.data() ?? {};
  if (!hasActiveAccess(userData)) {
    return Response.json({ error: 'subscription_required' }, { status: 402 });
  }

  // Cache by (uid, size, prompt) so reloading a chat re-requests the same block
  // and gets the same persisted image back — no regeneration, no cap use. The
  // Regenerate button sends force:true to bypass it.
  const key = createHash('sha256').update(`${allowedSize}|${cleanPrompt}`).digest('hex').slice(0, 40);
  const cacheRef = userRef.collection('imageCache').doc(key);
  if (!force) {
    const cached = await cacheRef.get();
    const cachedUrl = cached.data()?.url as string | undefined;
    if (cachedUrl) return Response.json({ image: cachedUrl, cached: true });
  }

  // Atomic daily-cap check + increment (resets on date change) — only on a real
  // generation, matching the transaction pattern used for chat limits.
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

  async function tryGenerate(model: string, genSize: string): Promise<string | null> {
    try {
      const { image } = await generateImage({
        model: openai.image(model),
        prompt: cleanPrompt,
        size: genSize as `${number}x${number}`,
      });
      return image.base64;
    } catch (e) {
      console.error(`[generate/image] ${model} failed:`, String(e));
      return null;
    }
  }

  // gpt-image-1 needs OpenAI org verification; fall back to DALL·E 3.
  const base64 = (await tryGenerate('gpt-image-1', allowedSize)) ?? (await tryGenerate('dall-e-3', '1024x1024'));
  if (!base64) return Response.json({ error: 'generation_failed' }, { status: 502 });

  // Persist to Storage for a durable URL; cache it so reloads are free. If
  // Storage isn't available, return an inline data URL (works but won't persist).
  const url = await uploadGeneratedImage(uid, base64);
  if (url) {
    await cacheRef.set({ url, prompt: cleanPrompt, size: allowedSize, createdAt: FieldValue.serverTimestamp() }).catch(() => {});
    return Response.json({ image: url });
  }
  return Response.json({ image: `data:image/png;base64,${base64}`, persisted: false });
}
