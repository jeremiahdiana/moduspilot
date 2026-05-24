import { inngest } from '@/lib/inngest';
import { adminDb } from '@/lib/firebase-admin';
import { getAllValidAccessTokens } from '@/lib/google-oauth';
import { getRecentSenders } from '@/lib/google-gmail';

function localHour(timezone: string): number {
  try { return parseInt(new Date().toLocaleTimeString('en-US', { timeZone: timezone, hour: '2-digit', hour12: false }), 10); }
  catch { return new Date().getUTCHours(); }
}

function localDateStr(timezone: string): string {
  try { return new Date().toLocaleDateString('en-CA', { timeZone: timezone }); }
  catch { return new Date().toISOString().slice(0, 10); }
}

export const contactTracker = inngest.createFunction(
  { id: 'contact-tracker' },
  { cron: '0 * * * *' },
  async ({ step }) => {
    await step.run('sync-contacts', async () => {
      const usersSnap = await adminDb.collection('users').get();
      const syncs: Promise<void>[] = [];

      for (const userDoc of usersSnap.docs) {
        const uid = userDoc.id;
        const data = userDoc.data();
        const tz = data.settings?.briefingTimezone ?? 'UTC';
        const today = localDateStr(tz);

        if (localHour(tz) !== 3) continue;
        if (data.lastContactSyncDate === today) continue;

        syncs.push((async () => {
          try {
            const accounts = await getAllValidAccessTokens(uid);
            if (!accounts.length) return;

            const allSenders = new Map<string, { name: string; email: string; lastEmailDate: string; threadCount: number }>();

            for (const account of accounts) {
              const senders = await getRecentSenders(account.token, 30);
              for (const s of senders) {
                const existing = allSenders.get(s.email);
                if (!existing) {
                  allSenders.set(s.email, { ...s });
                } else {
                  existing.threadCount += s.threadCount;
                  if (s.lastEmailDate > existing.lastEmailDate) {
                    existing.lastEmailDate = s.lastEmailDate;
                    existing.name = s.name;
                  }
                }
              }
            }

            const writes: Promise<unknown>[] = Array.from(allSenders.entries()).map(([email, sender]) => {
              const safeKey = Buffer.from(email).toString('base64').replace(/[/+=]/g, '_');
              return adminDb.collection('users').doc(uid).collection('contacts').doc(safeKey).set({
                name: sender.name,
                email: sender.email,
                lastEmailDate: sender.lastEmailDate,
                threadCount: sender.threadCount,
                syncedDate: today,
              }, { merge: true });
            });
            writes.push(adminDb.collection('users').doc(uid).update({ lastContactSyncDate: today }));
            await Promise.all(writes);

            console.log(`[contact-tracker] synced ${allSenders.size} contacts for ${uid}`);
          } catch (e) {
            console.error(`[contact-tracker] failed for ${uid}:`, e);
          }
        })());
      }

      await Promise.allSettled(syncs);
      return { synced: syncs.length };
    });
  },
);
