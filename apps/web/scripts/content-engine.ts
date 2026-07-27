/**
 * The content engine: run a prompt set through the REAL production compare
 * endpoint, measure where the models actually DISAGREE, and save the run.
 *
 * Why disagreement and not "good answers": a single-model competitor can produce
 * a good answer. It structurally cannot produce "we asked seven frontier models
 * and four of them picked the opposite thing" — that artifact requires running
 * all of them, which is exactly what MODUS is. Consensus is worthless as content
 * (it is one answer with extra steps); the split IS the product demo.
 *
 * So this script optimises for a forced pick. Each prompt in content/prompts.json
 * carries an `options` pair, and the engine appends a strict output contract so
 * every column's first line is machine-readable. A model that answers "well, it
 * depends" is unquotable and unscoreable.
 *
 * ⚠️ RATE LIMIT IS REAL AND SERVER-SIDE. app/api/chat/compare/route.ts allows
 * MAX_PER_HOUR = 40 single-model calls per user per clock hour, and it counts the
 * call BEFORE it checks anything else. models x prompts is the budget. The engine
 * refuses to start a run it cannot finish rather than discovering the ceiling as
 * a wall of 429s halfway through and leaving a half-written run file.
 *
 * ⚠️ The frontier models are PILOT-only and the gate is server-side. On a `modus`
 * plan the pilot columns come back 402 model_locked and every split silently
 * collapses to the cheap models. Set the plan first, and put it back after:
 *
 *   cd apps/web && npx tsx scripts/set-plan.ts pilot
 *   cd apps/web && npx tsx scripts/content-engine.ts
 *   cd apps/web && npx tsx scripts/set-plan.ts --restore
 *
 * Flags:
 *   --models a,b,c   explicit model ids           (default: 5 across 5 providers)
 *   --limit N        only the first N prompts     (default: as many as fit)
 *   --topic X        only prompts tagged X
 *   --ids a,b        exactly these prompt ids, in this order
 *   --dry            print the plan + budget, fire nothing
 */
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { resolve } from 'path';
import { initializeApp, getApps, cert, getApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

for (const line of readFileSync(resolve(process.cwd(), '.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (!m) continue;
  let v = m[2];
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  if (!(m[1] in process.env)) process.env[m[1]] = v;
}

import { PLATFORM_MODELS } from '../lib/models';

const APP = 'https://app.moduspilot.com';
const UID = process.env.MODUS_UID || 'hSBcOHKSX9eCHaKSDczccTRzv093';

/** Must match MAX_PER_HOUR in app/api/chat/compare/route.ts. */
const SERVER_HOURLY_BUDGET = 40;

/**
 * Five models, five DIFFERENT providers, deliberately.
 *
 * Two models from the same lab agreeing is not a signal a reader cares about —
 * it reads as one vote. A split across Anthropic / OpenAI / Google / Meta /
 * DeepSeek is the headline, and it is also the tier ladder the product sells.
 */
const DEFAULT_MODELS = [
  'claude-opus-4-8',
  'gpt-5.6-sol',
  'gemini-3.1-pro-preview',
  'meta/llama-4-maverick',
  'deepseek/deepseek-v3.1',
];

interface Prompt {
  id: string;
  topic: string;
  question: string;
  options?: string[];
}

interface Column {
  modelId: string;
  modelName: string;
  provider: string;
  ok: boolean;
  status: number;
  served: string;
  ms: number;
  text: string;
  pick: string | null;
  why: string;
  detail: string;
}

interface PromptResult {
  id: string;
  topic: string;
  question: string;
  options: string[];
  columns: Column[];
  split: Record<string, string[]>;
  disagreement: number;
  verdict: string | null;
}

const arg = (name: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : null;
};
const DRY = process.argv.includes('--dry');

function app() {
  if (getApps().length) return getApp();
  return initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

async function idToken(): Promise<string> {
  const custom = await getAuth(app()).createCustomToken(UID);
  const key = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${key}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: custom, returnSecureToken: true }) },
  );
  const data = await res.json() as { idToken?: string; error?: { message?: string } };
  if (!data.idToken) throw new Error(`token exchange failed: ${JSON.stringify(data.error)}`);
  return data.idToken;
}

/**
 * The output contract. Without it a frontier model hedges — "both are reasonable,
 * it depends on your team" — which is a true answer and a useless one: it cannot
 * be counted, quoted, or disagreed with. Forcing the first line to be a bare pick
 * is what turns ten opinions into a scoreboard.
 */
