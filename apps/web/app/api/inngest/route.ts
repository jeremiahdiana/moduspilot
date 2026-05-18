import { serve } from 'inngest/next';
import { inngest } from '@/lib/inngest';
import { dailyCheckin } from '@/functions/inngest/daily-checkin';
import { memoryUpsert } from '@/functions/inngest/memory-upsert';
import { habitReminder } from '@/functions/inngest/habit-reminder';

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [dailyCheckin, memoryUpsert, habitReminder],
});
