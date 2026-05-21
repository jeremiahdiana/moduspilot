import { streamText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import type { CoreMessage } from 'ai';
import { MODUS_SYSTEM_PROMPT } from '@/lib/claude';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { queryMemory, upsertMemory } from '@/lib/pinecone';
import { getValidAccessToken } from '@/lib/google-oauth';
import { getActionableThreads } from '@/lib/google-gmail';
import { getTodayEvents, fmtEventTime } from '@/lib/google-calendar';

const STYLE_INSTRUCTIONS: Record<string, string> = {
  normal:      'RESPONSE STYLE: Be extremely direct and blunt. No softening, no filler. Cut straight to the answer.',
  concise:     'RESPONSE STYLE: Ultra-short responses only. One to three sentences max. No explanations unless explicitly asked.',
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

    const body = await req.json() as {
      messages: CoreMessage[];
      personalContext?: string;
      responseStyle?: string;
      customStyle?: string;
      briefingHour?: number;
      briefingTimezone?: string;
      goalContext?: { id: string; title: string; description?: string; progress: number; timeframe?: string; activeChatId?: string };
    };

    let personalContext = body.personalContext ?? '';
    let responseStyle = body.responseStyle ?? '';
    let customStyle = body.customStyle ?? '';
    let briefingHour = body.briefingHour ?? 7;
    let briefingTimezone = body.briefingTimezone ?? 'UTC';

    if (uid && (!personalContext && !responseStyle)) {
      try {
        const userDoc = await adminDb.collection('users').doc(uid).get();
        const settings = userDoc.data()?.settings ?? {};
        personalContext = settings.personalContext ?? '';
        responseStyle = settings.responseStyle ?? '';
        customStyle = settings.customStyle ?? '';
        briefingHour = settings.briefingHour ?? 7;
        briefingTimezone = settings.briefingTimezone ?? 'UTC';
      } catch (e) {
        console.error('[chat] failed to load user settings from admin:', e);
      }
    }

    // Fetch live Google data if connected
    let gmailBlock = '';
    let calendarBlock = '';
    if (uid) {
      try {
        const googleToken = await getValidAccessToken(uid);
        if (googleToken) {
          const [threads, events] = await Promise.all([
            getActionableThreads(googleToken),
            getTodayEvents(googleToken),
          ]);
          if (threads.length > 0) {
            gmailBlock = '\n\nREAL INBOX (unread, last 48h — these are the ONLY real emails you know about, never invent others):\n' +
              threads.map((t, i) =>
                `${i + 1}. From: ${t.from}\n   Subject: ${t.subject}\n   Preview: ${t.snippet}`
              ).join('\n');
          } else {
            gmailBlock = '\n\nREAL INBOX: No unread emails in the last 48 hours.';
          }
          const todayEvents = events.filter(e => !e.allDay);
          if (todayEvents.length > 0) {
            calendarBlock = "\n\nTODAY'S REAL CALENDAR:\n" +
              todayEvents.map(e => `- ${fmtEventTime(e.start)}: ${e.title}`).join('\n');
          } else {
            calendarBlock = "\n\nTODAY'S REAL CALENDAR: No events today.";
          }
        }
      } catch { /* non-fatal */ }
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

    let styleBlock = '';
    if (responseStyle === 'custom' && customStyle) {
      styleBlock = `\n\nRESPONSE STYLE: ${customStyle}`;
    } else if (responseStyle && STYLE_INSTRUCTIONS[responseStyle]) {
      styleBlock = `\n\n${STYLE_INSTRUCTIONS[responseStyle]}`;
    }

    // Format briefing time in user's local timezone for display
    let briefingTimeDisplay = '7:00 AM UTC';
    try {
      const d = new Date();
      d.setUTCHours(briefingHour, 0, 0, 0);
      briefingTimeDisplay = d.toLocaleTimeString('en-US', {
        timeZone: briefingTimezone,
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
        timeZoneName: 'short',
      });
    } catch { /* use default */ }

    const settingsBlock = `\n\nUSER SETTINGS:\n- Daily briefing: ${briefingTimeDisplay} (change via Settings → General or ask me to update it)`;

    const gc = body.goalContext;
    const isMainChat = !gc?.activeChatId || gc.activeChatId === `goal-${gc?.id}`;
    const goalContextBlock = gc
      ? `\n\nGOAL FOCUS: This conversation is dedicated to one specific goal: "${gc.title}" (goalId: "${gc.id}"). Current progress: ${gc.progress}%. Timeframe: ${gc.timeframe ?? 'not set'}. ${gc.description ? `Description: ${gc.description}.` : ''}\n\nThe user is currently in chat "${gc.activeChatId ?? `goal-${gc.id}`}".\n\nStay laser-focused on this goal. Ask targeted check-in questions about progress, blockers, and next moves. Only propose an update_goal approval card when the user explicitly states a new progress percentage or says they've finished a major milestone — include goalId: "${gc.id}" in the payload.\n\nIf the user asks to "add a new chat", "open a new chat", or "start a new conversation" on this goal, output a create_goal_chat approval card: title = a short descriptive name for the new chat, payload = { goalId: "${gc.id}" }.\n\n${!isMainChat ? `If the user asks to "delete this chat", "remove this chat", or similar, output a delete_goal_chat approval card: title = a short description, payload = { goalId: "${gc.id}", conversationId: "${gc.activeChatId}" }. Do NOT offer or generate delete_goal_chat for the main chat.` : 'The user is in the main chat — do NOT generate a delete_goal_chat card here.'}\n\nCRITICAL: Do NOT generate create_task, create_habit, create_goal, or any other approval card in this chat unless the user explicitly and clearly says they want to create something new. Casual messages or questions must NEVER be interpreted as requests to create items. Respond to those conversationally.`
      : '';

    const googleDataBlock = gmailBlock || calendarBlock
      ? `${gmailBlock}${calendarBlock}\n\nCRITICAL: Never invent, guess, or fabricate email senders, subjects, content, or calendar events. Only reference what is listed above. If asked about an email or event not in the list, say you don't see it.`
      : '';

    const fullSystemPrompt = MODUS_SYSTEM_PROMPT + userContextBlock + styleBlock + settingsBlock + memoryContext + goalContextBlock + googleDataBlock;

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
