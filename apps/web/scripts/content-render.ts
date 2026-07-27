/**
 * Turn a content-engine run into assets a human can actually publish.
 *
 * The engine measures the split; this renders it. Nothing here calls a model —
 * it is deterministic templating over data already on disk, so re-rendering is
 * free and does not burn the compare rate limit.
 *
 * What it will NOT do:
 *  - render a prompt where the models agreed. A 5/0 consensus is one answer with
 *    four redundant witnesses; publishing it is indistinguishable from any
 *    single-model competitor's blog and proves nothing about MODUS.
 *  - put a link in the Reddit draft. A domain flagged as spam has every
 *    moduspilot.com link auto-removed sitewide, near-irreversibly. The Reddit
 *    asset is a comment that earns the question "what did you use for that?" —
 *    the link goes in the reply, by hand, if someone asks.
 *
 *   cd apps/web && npx tsx scripts/content-render.ts <run-stamp>
 *   cd apps/web && npx tsx scripts/content-render.ts --latest
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'fs';
import { resolve } from 'path';

const SITE = 'moduspilot.com';

interface Column {
  modelId: string; modelName: string; provider: string;
  ok: boolean; pick: string | null; why: string; text: string; ms: number;
}
interface PromptResult {
  id: string; topic: string; question: string; options: string[];
  columns: Column[]; split: Record<string, string[]>; disagreement: number; verdict: string | null;
}
interface Run { ranAt: string; models: string[]; results: PromptResult[] }

/** "3 of 5" / the majority-minority framing every asset is built on. */
function tally(r: PromptResult) {
  const entries = Object.entries(r.split).sort((a, b) => b[1].length - a[1].length);
  const total = entries.reduce((n, [, v]) => n + v.length, 0);
  return {
    total,
    majority: entries[0] ? { option: entries[0][0], models: entries[0][1] } : null,
    minority: entries[1] ? { option: entries[1][0], models: entries[1][1] } : null,
    entries,
  };
}

function quote(r: PromptResult, option: string): { model: string; why: string } | null {
  const c = r.columns.find(c => c.pick === option && c.why.trim().length > 40);
  if (!c) return null;
  // One sentence. A paragraph is not a quote, it is a wall.
  const why = c.why.split(/(?<=[.!?])\s/)[0].trim();
  return { model: c.modelName, why };
}

function xPost(r: PromptResult): string {
  const t = tally(r);
  if (!t.majority || !t.minority) return '';
  const q = quote(r, t.minority.option);
  const lines = [
    `Asked ${t.total} frontier models the same question:`,
    ``,
    `"${r.question.replace(/\s+/g, ' ').trim()}"`,
    ``,
    `${t.majority.models.length} said ${t.majority.option}.`,
    `${t.minority.models.length} said ${t.minority.option}.`,
  ];
  if (q) lines.push(``, `${q.model}: "${q.why}"`);
  return lines.join('\n');
}

function xThread(r: PromptResult): string {
  const t = tally(r);
  if (!t.majority) return '';
  const out: string[] = [];
  out.push(`1/ ${t.total} frontier models, one question, and they did not agree.\n\n"${r.question.replace(/\s+/g, ' ').trim()}"`);
  let i = 2;
  for (const [option, models] of t.entries) {
    const q = quote(r, option);
    out.push(`${i}/ ${models.length === 1 ? 'Only ' : ''}${models.join(', ')} picked ${option}.${q ? `\n\n"${q.why}"` : ''}`);
    i++;
  }
  out.push(`${i}/ Neither side is obviously wrong, which is the point. One model gives you one answer and no way to know it was contested.`);
  return out.join('\n\n---\n\n');
}

/**
 * Reddit: the observation, not the ad. No link, no product name in the body.
 * It reads as something a person found interesting, because it is.
 */
function redditComment(r: PromptResult): string {
  const t = tally(r);
  if (!t.majority || !t.minority) return '';
  const qMaj = quote(r, t.majority.option);
  const qMin = quote(r, t.minority.option);
  const lines = [
    `I ran this exact question past ${t.total} of the current frontier models side by side, mostly out of curiosity about whether they'd converge.`,
    ``,
    `They didn't. ${t.majority.models.length} picked ${t.majority.option} (${t.majority.models.join(', ')}), ${t.minority.models.length} picked ${t.minority.option} (${t.minority.models.join(', ')}).`,
  ];
  if (qMaj) lines.push(``, `The case for ${t.majority.option}, roughly: ${qMaj.why}`);
  if (qMin) lines.push(``, `And against: ${qMin.why}`);
  lines.push(``, `What stuck with me is that if you'd only asked one of them you'd have walked away thinking this was settled.`);
  return lines.join('\n');
}

/** Short-form script. Beats, not prose — the on-screen text is the content. */
function videoScript(r: PromptResult): string {
  const t = tally(r);
  if (!t.majority || !t.minority) return '';
  const qMin = quote(r, t.minority.option);
  return [
    `HOOK (0:00-0:03)  on-screen: "${t.total} AI models. One question. They disagreed."`,
    `  vo: I asked ${t.total} frontier models the same question and screenshotted every answer.`,
    ``,
    `SETUP (0:03-0:08)  on-screen: the question, full width, held`,
    `  vo: ${r.question.replace(/\s+/g, ' ').trim()}`,
    ``,
    `REVEAL (0:08-0:16)  on-screen: columns filling in one at a time, pick highlighted`,
    `  vo: ${t.entries.map(([o, m]) => `${m.length} said ${o}`).join('. ')}.`,
    ``,
    `TURN (0:16-0:24)  on-screen: the minority quote, large`,
    qMin ? `  vo: ${qMin.model} was the holdout. Quote: ${qMin.why}` : `  vo: The holdout had the more interesting reasoning.`,
    ``,
    `CLOSE (0:24-0:30)  on-screen: all columns side by side`,
    `  vo: Ask one model and you get one answer. You never find out it was a coin flip.`,
  ].join('\n');
}

/**
 * The SEO page. This is the asset that compounds: it targets a real query
 * ("<A> vs <B>"), it is genuinely non-duplicable (nobody else has the split),
 * and unlike a post it does not decay in 48 hours.
 */
function seoPage(r: PromptResult, ranAt: string): string {
  const t = tally(r);
  if (!t.majority || !t.minority) return '';
  const date = ranAt.slice(0, 10);
  const title = `${t.majority.option} vs ${t.minority.option}: what ${t.total} frontier AI models actually said`;

  const out: string[] = [
    `---`,
    `title: "${title.replace(/"/g, "'")}"`,
    `slug: "${r.id}"`,
    `date: "${date}"`,
    `topic: "${r.topic}"`,
    `description: "We put the same question to ${t.total} frontier models from ${new Set(r.columns.filter(c => c.ok).map(c => c.provider)).size} different labs. ${t.majority.models.length} picked ${t.majority.option}, ${t.minority.models.length} picked ${t.minority.option}. Every answer, unedited."`,
    `---`,
    ``,
    `# ${title}`,
    ``,
    `**The question:** ${r.question}`,
    ``,
    `We asked ${t.total} frontier models this exact question, at the same time, with the same instructions, and made each one commit to a single answer instead of hedging. Here is how they split.`,
    ``,
    `## The scoreboard`,
    ``,
    `| Pick | Models | Count |`,
    `| --- | --- | --- |`,
    ...t.entries.map(([o, m]) => `| **${o}** | ${m.join(', ')} | ${m.length} |`),
    ``,
    `## Every answer, unedited`,
    ``,
  ];

  for (const c of r.columns.filter(c => c.ok)) {
    out.push(`### ${c.modelName} <span>${c.provider}</span>`, ``, `**Picked: ${c.pick ?? 'no clear pick'}**`, ``, `> ${c.why.replace(/\n+/g, ' ')}`, ``);
  }

  if (r.verdict) {
    out.push(`## The verdict`, ``, r.verdict, ``);
  }

  out.push(
    `## Why this is worth two minutes`,
    ``,
    `Neither answer here is wrong. That is exactly the problem with asking one model: you get a confident, well-written answer with no indication that another equally capable model would have told you the opposite. The disagreement is information, and a single-model workflow throws it away by construction.`,
    ``,
    `This comparison was generated by running the question through every model at once on [MODUS](https://${SITE}).`,
    ``,
    `<small>Run ${date}. Models: ${r.columns.filter(c => c.ok).map(c => `${c.modelName} (${c.provider})`).join(', ')}. Answers are the models' own words, trimmed to the reasoning sentence.</small>`,
  );
  return out.join('\n');
}

