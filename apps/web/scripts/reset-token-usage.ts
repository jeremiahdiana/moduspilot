/**
 * Read or clear a user's usage counters (owner/admin use).
 *
 * The ceilings are enforced from the rolling window (windowStart + windowTokens)
 * and the weekly cap (tokenWeek + weeklyTokens) on the user doc
 * (lib/chat/limits.ts). A heavy session can exhaust a real account, and there is
 * no way to undo that from the product, so this exists to put it back. Prints the
 * previous values before writing.
 *
 *   cd apps/web && npx tsx scripts/reset-token-usage.ts <email>            # read
 *   cd apps/web && npx tsx scripts/reset-token-usage.ts <email> --reset    # clear
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { initializeApp, getApps, cert, getApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

for (const line of readFileSync(resolve(process.cwd(), '.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (!m) continue;
  let v = m[2];
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  if (!(m[1] in process.env)) process.env[m[1]] = v;
}

// Ceilings come from lib/plan.ts (planCeilings), never redeclared here — this
// script used to hardcode its own copy, so it reported a limit that ignored any
// purchased add-on and derived weekly as daily*7 instead of the real constant.

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

async function main() {
  const email = process.argv[2];
  if (!email) throw new Error('usage: reset-token-usage.ts <email> [--reset]');
  const reset = process.argv.includes('--reset');

  const user = await getAuth(app()).getUserByEmail(email);
  const db = getFirestore(app());
  const ref = db.collection('users').doc(user.uid);
  const snap = await ref.get();
  const d = snap.data() ?? {};

  const plan = d.plan as string | undefined;
  const { planCeilings } = await import('@/lib/plan');
  const { WINDOW_MS } = await import('@/lib/constants');
  const { window: windowLimit, weekly: weeklyLimit } = planCeilings(d);
  const addonQty = Number(d.limitAddonQty) || 0;

  const windowStart = Number(d.windowStart) || 0;
  const msLeft = windowStart + WINDOW_MS - Date.now();
  const windowState = windowStart === 0
    ? '(unset)'
    : msLeft > 0
      ? `resets in ${Math.floor(msLeft / 3600000)}h ${Math.floor((msLeft % 3600000) / 60000)}m`
      : 'expired (a new window starts on the next message)';

  console.log(`email          : ${email}`);
  console.log(`uid            : ${user.uid}`);
  console.log(`plan           : ${plan ?? '(none)'}`);
  console.log(`limitAddonQty  : ${addonQty}${addonQty ? ' (ceilings below include it)' : ''}`);
  console.log(`windowStart    : ${windowStart === 0 ? '(unset)' : new Date(windowStart).toISOString()}  ${windowState}`);
  console.log(`windowTokens   : ${(d.windowTokens ?? 0).toLocaleString()} / ${windowLimit.toLocaleString()}`);
  console.log(`tokenWeek      : ${d.tokenWeek ?? '(unset)'}`);
  console.log(`weeklyTokens   : ${(d.weeklyTokens ?? 0).toLocaleString()} / ${weeklyLimit.toLocaleString()}`);

  if (!reset) {
    console.log('\n(read only — pass --reset to clear)');
    return;
  }

  // windowStart:0 reads as expired everywhere, so this fully clears the window.
  await ref.set({ windowTokens: 0, windowStart: 0, weeklyTokens: 0 }, { merge: true });
  console.log('\n✅ windowTokens, windowStart and weeklyTokens cleared');
}

main().catch((e) => { console.error(e); process.exit(1); });
