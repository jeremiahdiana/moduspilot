import { OpenAILogo, ClaudeLogo, GeminiLogo, MetaLogo } from '@/components/marketing/ModelLogos';

// Single source of truth for the founding journey's facts. Everything here must
// be accurate — a false claim on a page asking for money is worse than none.
//
// ⚠️ Grok / xAI is intentionally absent: MODUS does not serve it (xAI credits
//    are off; grok-4.5 is commented out in lib/models.ts). Never add it here.
// Model display names match lib/models.ts exactly.

export interface FrontierModel {
  name: string;
  provider: string;
  blurb: string;
  logo: (p: { className?: string }) => React.ReactNode;
  accent: string;
}

// The frontier models a founder unlocks at PILOT (lib/models.ts, `pilot` plan).
export const FRONTIER_MODELS: FrontierModel[] = [
  { name: 'Claude Opus',    provider: 'Anthropic', blurb: 'Deepest reasoning & code',      logo: ClaudeLogo, accent: '#D97757' },
  { name: 'GPT-5.6 Sol',    provider: 'OpenAI',    blurb: 'Frontier problem-solving',      logo: OpenAILogo, accent: '#10A37F' },
  { name: 'Gemini 3.1 Pro', provider: 'Google',    blurb: 'Massive-context research',      logo: GeminiLogo, accent: '#4285F4' },
  { name: 'Claude Fable 5', provider: 'Anthropic', blurb: 'Most capable — writing & taste', logo: ClaudeLogo, accent: '#D97757' },
  { name: 'Llama 4 Maverick', provider: 'Meta',    blurb: 'Open-weight, blazing fast',     logo: MetaLogo,   accent: '#0866FF' },
];

// What buying the frontier tier from each lab costs on its own (flagship consumer
// tier, verified mid-2026). Meta's Llama is open/free, so it isn't a paid row —
// it's a bonus. See the plan for sources.
export interface PriceRow {
  lab: string;
  tier: string;
  price: number;
  logo: (p: { className?: string }) => React.ReactNode;
}
export const PRICE_TEARDOWN: PriceRow[] = [
  { lab: 'OpenAI',    tier: 'ChatGPT Pro', price: 200, logo: OpenAILogo },
  { lab: 'Anthropic', tier: 'Claude Max',  price: 200, logo: ClaudeLogo },
  { lab: 'Google',    tier: 'AI Ultra',    price: 200, logo: GeminiLogo },
];
export const TEARDOWN_TOTAL = PRICE_TEARDOWN.reduce((s, r) => s + r.price, 0); // 600
export const FOUNDING_PRICE = 24;

// The five standing founding perks (single source of truth — FoundingOffer.tsx imports this).
export const JOURNEY_PERKS: [string, string][] = [
  ['Every frontier model', 'Full PILOT — Claude Opus, GPT-5.6 Sol, Gemini 3.1 Pro, Fable 5 and more.'],
  ['$24/mo — locked for life', 'The founding rate never rises, even as prices do.'],
  ['A physical founding card, mailed to you', 'Your numbered member card, printed and sent — yours to keep.'],
  ['Private founders channel + monthly call', 'A direct line to Jeremiah and the other founders. Help shape the roadmap.'],
  ['Permanent founding badge', 'A founding mark that stays yours as MODUS grows.'],
];
