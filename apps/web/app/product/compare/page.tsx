'use client';

import Link from 'next/link';
import MarketingShell from '@/components/marketing/MarketingShell';

// One-line, honest strengths. Written per model from what it is actually good at,
// not marketing superlatives.
const STRENGTHS: Record<string, string> = {
  'meta/llama-3.3-70b': 'Fast, open weights. A capable everyday model with no lock-in.',
  'deepseek/deepseek-v3.1': 'Strong reasoning and code, at open-model cost.',
  'gemini-3.5-flash': 'Quick, multimodal, reads images. Great for everyday work.',
  'gemini-3.5-flash-lite': 'The fastest, cheapest option. Good for quick questions.',
  'gpt-5.6-terra': 'OpenAI’s everyday workhorse, reads images.',
  'claude-sonnet-5': 'Balanced writing and reasoning, excellent for long documents.',
  'meta/llama-4-maverick': 'A 1M-token context and native vision, open weights.',
  'gpt-5.6-sol': 'OpenAI’s frontier reasoning model.',
  'claude-opus-4-8': 'Anthropic’s most capable model for hard, careful work.',
  'gemini-3.1-pro-preview': 'Google’s frontier model, long context and vision.',
  'claude-fable-5': 'The frontier of writing and knowledge work.',
};

type Row = { name: string; provider: string; strength: string };

const FREE: Row[] = [
  { name: 'Llama 3.3', provider: 'Meta', strength: STRENGTHS['meta/llama-3.3-70b'] },
  { name: 'DeepSeek V3.1', provider: 'DeepSeek', strength: STRENGTHS['deepseek/deepseek-v3.1'] },
  { name: 'Gemini 3.5 Flash', provider: 'Google', strength: STRENGTHS['gemini-3.5-flash'] },
  { name: 'Gemini 3.5 Flash Lite', provider: 'Google', strength: STRENGTHS['gemini-3.5-flash-lite'] },
];

const MODUS: Row[] = [
  { name: 'GPT-5.6 Terra', provider: 'OpenAI', strength: STRENGTHS['gpt-5.6-terra'] },
  { name: 'Claude Sonnet 5', provider: 'Anthropic', strength: STRENGTHS['claude-sonnet-5'] },
];

const PILOT: Row[] = [
  { name: 'GPT-5.6 Sol', provider: 'OpenAI', strength: STRENGTHS['gpt-5.6-sol'] },
  { name: 'Claude Opus', provider: 'Anthropic', strength: STRENGTHS['claude-opus-4-8'] },
  { name: 'Claude Fable 5', provider: 'Anthropic', strength: STRENGTHS['claude-fable-5'] },
  { name: 'Gemini 3.1 Pro', provider: 'Google', strength: STRENGTHS['gemini-3.1-pro-preview'] },
  { name: 'Llama 4 Maverick', provider: 'Meta', strength: STRENGTHS['meta/llama-4-maverick'] },
];

function ModelCard({ row }: { row: Row }) {
  return (
    <div className="rounded-xl border border-border bg-panel p-5">
      <div className="flex items-baseline justify-between gap-3 mb-1.5">
        <span className="text-base font-semibold text-text">{row.name}</span>
        <span className="text-xs text-muted">{row.provider}</span>
      </div>
      <p className="text-sm text-muted leading-relaxed">{row.strength}</p>
    </div>
  );
}

function Group({ eyebrow, title, blurb, rows }: { eyebrow: string; title: string; blurb: string; rows: Row[] }) {
  return (
    <section className="max-w-5xl mx-auto px-6 py-10">
      <div className="mb-6">
        <p className="text-xs uppercase tracking-[0.18em] text-muted mb-2">{eyebrow}</p>
        <h2 className="text-2xl sm:text-3xl text-text tracking-tight mb-2">{title}</h2>
        <p className="text-muted max-w-2xl leading-relaxed">{blurb}</p>
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        {rows.map(r => <ModelCard key={r.name} row={r} />)}
      </div>
    </section>
  );
}

export default function ComparePage() {
  return (
    <MarketingShell>
      <section className="pt-36 pb-10 px-6 text-center">
        <p className="text-xs uppercase tracking-[0.2em] text-muted mb-4">Compare models</p>
        <h1 className="text-5xl md:text-6xl text-text tracking-tight leading-[1.08] mb-5">
          Every model,<br />one conversation
        </h1>
        <p className="text-muted text-lg max-w-2xl mx-auto leading-relaxed">
          Claude, GPT-5.6, Gemini, Llama and DeepSeek in the same chat. Leave it on Auto and let MODUS
          route each task to the model that fits, or pick one per message. Ask several at once and get one
          clear answer.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link href="/login" className="btn-ink px-6 py-3 text-sm">Start free</Link>
          <Link href="/pricing" className="btn-outline px-6 py-3 text-sm">See pricing</Link>
        </div>
      </section>

      <Group
        eyebrow="Free"
        title="The open models"
        blurb="Free accounts get the open and fast models with no card, on a rolling window that refreshes through the day."
        rows={FREE}
      />
      <Group
        eyebrow="MODUS · $24/mo"
        title="Every provider, auto-routed"
        blurb="MODUS adds the everyday flagships from every provider. Leave it on Auto and each message goes to the model that fits."
        rows={MODUS}
      />
      <Group
        eyebrow="PILOT · $59/mo"
        title="The frontier models"
        blurb="PILOT unlocks the frontier tier, picked per message, for the hardest reasoning, writing and knowledge work."
        rows={PILOT}
      />

      <section className="max-w-3xl mx-auto px-6 py-20 text-center">
        <h2 className="text-3xl md:text-4xl text-text tracking-tight mb-5">One subscription. Every model.</h2>
        <Link href="/login" className="btn-ink px-8 py-3.5 text-base">Start free</Link>
      </section>
    </MarketingShell>
  );
}
