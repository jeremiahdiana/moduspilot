/**
 * Pin the context-fetch intent gates.
 *
 * Every `true` here costs a Google round trip before the first token (~2.5s
 * measured). Every `false` costs a clarifying question. Both directions are
 * asserted, because tightening a regex to fix latency is exactly how you
 * silently break "what's on my calendar".
 *
 *   cd apps/web && npx tsx scripts/verify-context-intent.ts
 */
import { needsEmailCtx, needsCalendarCtx, isVagueQuery } from '../lib/chat/context';

let failures = 0;
function expect(fn: (q: string) => boolean, q: string, want: boolean, why: string) {
  const got = fn(q);
  const ok = got === want;
  if (!ok) failures++;
  console.log(`${ok ? '✅' : '❌'} ${want ? 'FETCH ' : 'skip  '} ${JSON.stringify(q)}  — ${why}`);
}

console.log('\n── needsEmailCtx ──');
// Must still fire: these are real inbox questions.
expect(needsEmailCtx, 'any emails i should care about', true, 'the query this audit began on');
expect(needsEmailCtx, 'check my inbox', true, 'inbox');
expect(needsEmailCtx, 'anything unread from gmail', true, 'unread + gmail');
expect(needsEmailCtx, 'draft a reply to sam', true, 'reply TO someone');
expect(needsEmailCtx, 'did anyone respond to my proposal', true, 'respond to');
expect(needsEmailCtx, 'what was that message from sarah', true, 'message from');
// Must NOT fire: ordinary English that was pulling Gmail (measured 3887ms).
expect(needsEmailCtx, 'can you send me a draft blog post about fitness', false, 'send/draft ≠ inbox');
expect(needsEmailCtx, 'draft a tweet about launching modus', false, 'draft alone');
expect(needsEmailCtx, 'send it in a shorter format', false, 'send alone');
expect(needsEmailCtx, 'i missed the gym today', false, 'missed alone');

console.log('\n── needsCalendarCtx ──');
expect(needsCalendarCtx, 'whats on my calendar today', true, 'calendar');
expect(needsCalendarCtx, 'do i have any meetings tomorrow', true, 'meetings');
expect(needsCalendarCtx, 'what do i have today', true, 'temporal + first person');
expect(needsCalendarCtx, 'anything on tomorrow', true, 'temporal + enquiry');
expect(needsCalendarCtx, 'am i free this week', true, 'free/busy');
// Must NOT fire: measured 5918ms of context on a greeting-shaped message.
expect(needsCalendarCtx, 'how are you doing today', false, 'bare "today" in small talk');
expect(needsCalendarCtx, 'explain why the sky is blue', false, 'no temporal at all');

console.log('\n── isVagueQuery (fans out to email+calendar+notes+contacts) ──');
expect(isVagueQuery, 'what should i do today', true, 'short AND about the user');
expect(isVagueQuery, 'hows my week looking', true, 'my');
expect(isVagueQuery, 'catch me up', true, 'me');
// Must NOT fire: measured 3931ms vs 1375ms for a seven-word question.
expect(isVagueQuery, 'explain recursion in one sentence', false, 'short but impersonal');
expect(isVagueQuery, 'what is a monad', false, 'short but impersonal');
expect(isVagueQuery, 'define entropy', false, 'short but impersonal');
expect(isVagueQuery, 'hey', false, 'small talk stays small talk');
expect(isVagueQuery, 'write a detailed essay about the roman empire', false, 'long enough to be specific');

console.log(`\n${failures === 0 ? '✅ all checks passed' : `❌ ${failures} check(s) failed`}`);
process.exit(failures === 0 ? 0 : 1);