function contractFor(p: Prompt): string {
  if (!p.options?.length) return p.question;
  return `${p.question}

Answer in EXACTLY this format and nothing else:
PICK: <${p.options.join(' or ')}>
WHY: <at most two sentences>

You must commit to one of the two options on the PICK line. "It depends" is not an option.`;
}

/**
 * Read the pick back out. The PICK: line is the happy path; the fallback exists
 * because a model that ignores the contract still usually names its choice in
 * the first sentence, and throwing that column away would bias the split toward
 * whichever models happen to be most instruction-obedient.
 */
function extractPick(text: string, options: string[]): { pick: string | null; why: string } {
  const whyLine = text.match(/^\s*WHY:\s*(.+)$/mi)?.[1]?.trim() ?? '';
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();

  const pickLine = text.match(/^\s*PICK:\s*(.+)$/mi)?.[1]?.trim();
  if (pickLine) {
    const n = norm(pickLine);
    const hit = options.find(o => n.includes(norm(o)) || norm(o).includes(n));
    if (hit) return { pick: hit, why: whyLine || firstSentence(text) };
  }

  // Fallback: whichever option is NAMED FIRST in the opening of the answer.
  const head = norm(text.slice(0, 400));
  let best: { opt: string; at: number } | null = null;
  for (const o of options) {
    const at = head.indexOf(norm(o));
    if (at >= 0 && (best === null || at < best.at)) best = { opt: o, at };
  }
  return { pick: best?.opt ?? null, why: whyLine || firstSentence(text) };
}

function firstSentence(text: string): string {
  const body = text.replace(/^\s*PICK:.*$/mi, '').replace(/^\s*WHY:\s*/mi, '').trim();
  return (body.split(/(?<=[.!?])\s/)[0] ?? '').trim().slice(0, 300);
}

async function column(token: string, p: Prompt, modelId: string): Promise<Column> {
  const info = PLATFORM_MODELS.find(m => m.id === modelId);
  const started = Date.now();
  const base = {
    modelId,
    modelName: info?.name ?? modelId,
    provider: info?.provider ?? '?',
  };
  try {
    const res = await fetch(`${APP}/api/chat/compare`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ prompt: contractFor(p), model: modelId }),
    });
    const served = res.headers.get('x-modus-model') ?? '(none)';
    if (!res.ok) {
      return { ...base, ok: false, status: res.status, served, ms: Date.now() - started, text: '', pick: null, why: '', detail: (await res.text()).slice(0, 200) };
    }
    // toTextStreamResponse() — the body is the raw answer, no frame protocol.
    const text = await res.text();
    const { pick, why } = extractPick(text, p.options ?? []);
    return { ...base, ok: text.trim().length > 0, status: res.status, served, ms: Date.now() - started, text, pick, why, detail: '' };
  } catch (e) {
    return { ...base, ok: false, status: 0, served: '(none)', ms: Date.now() - started, text: '', pick: null, why: '', detail: String(e).slice(0, 200) };
  }
}

/**
 * 0 = every model that committed picked the same thing (worthless as content).
 * Higher = a real split. An even 3/2 across five models scores 0.4; a 5/0 scores 0.
 * Columns that refused to commit are excluded from the denominator — a hedge is
 * not a vote, and counting it as one would manufacture disagreement that the
 * models did not actually express.
 */
function scoreSplit(columns: Column[]): { split: Record<string, string[]>; disagreement: number } {
  const split: Record<string, string[]> = {};
  for (const c of columns) {
    if (!c.ok || !c.pick) continue;
    (split[c.pick] ??= []).push(c.modelName);
  }
  const counts = Object.values(split).map(v => v.length);
  const total = counts.reduce((a, b) => a + b, 0);
  if (total < 2) return { split, disagreement: 0 };
  return { split, disagreement: +(1 - Math.max(...counts) / total).toFixed(3) };
}

