/**
 * Does the Llama size guard still protect against anything?
 *
 * LLAMA_TPM_SAFE_TOKENS=9000 in app/api/chat/route.ts exists because Groq's
 * free tier had a ~12k tokens/minute ORG-WIDE cap: a big request 429'd with
 * "Request too large". Above the cap the route silently upgrades the user to a
 * PAID model (gpt-5.6-terra / claude-sonnet-5), or trims their context if they
 * can't have one. Llama now serves from the Vercel AI Gateway, so the guard may
 * be paying OpenAI/Anthropic to dodge a limit that no longer exists.
 *
 * Sends real prompts at increasing sizes straight at LLAMA_FALLBACK through the
 * Gateway and reports what actually happens. Needs AI_GATEWAY_API_KEY.
 *
 *   cd apps/web && npx tsx scripts/verify-llama-size-guard.ts
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { createOpenAI } from '@ai-sdk/openai';
import { generateText } from 'ai';

for (const line of readFileSync(resolve(process.cwd(), '.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (!m) continue;
  let v = m[2];
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  if (!(m[1] in process.env)) process.env[m[1]] = v;
}

const LLAMA_FALLBACK = 'meta/llama-3.3-70b';
const LLAMA_TPM_SAFE_TOKENS = 9000; // the guard's threshold

const gateway = createOpenAI({
  apiKey: process.env.AI_GATEWAY_API_KEY ?? '',
  baseURL: 'https://ai-gateway.vercel.sh/v1',
});

/** Filler that tokenizes at roughly 4 chars/token, matching the route's estimate. */
function filler(approxTokens: number): string {
  const sentence = 'The quarterly review covered revenue, retention, and roadmap risk in detail. ';
  return sentence.repeat(Math.ceil((approxTokens * 4) / sentence.length)).slice(0, approxTokens * 4);
}

async function attempt(approxTokens: number) {
  const prompt = `${filler(approxTokens - 40)}\n\nReply with exactly one word: ACKNOWLEDGED`;
  const estimated = Math.ceil(prompt.length / 4);
  const started = Date.now();
  try {
    const { text, usage, finishReason } = await generateText({
      model: gateway(LLAMA_FALLBACK),
      prompt,
      maxTokens: 64,
    });
    const guarded = estimated > LLAMA_TPM_SAFE_TOKENS;
    console.log(`✅ ~${estimated.toLocaleString()} tok  →  ${finishReason}  in ${Date.now() - started}ms`);
    console.log(`     prompt=${usage?.promptTokens ?? '?'} completion=${usage?.completionTokens ?? '?'}  reply=${JSON.stringify(text.trim().slice(0, 40))}`);
    console.log(`     guard would have ${guarded ? '⚠️  UPGRADED to a PAID model / trimmed' : 'left this alone'}`);
    return true;
  } catch (e) {
    console.log(`❌ ~${estimated.toLocaleString()} tok  →  FAILED in ${Date.now() - started}ms`);
    console.log(`     ${String((e as Error).message).slice(0, 220)}`);
    return false;
  }
}

async function main() {
  if (!process.env.AI_GATEWAY_API_KEY) { console.error('AI_GATEWAY_API_KEY missing'); process.exit(1); }
  console.log(`\nmodel: ${LLAMA_FALLBACK} via the Vercel AI Gateway`);
  console.log(`guard: upgrades/trims above ${LLAMA_TPM_SAFE_TOKENS.toLocaleString()} estimated tokens\n`);

  const results: Record<number, boolean> = {};
  // 8k sits under the guard (control). Everything above it is a request the
  // guard currently diverts to a paid model.
  for (const size of [8_000, 12_000, 20_000, 40_000]) {
    results[size] = await attempt(size);
    console.log();
  }

  const overGuard = [12_000, 20_000, 40_000].filter((s) => results[s]);
  console.log('---');
  if (overGuard.length === 3) {
    console.log('VERDICT: Llama serves every size the guard diverts. The guard only costs money now.');
  } else if (overGuard.length === 0) {
    console.log('VERDICT: Llama still fails above the threshold. KEEP the guard.');
  } else {
    console.log(`VERDICT: mixed — Llama served ${overGuard.map((s) => `${s / 1000}k`).join(', ')} but not all. Set the threshold from this, do not remove it.`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
