/**
 * Does an attached image actually reach the model the user picked?
 *
 * 🚨 THE BUG THIS REPRODUCES. resolveChatModel used to carry this, ABOVE the tier gate:
 *
 *     if (hasImage && openAIKey) {
 *       const id = visionOpenAIModel(selectedModel);   // regex: /gpt-5\.6|gpt-4o|.../
 *       return served(createOpenAI({ apiKey: openAIKey })(id), id);
 *     }
 *
 * Every image went to OpenAI, and anything not matching that regex collapsed to
 * gpt-4o-mini. Claude Sonnet 5, Claude Opus, Claude Fable 5, both Geminis and Llama 4
 * Maverick are all natively multimodal, and not one of them could ever see an image: a
 * $59 PILOT customer attached a screenshot to Opus and was answered by the cheapest
 * model we serve, while the switcher still said "Opus". Sitting above the tier gate, it
 * ALSO let an image route around the plan check.
 *
 * PART A (offline, no keys, no spend) asserts the routing table.
 * PART B (live, costs a few cents) proves every `vision: true` in the catalog is TRUE by
 * sending a real generated image through the real provider path and checking the model
 * reads it back. This is the part that matters: a model that cannot see does not error,
 * it answers confidently about nothing — the same class of silent failure as a wrong
 * model id. An assertion in a comment is not evidence.
 *
 *   cd apps/web && npx tsx scripts/verify-vision-routing.ts          # part A only
 *   cd apps/web && npx tsx scripts/verify-vision-routing.ts --live   # A + B
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { deflateSync } from 'zlib';

for (const line of readFileSync(resolve(process.cwd(), '.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (!m) continue;
  let v = m[2];
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  if (!(m[1] in process.env)) process.env[m[1]] = v;
}

/* eslint-disable @typescript-eslint/no-var-requires */
const { resolveChatModel, FREE_DEFAULT } = require('../lib/chat/model') as typeof import('../lib/chat/model');
const { PLATFORM_MODELS, modelSupportsVision } = require('../lib/models') as typeof import('../lib/models');
const { generateText } = require('ai') as typeof import('ai');

const LIVE = process.argv.includes('--live');
let failures = 0;
let skipped = 0;

