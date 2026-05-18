import { inngest } from '@/lib/inngest';

export const habitReminder = inngest.createFunction(
  { id: 'habit-reminder' },
  { event: 'modus/habit.reminder' },
  async ({ event, step }) => {
    const { userId, habitName } = event.data;
    await step.run('send-reminder', async () => {
      console.log(`Reminder for ${userId}: ${habitName}`);
    });
  },
);
