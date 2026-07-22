/**
 * Guards the fix for the bug Jeremiah hit on 2026-07-22:
 *
 *   > how do u route ur models?
 *   MODUS routed this to Llama 3.3
 *   "Model routing is the practice of intelligently choosing the best model at the
 *    lowest cost for each incoming AI request... According to Dapto, ..."
 *
 * A question about MODUS was (a) treated as an external web lookup, because
 * "how do" is in shouldWebSearch's keyword list, and (b) routed to the weakest
 * model in the catalog. It answered by describing someone else's product.
 *
 * Three properties, all asserted against the REAL exported functions:
 *   1. self-questions never web-search
 *   2. self-questions never route to Llama on a paid plan
 *   3. the precision guards hold — ordinary queries still search and still route
 *      the way they did before
 *
 * Run: npx tsx scripts/verify-self-query-routing.ts   (no API keys needed)
 */
import { isSelfQuery } from '../lib/chat/self-query';
import { shouldWebSearch } from '../lib/tavily';
import { routeTask } from '../lib/chat/auto-route';

let failures = 0;
function check(name: string, pass: boolean, detail = '') {
  console.log(`${pass ? '  ok  ' : ' FAIL '} ${name}${detail ? ` — ${detail}` : ''}`);
  if (!pass) failures++;
}

// ── 1. The reported query, and its neighbours ────────────────────────────────
const SELF_QUERIES = [
  'how do u route ur models?',
  'how do you route your models',
  'what are your models',
  'ur models?',
  'how many models do i get',
  'which model is this',
  'what model are you',
  'how does MODUS choose which model to use',
  'what can you do',
  "what's included in your plans",
];
console.log('\nself-questions are recognised:');
for (const q of SELF_QUERIES) check(JSON.stringify(q), isSelfQuery(q));

// ── 2. Precision: ordinary queries must NOT be caught ────────────────────────
const NOT_SELF = [
  'hi',
  'thanks',
  'what is the latest news on the fed',
  'can you pick a restaurant near me',
  'write a blog post about my favourite models',
  'how do i deploy a next.js app',
  'what is the price of bitcoin',
  'explain transformers to me',
  'draft a reply to sarah',
];
console.log('\nordinary queries are NOT caught (precision):');
for (const q of NOT_SELF) check(JSON.stringify(q), !isSelfQuery(q));

// ── 3. Self-questions must never reach the web ───────────────────────────────
console.log('\nself-questions never web-search:');
for (const q of SELF_QUERIES) check(JSON.stringify(q), shouldWebSearch(q) === false);

console.log('\nweb search still fires for genuinely external questions:');
for (const q of ['what is the latest news on the fed', 'what is the price of bitcoin', 'how to deploy a next.js app']) {
  check(JSON.stringify(q), shouldWebSearch(q) === true);
}

// ── 3b. Explicit intent is not vetoed by the keyword list ────────────────────
// The "+ → Web search" toggle used to mean "search this, IF shouldWebSearch()
// agrees too" — and for most real searches it didn't. fetchWebSearchBlock now
// takes `explicit`; these are the queries that proved the bug.
console.log('\nexplicit "+" searches that the keyword list would have silently vetoed:');
const EXPLICIT_ONLY = [
  'who won the game last night',
  'tesla stock',
  'anthropic funding round',
  'is claude 5 out yet',
  'find me competitors to moduspilot',
];
for (const q of EXPLICIT_ONLY) {
  // Not caught by the keyword list...
  check(`${JSON.stringify(q)} is NOT a keyword match`, shouldWebSearch(q) === false);
  // ...and not a self-question, so `explicit` is what must carry it through.
  check(`${JSON.stringify(q)} is not vetoed as a self-question`, isSelfQuery(q) === false);
}

// ── 4. Routing: never Llama for a product question on a paid plan ────────────
(async () => {
  console.log('\nrouting (plan=modus):');
  for (const q of SELF_QUERIES) {
    const r = await routeTask(q, 'modus');
    const ok = r.category === 'product' && r.modelId !== 'meta/llama-3.3-70b' && r.webSearch === false;
    check(JSON.stringify(q), ok, `category=${r.category} model=${r.modelId} webSearch=${r.webSearch}`);
  }

  console.log('\nrouting is unchanged for everything else (plan=modus):');
  const EXPECTED: [string, string][] = [
    ['hi', 'general'],
    ['thanks', 'general'],
    ['write me an essay about the sea', 'writing'],
    ['debug this typescript error for me', 'code'],
    ["what's the latest news on rates", 'research'],
    ['help me plan my week step by step', 'reasoning'],
  ];
  for (const [q, expected] of EXPECTED) {
    const r = await routeTask(q, 'modus');
    check(JSON.stringify(q), r.category === expected, `category=${r.category} (expected ${expected}) model=${r.modelId}`);
  }

  console.log(failures === 0 ? '\nAll checks passed.\n' : `\n${failures} check(s) FAILED.\n`);
  process.exit(failures === 0 ? 1 && 0 : 1);
})();