async function verdict(token: string, question: string, columns: Column[]): Promise<string | null> {
  const answers = columns.filter(c => c.ok).slice(0, 3).map(c => ({ model: c.modelId, text: c.text, ms: c.ms }));
  if (answers.length < 2) return null;
  try {
    const res = await fetch(`${APP}/api/chat/compare/verdict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ prompt: question, answers }),
    });
    const data = await res.json() as { verdict?: string | null };
    return data.verdict ?? null;
  } catch {
    return null;
  }
}

async function main() {
  const file = JSON.parse(readFileSync(resolve(process.cwd(), 'content/prompts.json'), 'utf8')) as { prompts: Prompt[] };
  let prompts = file.prompts;

  const topic = arg('topic');
  if (topic) prompts = prompts.filter(p => p.topic === topic);

  const ids = arg('ids');
  if (ids) {
    const want = ids.split(',').map(s => s.trim());
    const missing = want.filter(w => !prompts.some(p => p.id === w));
    if (missing.length) { console.error(`\n❌ no such prompt id: ${missing.join(', ')}`); process.exit(1); }
    prompts = want.map(w => prompts.find(p => p.id === w)!);
  }

  const models = (arg('models') ?? DEFAULT_MODELS.join(',')).split(',').map(s => s.trim()).filter(Boolean);

  const unknown = models.filter(m => !PLATFORM_MODELS.some(p => p.id === m));
  if (unknown.length) {
    // A wrong id does not error, it silently becomes something else. Refuse early.
    console.error(`\n❌ not in the catalog: ${unknown.join(', ')}`);
    console.error(`   valid: ${PLATFORM_MODELS.map(m => m.id).join(', ')}`);
    process.exit(1);
  }

  // Budget BEFORE firing anything. A half-finished run is worse than no run.
  const maxPrompts = Math.floor(SERVER_HOURLY_BUDGET / models.length);
  const requested = arg('limit') ? parseInt(arg('limit')!, 10) : prompts.length;
  const n = Math.min(requested, maxPrompts, prompts.length);
  prompts = prompts.slice(0, n);

  console.log(`\n── content engine ─────────────────────────────────`);
  console.log(`models      ${models.length}  ${models.join(', ')}`);
  console.log(`prompts     ${prompts.length}${requested > n ? `  (capped from ${requested})` : ''}`);
  console.log(`calls       ${prompts.length * models.length} / ${SERVER_HOURLY_BUDGET} per hour`);
  if (requested > maxPrompts) {
    console.log(`⚠️  ${models.length} models x ${requested} prompts = ${models.length * requested} calls exceeds the server's hourly ceiling.`);
    console.log(`   Running the first ${maxPrompts}. Re-run next hour for the rest, or pass fewer --models.`);
  }
  if (DRY) { console.log(`\n(--dry: nothing fired)\n`); return; }

  const token = await idToken();
  console.log(`auth        ✅ real Firebase ID token (uid ${UID})\n`);

  const results: PromptResult[] = [];

  for (const p of prompts) {
    process.stdout.write(`▸ ${p.id.padEnd(28)}`);
    // Fire the columns in parallel, exactly as the client does — a slow model
    // must not serialise the whole run.
    const columns = await Promise.all(models.map(m => column(token, p, m)));
    const { split, disagreement } = scoreSplit(columns);
    const v = await verdict(token, p.question, columns);

    results.push({ id: p.id, topic: p.topic, question: p.question, options: p.options ?? [], columns, split, disagreement, verdict: v });

    const dead = columns.filter(c => !c.ok);
    const tally = Object.entries(split).map(([k, v]) => `${v.length} ${k}`).join(' / ') || '(no picks)';
    console.log(`  split ${String(disagreement).padStart(5)}  ${tally}${dead.length ? `  ⚠️ ${dead.length} dead` : ''}`);
    for (const d of dead) console.log(`    ❌ ${d.modelId} HTTP ${d.status} ${d.detail.slice(0, 100)}`);
  }

  mkdirSync(resolve(process.cwd(), 'content/runs'), { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const out = resolve(process.cwd(), `content/runs/${stamp}.json`);
  writeFileSync(out, JSON.stringify({ ranAt: new Date().toISOString(), models, results }, null, 2));

  const ranked = [...results].sort((a, b) => b.disagreement - a.disagreement);
  console.log(`\n── ranked by disagreement ─────────────────────────`);
  for (const r of ranked) {
    const tally = Object.entries(r.split).map(([k, v]) => `${v.length} ${k}`).join(' / ') || '(no picks)';
    const mark = r.disagreement >= 0.4 ? '🔥' : r.disagreement > 0 ? '  ' : '💤';
    console.log(`${mark} ${String(r.disagreement).padStart(5)}  ${r.id.padEnd(28)} ${tally}`);
  }

  const usable = ranked.filter(r => r.disagreement > 0);
  console.log(`\nsaved  ${out}`);
  console.log(`${usable.length}/${results.length} prompts produced a real split.`);
  console.log(`next   npx tsx scripts/content-render.ts ${stamp}\n`);
}

main().catch((e) => { console.error('\n❌', e); process.exit(1); });