function main() {
  const runsDir = resolve(process.cwd(), 'content/runs');
  let stamp = process.argv.find((a, i) => i >= 2 && !a.startsWith('--')) ?? null;
  if (process.argv.includes('--latest') || !stamp) {
    const files = readdirSync(runsDir).filter(f => f.endsWith('.json')).sort();
    if (!files.length) { console.error('❌ no runs in content/runs'); process.exit(1); }
    stamp = files[files.length - 1].replace(/\.json$/, '');
  }

  const run = JSON.parse(readFileSync(resolve(runsDir, `${stamp}.json`), 'utf8')) as Run;
  const usable = run.results.filter(r => r.disagreement > 0).sort((a, b) => b.disagreement - a.disagreement);

  const outDir = resolve(process.cwd(), `content/drafts/${stamp}`);
  mkdirSync(outDir, { recursive: true });

  console.log(`\n── render ${stamp} ─────────────────────────────────`);
  console.log(`${usable.length} of ${run.results.length} prompts split. ${run.results.length - usable.length} reached consensus and are skipped.\n`);

  if (!usable.length) {
    console.log('Nothing to publish. Every model agreed on every question.');
    console.log('That is a prompt-set problem, not an engine problem: add questions a good');
    console.log('engineer could genuinely answer either way.\n');
    return;
  }

  const index: string[] = [`# Drafts — run ${stamp}`, ``, `Ranked by how hard the models disagreed. Nothing here is published.`, ``];

  for (const r of usable) {
    const t = tally(r);
    const bundle = [
      `# ${r.id}`,
      ``,
      `**Question:** ${r.question}`,
      `**Split:** ${t.entries.map(([o, m]) => `${m.length} ${o}`).join(' / ')}  (disagreement ${r.disagreement})`,
      ``,
      `---`,
      ``,
      `## X — single post`,
      ``,
      '```',
      xPost(r),
      '```',
      ``,
      `## X — thread`,
      ``,
      '```',
      xThread(r),
      '```',
      ``,
      `## Reddit — comment (NO LINK, on purpose)`,
      ``,
      '```',
      redditComment(r),
      '```',
      ``,
      `## Short-form video script`,
      ``,
      '```',
      videoScript(r),
      '```',
      ``,
      `## SEO page`,
      ``,
      `Written to \`seo/${r.id}.md\`.`,
      ``,
    ].join('\n');

    writeFileSync(resolve(outDir, `${r.id}.md`), bundle);
    mkdirSync(resolve(outDir, 'seo'), { recursive: true });
    writeFileSync(resolve(outDir, 'seo', `${r.id}.md`), seoPage(r, run.ranAt));

    const post = xPost(r);
    index.push(`- **${r.id}** (${r.disagreement}) — ${t.entries.map(([o, m]) => `${m.length} ${o}`).join(' / ')}`);
    console.log(`▸ ${r.id}  (${r.disagreement})`);
    console.log(`  x post: ${post.split('\n').filter(Boolean).length} lines, ${post.length} chars${post.length > 280 ? '  ⚠️ over 280, use the thread' : ''}`);
  }

  writeFileSync(resolve(outDir, 'INDEX.md'), index.join('\n') + '\n');
  console.log(`\nsaved  ${outDir}`);
  console.log(`       INDEX.md, one bundle per split, seo/ pages ready to publish\n`);
}

main();
