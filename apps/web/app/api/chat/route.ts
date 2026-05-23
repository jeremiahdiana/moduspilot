import { streamText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import type { CoreMessage, LanguageModel } from 'ai';
import { MODUS_SYSTEM_PROMPT } from '@/lib/claude';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { queryMemory, upsertMemory } from '@/lib/pinecone';
import { getValidAccessToken } from '@/lib/google-oauth';
import { getActionableThreads } from '@/lib/google-gmail';
import { getTodayEvents, fmtEventTime } from '@/lib/google-calendar';
import { webSearch, shouldWebSearch } from '@/lib/tavily';
import { searchDriveFiles, shouldSearchDrive, mimeLabel } from '@/lib/google-drive';

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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let userData: Record<string, any> = {};
    if (token) {
      try {
        const decoded = await adminAuth.verifyIdToken(token);
        uid = decoded.uid;
        const snap = await adminDb.collection('users').doc(uid).get();
        userData = snap.data() ?? {};
      } catch {
        // Guest — no memory
      }
    }

    // Daily message limit for free users (20 msg/day after 30-day trial)
    if (uid) {
      const plan = userData.plan as string | undefined;
      const isPaid = plan === 'modus' || plan === 'pilot';
      if (!isPaid) {
        let inTrial = false;
        try {
          const authUser = await adminAuth.getUser(uid);
          inTrial = Date.now() - new Date(authUser.metadata.creationTime).getTime() < 30 * 24 * 60 * 60 * 1000;
        } catch { /* treat as not in trial */ }

        if (!inTrial) {
          const todayStr = new Date().toISOString().slice(0, 10);
          const usageDate = (userData.usageDate as string) ?? '';
          const dailyMessages = (userData.dailyMessages as number) ?? 0;
          const count = usageDate === todayStr ? dailyMessages : 0;
          if (count >= 20) {
            return Response.json({ error: 'daily_limit_reached' }, { status: 429 });
          }
          // Increment counter (fire and forget)
          adminDb.collection('users').doc(uid).set(
            { dailyMessages: count + 1, usageDate: todayStr },
            { merge: true }
          ).catch(() => {});
        }
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
      const settings = userData.settings ?? {};
      personalContext = settings.personalContext ?? '';
      responseStyle = settings.responseStyle ?? '';
      customStyle = settings.customStyle ?? '';
      briefingHour = settings.briefingHour ?? 7;
      briefingTimezone = settings.briefingTimezone ?? 'UTC';
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
            gmailBlock = '\n\nINBOX (unread, last 48h — these are the only emails you have access to, never invent others):\n' +
              threads.map((t, i) =>
                `${i + 1}. From: ${t.from}\n   Subject: ${t.subject}\n   Body: ${t.body ? t.body.slice(0, 500) : t.snippet}`
              ).join('\n\n');
          } else {
            gmailBlock = '\n\nINBOX: No unread emails in the last 48 hours.';
          }
          const todayEvents = events.filter(e => !e.allDay);
          if (todayEvents.length > 0) {
            calendarBlock = "\n\nTODAY'S CALENDAR:\n" +
              todayEvents.map(e => `- ${fmtEventTime(e.start)}: ${e.title}`).join('\n');
          } else {
            calendarBlock = "\n\nTODAY'S CALENDAR: No events today.";
          }
        }
      } catch { /* non-fatal */ }
    }

    // Find last user message for memory retrieval
    const lastUserMsg = [...body.messages].reverse().find(m => m.role === 'user');
    const queryText = typeof lastUserMsg?.content === 'string' ? lastUserMsg.content : '';

    // Fetch user capabilities (stored under settings.capabilities)
    const capabilities: Record<string, boolean> = uid ? {
      ...(userData.capabilities as Record<string, boolean> ?? {}),
      ...(userData.settings?.capabilities as Record<string, boolean> ?? {}),
    } : {};

    // Web search (Tavily) — if capability enabled and query looks external
    let webSearchBlock = '';
    if (capabilities.webSearch && queryText && shouldWebSearch(queryText) && process.env.TAVILY_API_KEY) {
      try {
        const results = await webSearch(queryText, 5);
        if (results.length > 0) {
          webSearchBlock = '\n\nWEB SEARCH RESULTS (for this query — use these to answer, cite sources naturally):\n' +
            results.map((r, i) => `${i + 1}. ${r.title}\n   Source: ${r.url}\n   ${r.content.slice(0, 350)}`).join('\n\n');
        }
      } catch (e) {
        console.error('[chat] web search failed:', e);
      }
    }

    // Google Drive — search for relevant files if query mentions docs/files
    let driveBlock = '';
    if (uid && queryText && shouldSearchDrive(queryText)) {
      try {
        const googleToken = await getValidAccessToken(uid);
        if (googleToken) {
          const files = await searchDriveFiles(googleToken, queryText, 5);
          if (files.length > 0) {
            driveBlock = '\n\nGOOGLE DRIVE FILES (matching this query):\n' +
              files.map(f => `- ${mimeLabel(f.mimeType)}: ${f.name} — ${f.webViewLink} (modified ${f.modifiedTime.slice(0, 10)})`).join('\n');
          }
        }
      } catch { /* non-fatal */ }
    }

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

    // Resolve model — user's BYOK preference or fall back to Groq
    let chatModel: LanguageModel;
    const ms = userData.modelSettings as { provider?: string; model?: string; openaiKey?: string; anthropicKey?: string } | undefined;
    const modelProvider = ms?.provider ?? 'groq';
    const modelId = ms?.model ?? 'llama-3.3-70b-versatile';

    if (modelProvider === 'openai' && ms?.openaiKey) {
      chatModel = createOpenAI({ apiKey: ms.openaiKey })(modelId);
    } else if (modelProvider === 'anthropic' && ms?.anthropicKey) {
      chatModel = createAnthropic({ apiKey: ms.anthropicKey })(modelId);
    } else {
      chatModel = createOpenAI({ baseURL: 'https://api.groq.com/openai/v1', apiKey: key })(modelId === 'llama-3.3-70b-versatile' || !ms?.model ? 'llama-3.3-70b-versatile' : modelId);
    }

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

    const fullSystemPrompt = MODUS_SYSTEM_PROMPT + userContextBlock + styleBlock + settingsBlock + memoryContext + goalContextBlock + googleDataBlock + webSearchBlock + driveBlock;

    const result = streamText({
      model: chatModel,
      system: fullSystemPrompt,
      messages: body.messages,
      maxTokens: 2048,
      onFinish: async ({ text }) => {
        if (!uid || !queryText || !process.env.PINECONE_API_KEY) return;
        const isSubstantive = (s: string) => s.trim().length >= 40 && s.trim().split(/\s+/).length >= 6;
        try {
          await Promise.all([
            isSubstantive(queryText) ? upsertMemory(uid, queryText, { type: 'user_message', ts: Date.now().toString() }) : Promise.resolve(),
            isSubstantive(text) ? upsertMemory(uid, text, { type: 'assistant_response', ts: Date.now().toString() }) : Promise.resolve(),
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
