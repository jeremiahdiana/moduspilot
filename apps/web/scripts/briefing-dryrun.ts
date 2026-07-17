/**
 * Dry-run the briefing cron's gate against every real user doc, for all 24 UTC
 * hours. Read-only — resolves who WOULD receive a briefing, sends nothing.
 *
 *   cd apps/web && npx tsx scripts/briefing-dryrun.ts
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { isBriefingDue, briefingHour, userCapabilityEnabled } from '../lib/capabilities';

for (const line of readFileSync(resolve(process.cwd(), '.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (!m) continue;
  let v = m[2];
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  if (!(m[1] in process.env)) process.env[m[1]] = v;
}

// Verbatim pre-fix filter, for the before/after count.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const oldFilter = (d: any, utcHour: number) => (d?.settings?.briefingHour ?? 7) === utcHour;

async function main() {
  const { adminDb } = await import('@/lib/firebase-admin');
  const snap = await adminDb.collection('users').where('onboardingComplete', '==', true).get();

  console.log(`\n${snap.size} onboarded user docs\n`);
  let oldTotal = 0;
  let newTotal = 0;

  for (const d of snap.docs) {
    const data = d.data();
    const hour = briefingHour(data);
    const flag = data?.settings?.capabilities?.dailyBriefing;
    const on = userCapabilityEnabled(data, 'dailyBriefing');
    const before = oldFilter(data, hour);   // would the old code send at its own hour?
    const after = isBriefingDue(data, hour); // does the new code?
    oldTotal += before ? 1 : 0;
    newTotal += after ? 1 : 0;
    const flagStr = flag === undefined ? 'unset (default ON)' : String(flag);
    console.log(`${after ? '📨' : '🔇'} ${d.id}`);
    console.log(`     hour=${hour}  dailyBriefing=${flagStr}  → enabled=${on}`);
    console.log(`     before: ${before ? 'SENDS' : 'skips'}   after: ${after ? 'SENDS' : 'skips'}${before && !after ? '   ← stopped' : ''}`);
  }

  console.log(`\nbriefings per day — before: ${oldTotal}   after: ${newTotal}`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
