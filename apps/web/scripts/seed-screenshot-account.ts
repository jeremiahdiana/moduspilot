/**
 * Provision a clean, idempotent PILOT account for capturing product
 * screenshots (model switcher + briefing) — no personal data, deterministic
 * doc ids so re-runs never duplicate.
 *
 * Follows the exact env-loading + firebase-admin pattern as
 * scripts/briefing-dryrun.ts.
 *
 *   cd apps/web && npx tsx scripts/seed-screenshot-account.ts
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

const EMAIL = 'moduspilotaitester@gmail.com';
const PASSWORD = 'ScreenshotPilot!2026';

// Deterministic ids → idempotent (re-running never duplicates).
const TASKS = [
  { id: 'shot-task-1', title: 'Finish Q3 planning doc' },
  { id: 'shot-task-2', title: 'Review design feedback' },
  { id: 'shot-task-3', title: 'Reply to the partnerships thread' },
  { id: 'shot-task-4', title: 'Book dentist appointment' },
];

// completedDates uses local YYYY-MM-DD strings, same as the real read/write
// path (lib/dates localDateStr / reminders page).
function daysAgoStr(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

const HABITS = [
  {
    id: 'shot-habit-1',
    title: 'Deep work — 2 hours',
    streak: 6,
    // done today + the 5 days before → streak of 6, shows as "done" today.
    completedDates: [5, 4, 3, 2, 1, 0].map(daysAgoStr),
  },
  {
    id: 'shot-habit-2',
    title: 'Morning workout',
    streak: 4,
    completedDates: [3, 2, 1, 0].map(daysAgoStr),
  },
  {
    id: 'shot-habit-3',
    title: 'Read 20 pages',
    streak: 2,
    // NOT done today → renders "at risk" / unchecked, so the habits card
    // shows a realistic partial (2/3) progress state instead of all-done.
    completedDates: [2, 1].map(daysAgoStr),
  },
];

async function main() {
  const { adminDb, adminAuth } = await import('@/lib/firebase-admin');
  // firebase-admin.ts doesn't wrap updateUser — pull it straight off the
  // already-initialized default app (adminAuth.getUserByEmail below ensures
  // the app exists before we grab it here).
  const { getAuth } = await import('firebase-admin/auth');
  const { getApp } = await import('firebase-admin/app');
  const { FieldValue } = await import('firebase-admin/firestore');

  const user = await adminAuth.getUserByEmail(EMAIL);
  const uid = user.uid;
  console.log(`Found existing account: ${EMAIL} → uid=${uid}`);

  await getAuth(getApp()).updateUser(uid, { password: PASSWORD, emailVerified: true });
  console.log(`Password set + emailVerified=true.`);

  await adminDb.collection('users').doc(uid).set(
    { plan: 'pilot', onboardingComplete: true },
    { merge: true },
  );
  console.log(`users/${uid} → plan='pilot', onboardingComplete=true (merged).`);

  // Report what's already in there (never deleted — additive only) so we
  // know if pre-existing data will show up alongside the seeded content.
  const [existingTasks, existingHabits] = await Promise.all([
    adminDb.collection('users').doc(uid).collection('tasks').get(),
    adminDb.collection('users').doc(uid).collection('habits').get(),
  ]);
  console.log(`Pre-existing: ${existingTasks.size} task doc(s), ${existingHabits.size} habit doc(s).`);

  const tasksCol = adminDb.collection('users').doc(uid).collection('tasks');
  for (const t of TASKS) {
    const ref = tasksCol.doc(t.id);
    const snap = await ref.get();
    if (snap.exists) { console.log(`  task ${t.id} already exists — skipped.`); continue; }
    await ref.set({
      title: t.title,
      done: false,
      deleted: false,
      source: 'manual',
      createdAt: FieldValue.serverTimestamp(),
    });
    console.log(`  created task ${t.id}: "${t.title}"`);
  }

  const habitsCol = adminDb.collection('users').doc(uid).collection('habits');
  for (const h of HABITS) {
    const ref = habitsCol.doc(h.id);
    const snap = await ref.get();
    if (snap.exists) { console.log(`  habit ${h.id} already exists — skipped.`); continue; }
    await ref.set({
      title: h.title,
      streak: h.streak,
      completedDates: h.completedDates,
      frequency: 'daily',
      source: 'manual',
      createdAt: FieldValue.serverTimestamp(),
    });
    console.log(`  created habit ${h.id}: "${h.title}" (streak ${h.streak})`);
  }

  console.log(`\nDone. Screenshot account ready:`);
  console.log(`  email:    ${EMAIL}`);
  console.log(`  password: ${PASSWORD}`);
  console.log(`  uid:      ${uid}`);
  console.log(`  plan:     pilot (all frontier models unlocked)`);
}

main().then(() => process.exit(0)).catch(e => { console.error('FATAL:', e); process.exit(1); });