function check(name: string, ok: boolean, detail: string): void {
  console.log(`${ok ? '  ✅' : '  ❌'} ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures++;
}

function skip(name: string, why: string): void {
  console.log(`  ⏭️  ${name} — ${why}`);
  skipped++;
}

/**
 * Which env key does this model's provider need?
 *
 * Without this the script is a liar in the other direction: a machine missing
 * ANTHROPIC_API_KEY sees all three Claude models "fail" vision routing when what
 * actually happened is resolveChatModel correctly fell through to the free default
 * because there was no key to call Anthropic with. That is a MISSING KEY, not a
 * routing bug, and reporting it as a failure trains you to ignore the red.
 */
const PROVIDER_KEY: Record<string, string> = {
  OpenAI: 'OPENAI_API_KEY',
  Anthropic: 'ANTHROPIC_API_KEY',
  Google: 'GOOGLE_GENERATIVE_AI_API_KEY',
  xAI: 'XAI_API_KEY',
  Meta: 'AI_GATEWAY_API_KEY',      // gateway-hosted
  DeepSeek: 'AI_GATEWAY_API_KEY',  // gateway-hosted
};

function keyMissing(provider: string): string | null {
  const env = PROVIDER_KEY[provider];
  if (!env) return null;
  return process.env[env]?.trim() ? null : env;
}

const user = (plan: string) => ({ plan, settings: {} });

// ───────────────────────────────────────────────────────────────────────────────
// PART A — routing table, offline
// ───────────────────────────────────────────────────────────────────────────────
console.log('\nPART A — routing (offline)\n');

console.log('Every catalog model, with an image attached:');
for (const m of PLATFORM_MODELS) {
  const missing = keyMissing(m.provider);
  if (missing) { skip(m.name, `${missing} not set in this environment`); continue; }
  // 'pilot' unlocks everything, so a wrong answer here is about vision, not tiers.
  const r = resolveChatModel(user('pilot'), { hasImage: true, modelId: m.id });
  if (m.vision) {
    check(m.name, r.modelId === m.id, `served ${r.modelId}`);
  } else {
    // Text-only: must be swapped for something that sees, and must SAY so.
    check(
      `${m.name} (text-only)`,
      r.modelId !== m.id && r.downgraded && r.downgradeReason === 'vision',
      `served ${r.modelId}, downgraded=${r.downgraded}, reason=${r.downgradeReason}`,
    );
  }
}

console.log('\nThe original defect, stated directly:');
// These hold with or without an Anthropic key: the OLD code returned gpt-4o-mini
// from the OpenAI key alone, so "not gpt-4o-mini" is exactly the regression to
// catch and it does not depend on Anthropic being reachable.
{
  const r = resolveChatModel(user('pilot'), { hasImage: true, modelId: 'claude-opus-4-8' });
  check('PILOT + Opus + image is NOT gpt-4o-mini', r.modelId !== 'gpt-4o-mini', `served ${r.modelId}`);
}
{
  const r = resolveChatModel(user('modus'), { hasImage: true, modelId: 'claude-sonnet-5' });
  check('MODUS + Sonnet 5 + image is NOT gpt-4o-mini', r.modelId !== 'gpt-4o-mini', `served ${r.modelId}`);
}

console.log('\nThe gate bypass the old branch opened (it sat ABOVE the tier gate):');
{
  // A $24 MODUS account asking for a PILOT-only model WITH an image must still be
  // downgraded. Under the old code this returned an OpenAI model directly, never
  // reaching the plan check at all.
  const r = resolveChatModel(user('modus'), { hasImage: true, modelId: 'claude-fable-5' });
  check(
    'MODUS cannot reach a PILOT model by attaching an image',
    r.modelId !== 'claude-fable-5' && r.downgraded,
    `served ${r.modelId}, downgraded=${r.downgraded}`,
  );
}

console.log('\nNo image = untouched by any of this:');
for (const m of PLATFORM_MODELS) {
  const missing = keyMissing(m.provider);
  if (missing) { skip(m.name, `${missing} not set in this environment`); continue; }
  const r = resolveChatModel(user('pilot'), { hasImage: false, modelId: m.id });
  check(m.name, r.modelId === m.id, `served ${r.modelId}`);
}

console.log('\nUnknown ids fail safe (toward a model that sees, not a guess):');
{
  const r = resolveChatModel(user('pilot'), { hasImage: true, modelId: 'some-model-nobody-has-heard-of' });
  check('unknown id + image', modelSupportsVision(r.modelId), `served ${r.modelId}`);
}

// ───────────────────────────────────────────────────────────────────────────────
// PART B — live round-trip. Proves `vision: true` rather than asserting it.
// ───────────────────────────────────────────────────────────────────────────────

/** Minimal truecolor PNG encoder — no dependency, and the bytes are real PNG. */
function png(width: number, height: number, rgbAt: (x: number, y: number) => [number, number, number]): Buffer {
  const raw = Buffer.alloc(height * (1 + width * 3));
  let o = 0;
  for (let y = 0; y < height; y++) {
    raw[o++] = 0; // filter: none
    for (let x = 0; x < width; x++) {
      const [r, g, b] = rgbAt(x, y);
      raw[o++] = r; raw[o++] = g; raw[o++] = b;
    }
  }
  const table = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc32 = (buf: Buffer): number => {
    let c = 0xffffffff;
    // Indexed rather than for..of: Buffer iteration needs downlevelIteration under
    // this tsconfig, and tsx does not enforce that but `tsc --noEmit` does.
    for (let i = 0; i < buf.length; i++) c = table[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type: string, data: Buffer): Buffer => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
    return Buffer.concat([len, body, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/**
 * Two halves, two unusual colours. A SOLID colour is a bad probe — "blue" is a
 * plausible blind guess. Naming both halves in the right order is not: a model that
 * cannot see has to win twice, and the left/right split also proves it received
 * spatial content rather than a colour-average.
 */
const PROBE = png(96, 96, (x) => (x < 48 ? [255, 0, 255] : [255, 255, 0])); // magenta | yellow
const PROBE_Q =
  'This image is split into a left half and a right half, each a single solid colour. '
  + 'Reply with ONLY the two colour names, lowercase, separated by a comma, left half first. No other words.';

async function live(): Promise<void> {
  console.log('\nPART B — live round-trip (real image, real providers)\n');
  console.log(`  probe: 96x96 PNG, ${PROBE.length} bytes, magenta | yellow\n`);

  for (const m of PLATFORM_MODELS.filter(x => x.vision)) {
    const missing = keyMissing(m.provider);
    if (missing) { skip(m.name, `${missing} not set in this environment`); continue; }
    const r = resolveChatModel(user('pilot'), { hasImage: true, modelId: m.id });
    if (r.modelId !== m.id) {
      check(m.name, false, `did not even route here — served ${r.modelId} (provider key missing?)`);
      continue;
    }
    try {
      const res = await generateText({
        model: r.model,
        // temperature 1: ai@4.3.19 hardcodes 0 and Claude 5 400s on it.
        temperature: 1,
        // 🪤 NOT 64. Measured 2026-08-03: both Geminis are reasoners and spend the
        // budget BEFORE emitting, so at maxTokens 64 they return finishReason='length'
        // with text='' — indistinguishable from "this model is blind" unless you read
        // finishReason. At 512 they answer correctly using 3 completion tokens. The
        // same trap already ate gpt-oss and Claude 5 thinking; a vision probe must
        // leave headroom for reasoning or it measures the budget, not the eyes.
        maxTokens: 512,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', image: PROBE },
            { type: 'text', text: PROBE_Q },
          ],
        }],
      });
      const said = res.text.toLowerCase();
      const sawBoth = said.includes('magenta') && said.includes('yellow');
      const rightOrder = said.indexOf('magenta') < said.indexOf('yellow');
      check(m.name, sawBoth && rightOrder, `said "${res.text.trim().replace(/\s+/g, ' ').slice(0, 60)}"`);
    } catch (err) {
      check(m.name, false, `threw: ${String(err instanceof Error ? err.message : err).slice(0, 120)}`);
    }
  }

  // The other half of the contract: a text-only model must be REROUTED, and the
  // reroute must produce a real answer rather than a provider error.
  console.log('\n  Text-only models are rerouted and still answer:');
  for (const m of PLATFORM_MODELS.filter(x => !x.vision)) {
    const r = resolveChatModel(user('pilot'), { hasImage: true, modelId: m.id });
    try {
      const res = await generateText({
        model: r.model,
        temperature: 1,
        maxTokens: 512, // see the note above — 64 measures the token budget, not vision
        messages: [{ role: 'user', content: [{ type: 'image', image: PROBE }, { type: 'text', text: PROBE_Q }] }],
      });
      const said = res.text.toLowerCase();
      check(`${m.name} → ${r.modelId}`, said.includes('magenta') && said.includes('yellow'), `said "${res.text.trim().slice(0, 40)}"`);
    } catch (err) {
      check(`${m.name} → ${r.modelId}`, false, `threw: ${String(err instanceof Error ? err.message : err).slice(0, 120)}`);
    }
  }
}

async function main(): Promise<void> {
  if (LIVE) await live();
  else console.log('\n(skipping live round-trip — pass --live to prove the vision flags)');

  const tail = skipped ? `, ${skipped} skipped for missing keys` : '';
  console.log(`\n${failures === 0 ? '✅ PASS' : `❌ ${failures} FAILED`}${tail}  (free default = ${FREE_DEFAULT})\n`);
  process.exit(failures === 0 ? 0 : 1);
}

main();
