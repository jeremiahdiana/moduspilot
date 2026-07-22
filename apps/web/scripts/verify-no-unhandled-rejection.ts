/**
 * Prove that a timed-out background fetch cannot kill the serverless function.
 *
 * ⚠️ THIS FILE EXISTS TO SETTLE A PLAUSIBLE-SOUNDING CLAIM THAT IS FALSE.
 *
 * It is tempting to believe that `Promise.race([work, rejectingTimer]).catch(h)`
 * leaks: the `.catch` belongs to the RACE, so surely `work` is left with no
 * handler and a late rejection kills the process? It does not. `Promise.race`
 * subscribes `.then(resolve, reject)` to EVERY input, so the losing branch is
 * always handled — settled races simply ignore the result.
 *
 * That was asserted during the 2026-07-23 chat audit as a bug, and it was wrong.
 * The check below is kept so nobody (including me) "fixes" it again by
 * scattering defensive `p.catch(() => {})` calls through the context fetchers.
 *
 * A sensitivity control runs alongside it: a genuinely orphaned rejection MUST
 * still be detected, or the negative result proves nothing.
 *
 *   cd apps/web && npx tsx scripts/verify-no-unhandled-rejection.ts
 */
import { withCap } from '../lib/chat/context';

const unhandled: string[] = [];
process.on('unhandledRejection', (reason) => { unhandled.push(String(reason)); });

let failures = 0;
function check(label: string, cond: boolean, detail?: unknown) {
  console.log(`${cond ? '✅' : '❌'} ${label}`);
  if (!cond) { failures++; if (detail !== undefined) console.log(`   ${JSON.stringify(detail)}`); }
}

/** A fetch that is slower than its cap and then fails — the exact production shape. */
const slowThenRejects = (ms: number, tag: string) =>
  new Promise<string[]>((_, reject) => setTimeout(() => reject(new Error(`${tag} failed late`)), ms));

/** Long enough for the late rejection to land and for Node to flag it. */
const settle = () => new Promise((r) => setTimeout(r, 400));

async function main() {
  // ── 1. THE OLD SHAPE MUST TRIP THE DETECTOR ──────────────────────────────
  // If this does not produce an unhandled rejection, the harness is blind and
  // every result below is meaningless.
  unhandled.length = 0;
  const legacy = Promise.race([
    slowThenRejects(80, 'legacy-pinecone'),
    new Promise<never>((_, rej) => setTimeout(() => rej(new Error('timeout')), 20)),
  ]).catch(() => [] as string[]);
  await legacy;
  await settle();
  check(
    'Promise.race does NOT leak its losing branch — it subscribes to every input',
    !unhandled.some((u) => u.includes('legacy-pinecone')),
    unhandled,
  );

  // Sensitivity control: a genuinely orphaned rejection MUST be caught, or the
  // assertion above proves nothing.
  unhandled.length = 0;
  Promise.reject(new Error('orphan-control'));
  await settle();
  check(
    'the detector does fire on a truly orphaned rejection (harness is sensitive)',
    unhandled.some((u) => u.includes('orphan-control')),
    unhandled,
  );

  // ── 2. withCap MUST NOT ──────────────────────────────────────────────────
  unhandled.length = 0;
  const capped = await withCap(slowThenRejects(80, 'withcap-pinecone'), 20, [] as string[], 'memory query');
  check('withCap resolves to the fallback when the work is too slow', Array.isArray(capped) && capped.length === 0, capped);
  await settle();
  check(
    'withCap leaks NOTHING when the timed-out work later rejects',
    !unhandled.some((u) => u.includes('withcap-pinecone')),
    unhandled,
  );

  // ── 3. And it still returns a real value when the work wins ──────────────
  unhandled.length = 0;
  const fast = await withCap(Promise.resolve(['real result']), 500, [] as string[], 'memory query');
  check('withCap returns the real value when the work beats the cap', fast[0] === 'real result', fast);

  // ── 4. A rejection that arrives BEFORE the cap is handled too ────────────
  unhandled.length = 0;
  const early = await withCap(slowThenRejects(10, 'early-fail'), 500, [] as string[], 'memory query');
  check('a fast failure falls back instead of throwing', Array.isArray(early) && early.length === 0, early);
  await settle();
  check('a fast failure leaks nothing either', !unhandled.some((u) => u.includes('early-fail')), unhandled);

  console.log(`\n${failures === 0 ? '✅ all checks passed' : `❌ ${failures} check(s) failed`}`);
  process.exit(failures === 0 ? 0 : 1);
}

main();
