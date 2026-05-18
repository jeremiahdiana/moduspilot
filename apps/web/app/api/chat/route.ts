import { streamText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import type { CoreMessage } from 'ai';
import { MODUS_SYSTEM_PROMPT } from '@/lib/claude';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { queryMemory, upsertMemory } from '@/lib/pinecone';

const STYLE_INSTRUCTIONS: Record<string, string> = {
  normal:      'RESPONSE STYLE: Be extremely direct and blunt. No softening, no filler. Cut straight to the answer.',
  formal:      'RESPONSE STYLE: Adopt a strategic advisor tone. Big-picture thinking, sharp analysis, executive-level framing.',
  learning:    'RESPONSE STYLE: Act as a sharp coach. Push the user, hold them accountable, challenge assumptions. Don\'t let them off the hook.',
  explanatory: 'RESPONSE STYLE: Be warm and encouraging but stay honest. Supportive, not sycophantic.',
};

export async function POST(req: Request) {
  try {
    const key = process.env.GROQ_API_KEY;
    if (!key) {
      console.error('[chat] GROQ_API_KEY missing');
      return Response.json({ error: 'API key not configured' }, { status: 500 });
    }

    // Auth (optional — degrades gracefully for guests)
    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    let uid: string | null = null;
    if (token) {
      try {
        const decoded = await adminAuth.verifyIdToken(token);
        uid = decoded.uid;
      } catch {
        // Guest — no memory
      }
    }

    const body = await req.json() as { messages: CoreMessage[] };

    // Load user settings from Firestore
    let personalContext = '';
    let responseStyle = '';
    if (uid) {
      try {
        const userDoc = await adminDb.collection('users').doc(uid).get();
        const settings = userDoc.data()?.settings ?? {};
        personalContext = settings.personalContext ?? '';
        responseStyle = settings.responseStyle ?? '';
      } catch (e) {
        console.error('[chat] failed to load user settings:', e);
      }
    }

    // Find last user message for memory retrieval
    const lastUserMsg = [...body.messages].reverse().find(m => m.role === 'user');
    const queryText = typeof lastUserMsg?.content === 'string' ? lastUserMsg.content : '';

    // Query Pinecone for relevant memories
    let memoryContext = '';
    if (uid && queryText && process.env.PINECONE_API_KEY) {
      try {
        const matches = await queryMemory(uid, queryText, 6);
        const relevant = matches.filter(m => (m.score ?? 0) > 0.55);
        if (relevant.length > 0) {
          memoryContext = '\n\nRELEVANT MEMORY FROM PAST CONVERSATIONS:\n' +
            relevant.map(m => `- ${String(m.metadata?.text ?? '')}`).join('\n');
        }
      } catch (e) {
        console.error('[chat] memory query failed:', e);
      }
    }

    const groq = createOpenAI({
      baseURL: 'https://api.groq.com/openai/v1',
      apiKey: key,
    });

    // Build system prompt with user context always included
    const userContextBlock = personalContext
      ? `\n\nUSER CONTEXT (always keep this in mind):\n${personalContext}`
      : '';
    const styleBlock = responseStyle && STYLE_INSTRUCTIONS[responseStyle]
      ? `\n\n${STYLE_INSTRUCTIONS[responseStyle]}`
      : '';

    const fullSystemPrompt = MODUS_SYSTEM_PROMPT + userContextBlock + styleBlock + memoryContext;

    const result = streamText({
      model: groq('llama-3.3-70b-versatile'),
      system: fullSystemPrompt,
      messages: body.messages,
      maxTokens: 2048,
      onFinish: async ({ text }) => {
        if (!uid || !queryText || !process.env.PINECONE_API_KEY) return;
        try {
          await Promise.all([
            upsertMemory(uid, queryText, { type: 'user_message', ts: Date.now().toString() }),
            upsertMemory(uid, text, { type: 'assistant_response', ts: Date.now().toString() }),
          ]);
        } catch (e) {
          console.error('[chat] memory upsert failed:', e);
        }
      },
    });

    return result.toDataStreamResponse({
      getErrorMessage: (error) => {
        console.error('[chat] stream error:', error);
        return String(error);
      },
    });
  } catch (e) {
    console.error('[chat] route error:', e);
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
