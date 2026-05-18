import { inngest } from '@/lib/inngest';

export const dailyCheckin = inngest.createFunction(
  { id: 'daily-checkin' },
  { cron: '0 8 * * *' },
  async ({ step }) => {
    await step.run('log', async () => {
      console.log('Daily check-in triggered at', new Date().toISOString());
    });
  },
);
