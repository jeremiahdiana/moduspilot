/**
 * Test the extractDurableMemory gate against representative exchanges — the
 * junk types we found polluting the index vs. real durable facts.
 *   cd apps/web && npx tsx scripts/test-memory-gate.ts
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';

for (const line of readFileSync(resolve(process.cwd(), '.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (!m) continue;
  let v = m[2];
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  if (!(m[1] in process.env)) process.env[m[1]] = v;
}

const CASES: { label: string; expect: 'SAVE' | 'NONE'; user: string; assistant: string }[] = [
  { label: 'unread-email summary', expect: 'NONE',
    user: 'do i have any important emails i missed either from clients or coworkers?',
    assistant: 'You have 7 unread emails. None are marked as high priority. Do you want me to mark them as read?' },
  { label: 'web-search echo', expect: 'NONE',
    user: 'what does "if I have missed anything important" mean',
    assistant: 'According to ludwig.guru, the phrase "if I have missed anything important" is used to solicit feedback.' },
  { label: 'today schedule', expect: 'NONE',
    user: "what's on my calendar today",
    assistant: 'You have Lunch at 12pm and a Series Build Onboarding Overview at 3pm.' },
  { label: 'fundraise fact', expect: 'SAVE',
    user: "I'm raising a $1M pre-seed for MODUS through Y Combinator.",
    assistant: 'Got it. I will keep your $1M YC raise in mind when prioritizing.' },
  { label: 'preference fact', expect: 'SAVE',
    user: 'Always give me blunt, direct feedback. No fluff, no hedging.',
    assistant: 'Understood. Direct and blunt going forward.' },
  { label: 'relationship fact', expect: 'SAVE',
    user: 'Brianne Kimmel at Worklife is my top target investor.',
    assistant: 'Noted. Brianne Kimmel (Worklife) as your top investor target.' },
];

async function main() {
  const { extractDurableMemory } = await import('@/lib/chat/memory');
  let pass = 0;
  for (const c of CASES) {
    const fact = await extractDurableMemory(c.user, c.assistant);
    const got = fact ? 'SAVE' : 'NONE';
    const ok = got === c.expect;
    if (ok) pass++;
    console.log(`${ok ? '✅' : '❌'} [${c.expect}] ${c.label}`);
    if (fact) console.log(`     → "${fact}"`);
  }
  console.log(`\n${pass}/${CASES.length} correct`);
  process.exit(pass === CASES.length ? 0 : 1);
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });
