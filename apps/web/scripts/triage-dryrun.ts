/**
 * DRY RUN for inbox-triage — runs the exact precondition chain against live
 * Gmail + Firestore for every Gmail-connected user, but WRITES NOTHING (no
 * conversation doc, no push, no dedup record). Proves whether the proactive
 * flow would produce a card and, if not, exactly where it stops.
 *
 *   cd apps/web && npx tsx scripts/triage-dryrun.ts
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Load .env.local into process.env before any lib touches it.
for (const line of readFileSync(resolve(process.cwd(), '.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (!m) continue;
  let v = m[2];
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  if (!(m[1] in process.env)) process.env[m[1]] = v;
}

const AUTOMATED_SENDER = /(no[-_.]?reply|do[-_.]?not[-_.]?reply|notifications?@|mailer-daemon|postmaster@|newsletter|@.*\b(mailchimp|sendgrid|sparkpost|amazonses|substack)\b)/i;

function localHour(timezone: string): number {
  try { return parseInt(new Date().toLocaleTimeString('en-US', { timeZone: timezone, hour: '2-digit', hour12: false }), 10); }
  catch { return new Date().getUTCHours(); }
}

async function main() {
  const { adminDb } = await import('@/lib/firebase-admin');
  const { getAllValidAccessTokens } = await import('@/lib/google-oauth');
  const { getActionableThreads } = await import('@/lib/google-gmail');
  const { createOpenAI } = await import('@ai-sdk/openai');
  const { generateText } = await import('ai');

  const usersSnap = await adminDb.collection('users').get();
  console.log(`Scanning ${usersSnap.size} user(s)…\n`);

  let gmailUsers = 0;
  let totalEligible = 0;

  for (const userDoc of usersSnap.docs) {
    const uid = userDoc.id;
    const data = userDoc.data();

    const accounts = await getAllValidAccessTokens(uid);
    if (!accounts.length) continue; // only report Gmail-connected users
    gmailUsers++;

    const name = (data.displayName as string | undefined) ?? '(no name)';
    console.log(`=== ${name}  [${uid}] ===`);

    const capDisabled = data.settings?.capabilities?.inboxTriage === false;
    const tz = (data.settings?.briefingTimezone as string) ?? 'UTC';
    const hour = localHour(tz);
    const hourOk = hour >= 8 && hour <= 20;
    console.log(`  capability:  ${capDisabled ? '❌ DISABLED (no cards)' : '✅ on'}`);
    console.log(`  local time:  ${hour}:00 ${tz}  ${hourOk ? '✅ within 8–20 window' : '⛔ OUTSIDE 8–20 (cron would skip now)'}`);
    console.log(`  gmail:       ${accounts.map(a => a.email).join(', ')}`);

    const ownEmails = new Set(accounts.map(a => a.email.toLowerCase()));

    for (const { email, token } of accounts) {
      let threads;
      try {
        threads = await getActionableThreads(token, { filter: 'primary' });
      } catch (e) {
        console.log(`  [${email}] ⛔ Gmail fetch failed: ${(e as Error).message}`);
        continue;
      }
      console.log(`  [${email}] ${threads.length} actionable thread(s) in last days:`);

      let eligible = 0;
      for (const t of threads) {
        const reasons: string[] = [];
        if (!t.unread) reasons.push('read');
        if (ownEmails.has(t.fromAddress.toLowerCase())) reasons.push('from-self');
        if (t.bulk) reasons.push('bulk-mail');
        if (AUTOMATED_SENDER.test(t.fromAddress) || AUTOMATED_SENDER.test(t.from)) reasons.push('automated-sender');
        if ((t.body ?? '').trim().length < 20) reasons.push('body<20chars');
        const dedup = await adminDb.collection('users').doc(uid).collection('triaged_threads').doc(t.id).get();
        if (dedup.exists) reasons.push('already-triaged');

        if (reasons.length) {
          console.log(`     · skip  "${(t.subject || '(no subject)').slice(0, 50)}" — ${reasons.join(', ')}`);
          continue;
        }
        eligible++;
        console.log(`     ✦ WOULD DRAFT  "${(t.subject || '(no subject)').slice(0, 50)}"  from ${t.from}`);

        if (eligible === 1) {
          const groq = createOpenAI({ apiKey: process.env.GROQ_API_KEY!, baseURL: 'https://api.groq.com/openai/v1' });
          const first = name.split(' ')[0] || 'there';
          try {
            const { text } = await generateText({
              model: groq('llama-3.3-70b-versatile'),
              prompt: `You are MODUS Pilot, ${first}'s chief of staff. Draft a reply ${first} can send to this email. Direct, warm, concise. No subject, no greeting, no signature, no placeholders. 2-5 sentences. No em dashes.\n\n--- Email from ${t.from} ---\nSubject: ${t.subject}\n\n${(t.body ?? '').slice(0, 4000)}\n--- end ---\n\nReply body:`,
              maxTokens: 400,
            });
            console.log(`        ↳ DRAFT GENERATED: "${text.trim().slice(0, 240).replace(/\n+/g, ' ')}…"`);
          } catch (e) {
            console.log(`        ↳ ⛔ draft generation failed: ${(e as Error).message}`);
          }
        }
      }
      const wouldSend = Math.min(eligible, 3);
      totalEligible += wouldSend;
      console.log(`  [${email}] → would create ${wouldSend} card(s) this run`);
    }
    console.log('');
  }

  console.log('─'.repeat(50));
  console.log(`Gmail-connected users: ${gmailUsers}`);
  console.log(`Cards that WOULD be created right now: ${totalEligible}`);
  console.log('DRY RUN — nothing was written to Firestore, no push sent.');
  process.exit(0);
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });
