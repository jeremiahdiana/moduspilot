import { Pinecone } from '@pinecone-database/pinecone';

let _pc: Pinecone | null = null;

function pc(): Pinecone {
  if (!_pc) _pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY! });
  return _pc;
}

export const MEMORY_INDEX = 'modus-memory';

async function embedText(text: string, inputType: 'passage' | 'query'): Promise<number[]> {
  const result = await pc().inference.embed(
    'llama-text-embed-v2',
    [text],
    { input_type: inputType, truncate: 'END' }
  );
  const values = result.data?.[0]?.values;
  if (!values?.length) throw new Error('Pinecone embed returned no values');
  return values;
}

export async function upsertMemory(
  userId: string,
  text: string,
  metadata: Record<string, string> = {}
) {
  const embedding = await embedText(text, 'passage');
  await pc().index(MEMORY_INDEX).upsert([{
    id: `${userId}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    values: embedding,
    metadata: { userId, text, ...metadata },
  }]);
}

export async function queryMemory(userId: string, queryText: string, topK = 5) {
  const vector = await embedText(queryText, 'query');
  const result = await pc().index(MEMORY_INDEX).query({
    vector,
    topK,
    filter: { userId: { $eq: userId } },
    includeMetadata: true,
  });
  return result.matches ?? [];
}
