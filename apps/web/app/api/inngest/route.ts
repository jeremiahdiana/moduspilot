import { serve } from 'inngest/next';
import { inngest } from '@/lib/inngest';
import { dailyCheckin } from '@/functions/inngest/daily-checkin';
import { memoryUpsert } from '@/functions/inngest/memory-upsert';
import { habitReminder } from '@/functions/inngest/habit-reminder';
import { endOfDayReflection } from '@/functions/inngest/end-of-day-reflection';
import { weeklyReview } from '@/functions/inngest/weekly-review';
import { meetingIntelligence } from '@/functions/inngest/meeting-intelligence';
import { contactTracker } from '@/functions/inngest/contact-tracker';
import { focusProtection } from '@/functions/inngest/focus-protection';
import { inboxTriage } from '@/functions/inngest/inbox-triage';

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [dailyCheckin, memoryUpsert, habitReminder, endOfDayReflection, weeklyReview, meetingIntelligence, contactTracker, focusProtection, inboxTriage],
});
