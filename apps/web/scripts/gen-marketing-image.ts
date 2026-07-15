/**
 * Regenerates public/made-by-modus.png — the image on /features.
 *
 * That section claims the picture was "actually made by MODUS, from that prompt.
 * Not a stock photo", and shows the prompt on screen. So the asset has to keep
 * being real output from the same model the product uses, and the prompt below
 * has to stay the one rendered next to it (CreationsSection IMAGE_PROMPT).
 * Swapping in a stock/internet photo would make that line false.
 *
 * Uses the same model + call as app/api/generate/image/route.ts (gpt-image-1 via
 * experimental_generateImage, falling back to dall-e-3), minus the auth, cap and
 * Firestore cache, which only make sense for a signed-in user.
 *
 * Size is 1536x1024 (the widest ALLOWED_SIZES entry), NOT 1024x1024: the section
 * renders it in a 3:2 box ~960 CSS px wide, so a square source had to be cropped
 * and then upscaled past 1x on retina — which is what made it look soft.
 *
 * Run:  cd apps/web && npx tsx scripts/gen-marketing-image.ts
 */

import { writeFileSync } from 'fs';
import { join } from 'path';
import { config } from 'dotenv';
import { createOpenAI } from '@ai-sdk/openai';
import { experimental_generateImage as generateImage } from 'ai';

// tsx does not load .env.local on its own.
config({ path: join(process.cwd(), '.env.local') });

/** Kept identical to IMAGE_PROMPT in components/marketing/CreationsSection.tsx. */
const PROMPT =
  'A lone climber on a dark granite ridge at dawn, seen from behind and far away, ' +
  'small against the mountain. Low violet and amber light raking across the rock, ' +
  'cold blue mist settling in the valley below, clean unbroken gradient sky. ' +
  'Shot on a 85mm lens, deep depth of field, natural light, photographic, ' +
  'fine grain, no text, no logos.';

const SIZE = '1536x1024';

async function tryGenerate(model: string, size: string): Promise<string | null> {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) throw new Error('OPENAI_API_KEY missing from apps/web/.env.local');
  const openai = createOpenAI({ apiKey: key });
  try {
    const { image } = await generateImage({
      model: openai.image(model),
      prompt: PROMPT,
      size: size as `${number}x${number}`,
    });
    return image.base64;
  } catch (e) {
    console.error(`[gen-marketing-image] ${model} failed:`, String(e));
    return null;
  }
}

async function main() {
  console.log(`[gen-marketing-image] generating ${SIZE} with gpt-image-1…`);
  // Same fallback order as the live route: gpt-image-1 needs org verification.
  const base64 = (await tryGenerate('gpt-image-1', SIZE)) ?? (await tryGenerate('dall-e-3', '1792x1024'));
  if (!base64) {
    console.error('[gen-marketing-image] both models failed — asset NOT written.');
    process.exit(1);
  }
  const out = join(process.cwd(), 'public', 'made-by-modus.png');
  writeFileSync(out, Buffer.from(base64, 'base64'));
  console.log(`[gen-marketing-image] wrote ${out}`);
}

void main();
