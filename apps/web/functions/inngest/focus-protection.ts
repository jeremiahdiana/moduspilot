import { inngest } from '@/lib/inngest';
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { getAllValidAccessTokens } from '@/lib/google-oauth';
import { getTodayEvents } from '@/lib/google-calendar';
import { sendPushToUser } from '@/lib/fcm-admin';

const FOCUS_KEYWORDS = /\b(focus|deep work|deep focus|no meetings?|maker time|block|do not disturb|dnd|heads down|protected|no calls?)\b/i;

function msgId() { return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`; }

function localDateStr(timezone: string): string {
  try { return new Date().toLocaleDateString('en-CA', { timeZone: timezone }); }
  catch { return new Date().toISOString().slice(0, 10); }
}

function fmtHHMM(iso: string): string {
  try { return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }); }
  catch { return iso; }
}

function overlapMinutes(aStart: string, aEnd: string, bStart: string, bEnd: string): number {
  const as = new Date(aStart).getTime();
  const ae = new Date(aEnd).getTime();
  const bs = new Date(bStart).getTime();
  const be = new Date(bEnd).getTime();
  const overlapMs = Math.min(ae, be) - Math.max(as, bs);
  return overlapMs > 0 ? Math.round(overlapMs / 60000) : 0;
}

function shiftToAfter(isoEnd: string, durationMs: number): { newStart: string; newEnd: string } {
  const newStart = new Date(isoEnd);
  const newEnd = new Date(newStart.getTime() + durationMs);
  return { newStart: newStart.toISOString(), newEnd: newEnd.toISOString() };
}

export const focusProtection = inngest.createFunction(
  { id: 'focus-protection' },
  { cron: '0 * * * *' },
  async ({ step }) => {
    await step.run('check-focus-conflicts', async () => {
      const usersSnap = await adminDb.collection('users').get();
      const checks: Promise<void>[] = [];

      for (const userDoc of usersSnap.docs) {
        const uid = userDoc.id;
        const data = userDoc.data();
        const tz = data.settings?.briefingTimezone ?? 'UTC';
        const today = localDateStr(tz);

        checks.push((async () => {
          try {
            const accounts = await getAllValidAccessTokens(uid);
            if (!accounts.length) return;

            // Use first account — focus blocks typically on primary calendar
            const { token } = accounts[0];
            const events = await getTodayEvents(token, tz);
            const timed = events.filter(e => !e.allDay && e.start && e.end);

            const focusBlocks = timed.filter(e => FOCUS_KEYWORDS.test(e.title));
            if (!focusBlocks.length) return;

            const now = Date.now();

            for (const block of focusBlocks) {
              const blockEnd = new Date(block.end).getTime();
              if (blockEnd < now) continue; // focus block already over

              for (const event of timed) {
                if (event.id === block.id) continue;
                if (FOCUS_KEYWORDS.test(event.title)) continue; // another focus block

                const overlap = overlapMinutes(block.start, block.end, event.start, event.end);
                if (overlap < 5) continue;

                const conflictKey = `${today}_${event.id}`;
                const existingRef = adminDb.collection('users').doc(uid).collection('focus_protections').doc(conflictKey);
                const existing = await existingRef.get();
                if (existing.exists) continue;

                // Calculate where to move the event
                const duration = new Date(event.end).getTime() - new Date(event.start).getTime();
                const { newStart, newEnd } = shiftToAfter(block.end, duration);

                const approvalCard = JSON.stringify({
                  type: 'reschedule_event',
                  title: `Move "${event.title}"`,
                  description: `"${event.title}" (${fmtHHMM(event.start)}) overlaps your focus block "${block.title}" by ${overlap} min. Move it to ${fmtHHMM(newStart)}?`,
                  payload: {
                    eventId: event.id,
                    calendarId: 'primary',
                    summary: event.title,
                    newStart,
                    newEnd,
                    focusBlockTitle: block.title,
                  },
                });

                const messageText = `Focus block conflict detected.\n\n**${event.title}** (${fmtHHMM(event.start)}–${fmtHHMM(event.end)}) overlaps your focus block **"${block.title}"** by ${overlap} minutes. Move it to after your focus block?\n\n\`\`\`approval\n${approvalCard}\n\`\`\``;

                await Promise.all([
                  adminDb.collection('users').doc(uid).collection('conversations').add({
                    title: `Focus conflict — ${event.title}`,
                    createdAt: FieldValue.serverTimestamp(),
                    updatedAt: FieldValue.serverTimestamp(),
                    deleted: false,
                    briefing: true,
                    focusAlert: true,
                    read: false,
                    messages: [{ id: msgId(), role: 'assistant', content: messageText }],
                  }),
                  existingRef.set({ flaggedAt: FieldValue.serverTimestamp() }),
                  sendPushToUser(uid, 'Focus block conflict', `${event.title} overlaps your focus block`).catch(() => {}),
                ]);

                console.log(`[focus-protection] flagged conflict for ${uid}: ${event.title} vs ${block.title}`);
              }
            }
          } catch (e) {
            console.error(`[focus-protection] failed for ${uid}:`, e);
          }
        })());
      }

      await Promise.allSettled(checks);
      return { checked: checks.length };
    });
  },
);
