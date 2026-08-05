/**
 * Does EVERY paid surface, at its own cap, still fit inside the subscription?
 *
 * 🚨 WHY THIS EXISTS. lib/chat/model-cost.ts did a careful job of bounding CHAT to
 * dollars: weighted units, a daily ceiling, a weekly ceiling. It bounds nothing
 * else. Voice-out, voice-in and image generation each call a paid API on their own
 * counter, none of which is in the token ceiling, and every one of those counters
 * was set by reasoning about "generous but finite" rather than by multiplying it
 * by a price.
 *
 * That is the same mistake watch mode made — a cap counted in TRIGGERS is
 * meaningless until you multiply it by what a trigger costs — and it went
 * unnoticed for the same reason: nothing computed the product.
 *
 * Measured the first time this ran, against the caps as shipped:
 *
 *   TTS, MODUS  : 300 calls x 4,000 chars x $15/1M  = $18.00/day = $547/month
 *   TTS, PILOT  : 2,000 x 4,000                     = $120/day  = $3,650/month
 *   TTS, FREE   : 30 x 4,000, EVERY DAY, FOREVER    = $1.80/day = $54/month
 *   Images      : 20/day at gpt-image-1 default     = up to $100/month
 *
 * against $24, $59 and $0 of revenue. The free number is the ugliest of the three:
 * chat's free allowance is 10 messages for LIFE, but TTS reset every midnight, so
 * an account that had spent its last message a year ago still had a voice budget.
 *
 *   cd apps/web && npx tsx scripts/verify-surface-costs.ts
 */
import {
  FREE_TTS_CHARS_LIFETIME, MODUS_TTS_CHARS_PER_DAY, PILOT_TTS_CHARS_PER_DAY,
  TTS_USD_PER_1M_CHARS, MODUS_IMAGES_PER_DAY, PILOT_IMAGES_PER_DAY,
  PAID_TRANSCRIBE_SECONDS_PER_DAY, FREE_TRANSCRIBE_SECONDS_LIFETIME, TRANSCRIBE_USD_PER_HOUR,
  MODUS_TOKEN_LIMIT, PILOT_TOKEN_LIMIT,
  IMAGE_USD_EACH_STANDARD, IMAGE_USD_EACH_PRO,
} from '@/lib/constants';
import { BASELINE_USD_PER_1M } from '@/lib/chat/model-cost';

const DAYS = 30;
/** What each plan actually bills, per month. */
const REVENUE = { free: 0, modus: 24, pilot: 59 };
/**
 * The share of revenue worst-case inference may eat.
 *
 * 🔑 This is a WORST CASE, not a forecast: it assumes one user pins every surface
 * to its ceiling every day for 30 days. Sizing caps so that even that user is
 * highly profitable would gut the product for the ordinary user who is the actual
 * customer. So the hard rule is the one Jeremiah stated — "as long as i dont lose
 * money" — and 0.8 is the headroom band above it, leaving room for Stripe's ~3%
 * and for the fixed costs inference is not the whole of.
 */
const MAX_SHARE = 0.8;

let failures = 0;
const check = (name: string, ok: boolean, detail = ''): void => {
  console.log(`  ${ok ? '✅' : '❌'} ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures++;
};
const usd = (n: number) => `$${n.toFixed(2)}`;

// Chat is the one surface that was already bounded. A unit is one token at the
// BASELINE model's blended rate, so units → dollars is a straight multiply.
const chatMonthly = (dailyUnits: number) => (dailyUnits / 1_000_000) * BASELINE_USD_PER_1M * DAYS;

console.log('\nWhat each surface can cost ONE user in a month, at its own cap\n');

const rows = [
  {
    plan: 'free' as const,
    chat: 0, // 10 messages for life, already costed at ~$0.074 once — not monthly
    // Lifetime, so it amortises to ~0/month rather than recurring forever.
    tts: (FREE_TTS_CHARS_LIFETIME / 1_000_000) * TTS_USD_PER_1M_CHARS,
    images: 0, // hasActiveAccess gate — free cannot generate
  },
  {
    plan: 'modus' as const,
    chat: chatMonthly(MODUS_TOKEN_LIMIT),
    tts: (MODUS_TTS_CHARS_PER_DAY / 1_000_000) * TTS_USD_PER_1M_CHARS * DAYS,
    images: MODUS_IMAGES_PER_DAY * IMAGE_USD_EACH_STANDARD * DAYS,
  },
  {
    plan: 'pilot' as const,
    chat: chatMonthly(PILOT_TOKEN_LIMIT),
    tts: (PILOT_TTS_CHARS_PER_DAY / 1_000_000) * TTS_USD_PER_1M_CHARS * DAYS,
    images: PILOT_IMAGES_PER_DAY * IMAGE_USD_EACH_PRO * DAYS,
  },
];

const paidTranscribe = (PAID_TRANSCRIBE_SECONDS_PER_DAY / 3600) * TRANSCRIBE_USD_PER_HOUR * DAYS;
const freeTranscribe = (FREE_TRANSCRIBE_SECONDS_LIFETIME / 3600) * TRANSCRIBE_USD_PER_HOUR;
const voiceIn = (plan: string) => (plan === 'free' ? freeTranscribe : paidTranscribe);

for (const r of rows) {
  const total = r.chat + r.tts + r.images + voiceIn(r.plan);
  const rev = REVENUE[r.plan];
  console.log(`  ${r.plan.toUpperCase().padEnd(6)} revenue ${usd(rev).padStart(7)}  |  chat ${usd(r.chat).padStart(7)}  tts ${usd(r.tts).padStart(7)}  images ${usd(r.images).padStart(7)}  voice-in ${usd(voiceIn(r.plan)).padStart(6)}  =  ${usd(total)}`);
}
console.log();

for (const r of rows) {
  const total = r.chat + r.tts + r.images + voiceIn(r.plan);
  const rev = REVENUE[r.plan];
  if (rev === 0) {
    // A free account must be a ONE-OFF acquisition cost, never a monthly annuity
    // against zero revenue. $1/month/account is already $12/year for someone who
    // may never convert.
    check(`free costs less than $1/month`, total < 1, `${usd(total)}/month`);
  } else {
    // THE HARD GATE. His rule, verbatim: "as long as i dont lose money."
    check(`${r.plan} never loses money at its ceiling`, total < rev, `${usd(total)} vs ${usd(rev)}`);
    // A WARNING, not a failure. Above this the plan is still profitable but the
    // margin at the ceiling is thin, and he should know rather than be blocked —
    // these caps are his product decision, not the verifier's.
    const share = total / rev;
    if (share > MAX_SHARE) {
      console.log(`  ⚠️  ${r.plan} worst case is ${(share * 100).toFixed(0)}% of revenue (over the ${MAX_SHARE * 100}% comfort band) — profitable, but thin at the ceiling`);
    } else {
      check(`${r.plan} leaves comfortable headroom`, true, `${usd(total)} = ${(share * 100).toFixed(0)}% of revenue`);
    }
  }
}

// Visibility, not a gate. Which surface dominates is a product decision — images
// at 8/day SHOULD be the biggest non-chat line if that is the feature being sold.
// The verifier's job is to stop us losing money and to make the shape obvious, not
// to overrule the person who prices the product.
console.log('\nWhere the money goes (warnings only)\n');
for (const r of rows.filter(x => REVENUE[x.plan] > 0)) {
  const rev = REVENUE[r.plan];
  for (const [label, cost] of [['voice-out', r.tts], ['images', r.images]] as const) {
    const pct = (cost / rev) * 100;
    console.log(`  ${pct > 25 ? '⚠️ ' : '  '} ${r.plan}: ${label} is ${usd(cost)} = ${pct.toFixed(0)}% of revenue`);
  }
}

console.log(`\n${failures === 0 ? '✅ EVERY SURFACE FITS INSIDE ITS PLAN.' : `❌ ${failures} FAILED — a user at the cap costs more than they pay.`}\n`);
process.exit(failures === 0 ? 0 : 1);
