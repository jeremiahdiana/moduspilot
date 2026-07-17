/**
 * DRY RUN for the time-gated proactive Inngest jobs. For one user it runs each
 * job's real data-gathering + generation (ignoring only the local-hour gate,
 * which is trivially correct), prints what each WOULD send, and checks the
 * external (Calendar) dependencies. WRITES NOTHING.
 *
 *   cd apps/web && npx tsx scripts/verify-jobs.ts <uid>
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

const FOCUS_KEYWORDS = /focus|deep work|deep-work|heads down|do not disturb|dnd/i;

async function main() {
  const uid = process.argv[2];
  if (!uid) { console.error('usage: verify-jobs.ts <uid>'); process.exit(1); }

  const { adminDb } = await import('@/lib/firebase-admin');
  const { getAllValidAccessTokens } = await import('@/lib/google-oauth');
  const { getTodayEvents, getUpcomingEvents, getRecentlyEndedEvents } = await import('@/lib/google-calendar');
  const { createOpenAI } = await import('@ai-sdk/openai');
  const { generateText } = await import('ai');
  const groq = createOpenAI({ apiKey: process.env.AI_GATEWAY_API_KEY ?? '', baseURL: 'https://ai-gateway.vercel.sh/v1' });

  const userSnap = await adminDb.collection('users').doc(uid).get();
  const data = userSnap.data() ?? {};
  const tz = data.settings?.briefingTimezone ?? 'UTC';
  const today = new Date().toLocaleDateString('en-CA', { timeZone: tz });
  const name = (data.displayName as string | undefined)?.split(' ')[0] || 'there';
  console.log(`User: ${data.displayName ?? '(no name)'}  tz=${tz}  today=${today}\n`);

  const gen = async (prompt: string, maxTokens: number) =>
    (await generateText({ model: groq('meta/llama-3.3-70b'), prompt, maxTokens })).text.trim();

  // ── 1. daily-checkin (local noon) ──
  {
    const [goalsSnap, tasksSnap] = await Promise.all([
      adminDb.collection('users').doc(uid).collection('goals').where('status', '==', 'active').get(),
      adminDb.collection('users').doc(uid).collection('tasks').where('done', '==', false).get(),
    ]);
    const goals = goalsSnap.docs.filter(d => !d.data().deleted).map(d => d.data().title).slice(0, 3);
    const tasks = tasksSnap.docs.filter(d => !d.data().deleted && d.data().dueDate === today).map(d => d.data().title).slice(0, 3);
    const ctx = [goals.length && `Active goals: ${goals.join(', ')}`, tasks.length && `Due today: ${tasks.join(', ')}`].filter(Boolean).join('\n');
    const text = await gen(`You are MODUS Pilot, a sharp personal chief of staff. Write a brief midday check-in for ${name}. 2-3 sentences. Direct and energizing, not cheerleader-y.\n\n${ctx || 'No specific tasks due today.'}\n\nAddress ${name} directly in the second person ("you", "your") — never "we" or "our". No em dashes. No filler.`, 150);
    console.log(`【daily-checkin】 (noon)  goals=${goals.length} dueToday=${tasks.length}\n  ↳ ${text}\n`);
  }

  // ── 2. end-of-day-reflection (local reflectionHour) ──
  {
    const [tasksSnap, habitsSnap, goalsSnap] = await Promise.all([
      adminDb.collection('users').doc(uid).collection('tasks').get(),
      adminDb.collection('users').doc(uid).collection('habits').get(),
      adminDb.collection('users').doc(uid).collection('goals').where('status', '==', 'active').get(),
    ]);
    const completed = tasksSnap.docs.filter(d => d.data().done && !d.data().deleted).map(d => d.data().title).slice(0, 5);
    const overdue = tasksSnap.docs.filter(d => !d.data().done && !d.data().deleted && (d.data().dueDate ?? '') !== '' && (d.data().dueDate as string) <= today).map(d => d.data().title).slice(0, 5);
    const habitsToday = habitsSnap.docs.map(d => ({ title: d.data().title, done: (d.data().completedDates ?? []).includes(today) }));
    const ctx = [
      completed.length && `Tasks completed today: ${completed.join(', ')}`,
      overdue.length && `Tasks that slipped: ${overdue.join(', ')}`,
      habitsToday.filter(h => h.done).length && `Habits logged: ${habitsToday.filter(h => h.done).map(h => h.title).join(', ')}`,
      habitsToday.filter(h => !h.done).length && `Habits missed: ${habitsToday.filter(h => !h.done).map(h => h.title).join(', ')}`,
    ].filter(Boolean).join('\n');
    const text = await gen(`You are MODUS Pilot, a sharp personal chief of staff. Write a brief end-of-day reflection for ${name}. 3-4 sentences. Acknowledge wins, call out slips without lecturing, frame tomorrow. Address ${name} directly in the second person ("you", "your") — never "we" or "our". No em dashes.\n\n${ctx || 'No task data for today.'}`, 200);
    console.log(`【end-of-day-reflection】  done=${completed.length} slipped=${overdue.length} habits=${habitsToday.length}\n  ↳ ${text}\n`);
  }

  // ── 3. habit-reminder (7pm local) ──
  {
    const habitsSnap = await adminDb.collection('users').doc(uid).collection('habits').get();
    const incomplete = habitsSnap.docs.map(d => ({ title: d.data().title, c: (d.data().completedDates ?? []) as string[] })).filter(h => !h.c.includes(today)).map(h => h.title).slice(0, 5);
    if (!incomplete.length) {
      console.log(`【habit-reminder】 (7pm)  incomplete=0 → would NOT fire (all habits logged / no habits)\n`);
    } else {
      const text = await gen(`You are MODUS Pilot. Brief evening habit reminder for ${name}. Still not logged: ${incomplete.join(', ')}. 1-2 sentences. Direct, motivating, urgent but achievable. No em dashes.`, 100);
      console.log(`【habit-reminder】 (7pm)  incomplete=${incomplete.length} [${incomplete.join(', ')}]\n  ↳ ${text}\n`);
    }
  }

  // ── 4. weekly-review (Sun) — data readiness ──
  {
    const [habitsSnap, goalsSnap, tasksSnap] = await Promise.all([
      adminDb.collection('users').doc(uid).collection('habits').get(),
      adminDb.collection('users').doc(uid).collection('goals').get(),
      adminDb.collection('users').doc(uid).collection('tasks').get(),
    ]);
    console.log(`【weekly-review】 (Sun)  habits=${habitsSnap.size} goals=${goalsSnap.size} tasks=${tasksSnap.size} → has data to summarize: ${habitsSnap.size + goalsSnap.size > 0 ? 'yes' : 'no'}\n`);
  }

  // ── 5 & 6. Calendar jobs — reachability + qualifying events ──
  {
    const accounts = await getAllValidAccessTokens(uid);
    if (!accounts.length) { console.log(`【meeting-intelligence / focus-protection】 no Gmail/Calendar accounts → skip\n`); }
    for (const { email, token } of accounts) {
      const [todayEv, upcoming, ended] = await Promise.all([
        getTodayEvents(token, tz).catch(e => { console.log(`  [${email}] ⛔ calendar fetch failed: ${(e as Error).message}`); return []; }),
        getUpcomingEvents(token, 60, tz).catch(() => []),
        getRecentlyEndedEvents(token, 60).catch(() => []),
      ]);
      const upcomingQ = upcoming.filter(e => !e.allDay).filter(e => { const m = (new Date(e.start).getTime() - Date.now()) / 60000; return m >= 5 && m <= 60; });
      const endedQ = ended.filter(e => !e.allDay).filter(e => { const m = (Date.now() - new Date(e.end).getTime()) / 60000; return m >= 5 && m <= 60; });
      const focusBlocks = todayEv.filter(e => FOCUS_KEYWORDS.test(e.title));
      console.log(`【calendar】 [${email}]  today=${todayEv.length} events  upcoming(5-60m)=${upcomingQ.length}  justEnded(5-60m)=${endedQ.length}  focusBlocks=${focusBlocks.length}`);
      if (todayEv.length) console.log(`  today: ${todayEv.slice(0, 6).map(e => `"${e.title}"`).join(', ')}`);
      console.log(`  → meeting-intelligence would send ${upcomingQ.length} pre + ${endedQ.length} post brief(s) now; focus-protection needs a focus-titled block + overlap (${focusBlocks.length} focus block(s) today)`);
    }
    console.log('');
  }

  console.log('─'.repeat(50));
  console.log('DRY RUN — nothing written, no push sent.');
  process.exit(0);
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });
