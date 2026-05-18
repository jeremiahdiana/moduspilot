import { inngest } from '@/lib/inngest';
import { upsertMemory } from '@/lib/pinecone';

export const memoryUpsert = inngest.createFunction(
  { id: 'memory-upsert' },
  { event: 'modus/memory.upsert' },
  async ({ event, step }) => {
    const { userId, text, metadata } = event.data;
    await step.run('upsert-to-pinecone', () =>
      upsertMemory(userId, text, metadata)
    );
  },
);
