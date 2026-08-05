import { createHash } from 'crypto';
import { createOpenAI } from '@ai-sdk/openai';
import { experimental_generateImage as generateImage } from 'ai';
import { requireAuth } from '@/lib/api-auth';
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { hasActiveAccess } from '@/lib/plan';
import { uploadGeneratedImage } from '@/lib/storage';

// 💸 Image models bill PER IMAGE, and the price swings 15x on a parameter this
// route never sent. gpt-image-1 is $0.011-0.016 low, $0.042-0.063 medium and
// $0.167-0.250 high (verified 2026-08-05). With no `quality` the vendor picks, so
// 20/day could bill up to ~$100/month against a $24 plan — and grandfathered
// accounts, which pay nothing, had the same 20.
//
// An unspecified quality is not a default, it is an unpriced decision handed to
// the vendor. Now pinned, and the cap is per-plan and derived from revenue in
// lib/constants.ts. Cache hits (identical prompt) still cost nothing and are free.
//
// ⚠️ gpt-image-1 retires 2026-10-23. The dall-e-3 fallback below means this
// degrades rather than breaks, but it needs a real successor before then.
import {
  IMAGE_QUALITY, MODUS_IMAGES_PER_DAY, PILOT_IMAGES_PER_DAY,
} from '@/lib/constants';
import { isPilotLevelPlan } from '@/lib/plan';

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
      // Per plan, not one number for everyone. A grandfathered account pays $0 and
      // was getting PILOT's allowance; it now sits on the MODUS line.
      const limit = isPilotLevelPlan(d.plan as string | undefined)
        ? PILOT_IMAGES_PER_DAY
        : MODUS_IMAGES_PER_DAY;
      if (count >= limit) throw new Error('image_limit_reached');
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
        // Pinned, never left to the vendor's default — that default is what made
        // this route's cost per image a 15x unknown. dall-e-3 uses the same key.
        providerOptions: { openai: { quality: IMAGE_QUALITY } },
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
