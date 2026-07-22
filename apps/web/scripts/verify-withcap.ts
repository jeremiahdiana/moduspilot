/**
 * A timeout log must mean a timeout happened.
 *
 * 🪤 withCap's timer was never cleared, so its "…timed out after Xms — answering
 * without it" warning fired on EVERY request whose lifetime exceeded the cap —
 * including the ones where the fetch had succeeded long before. Every capped
 * fetch in the chat route (memory, group availability, web search, Drive) was
 * emitting a phantom timeout warning on virtually every message.
 *
 * That is not cosmetic. During the 2026-07-23 audit "memory query timed out on
 * 25 of 25 consecutive requests" was read straight off these lines, believed,
 * and acted on. Logs that lie are worse than no logs.
 *
 *   cd apps/web && npx tsx scripts/verify-withcap.ts
 */
import { withCap } from '../lib/chat/context';

let failures = 0;
function check(label: string, cond: boolean, detail?: unknown) {
  console.log(`${cond ? '✅' : '❌'} ${label}`);
  if (!cond) { failures++; if (detail !== undefined) console.log(`   ${JSON.stringify(detail)}`); }
}

const warnings: string[] = [];
const realWarn = console.warn;
console.warn = (...args: unknown[]) => { warnings.push(args.map(String).join(' ')); };

const after = <T>(ms: number, value: T) => new Promise<T>(r => setTimeout(() => r(value), ms));
const settle = (ms: number) => new Promise(r => setTimeout(r, ms));

async function main() {
  // ── fast work, short cap: must NOT warn, even if we linger well past the cap
  warnings.length = 0;
  const fast = await withCap(after(20, 'real value'), 100, 'fallback', 'fast fetch');
  check('a fetch that beats its cap returns the real value', fast === 'real value', fast);
  await settle(300); // outlive the cap — the phantom warning fired here before
  check('…and logs NO timeout warning afterwards', warnings.length === 0, warnings);

  // ── slow work: must warn exactly once, and fall back
  warnings.length = 0;
  const slow = await withCap(after(300, 'too late'), 60, 'fallback', 'slow fetch');
  check('a fetch that misses its cap falls back', slow === 'fallback', slow);
  check('…and logs exactly one timeout warning', warnings.length === 1, warnings);
  await settle(400);
  check('…and does not log a second time when the work lands', warnings.length === 1, warnings);

  console.warn = realWarn;
  console.log(`\n${failures === 0 ? '✅ all checks passed' : `❌ ${failures} check(s) failed`}`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => { console.warn = realWarn; console.error(e); process.exit(1); });
