import { streamText, experimental_createMCPClient } from 'ai';
import type { CoreMessage } from 'ai';
import { MODUS_SYSTEM_PROMPT } from '@/lib/claude';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { upsertMemory } from '@/lib/pinecone';
import { getMcpServers } from '@/lib/mcp-servers';
import { assertPublicUrl } from '@/lib/ssrf';
import {
  enforceGuestRateLimit,
  enforceFreeTierLimit,
  enforcePaidTokenLimit,
  trackTokenUsage,
} from '@/lib/chat/limits';
import { resolveChatModel } from '@/lib/chat/model';
import {
  needsEmailCtx,
  needsCalendarCtx,
  isVagueQuery,
  queryMemoryContext,
  fetchGoogleData,
  fetchWebSearchBlock,
  fetchDriveBlock,
  fetchConnectorData,
  fetchProjectResources,
} from '@/lib/chat/context';
import {
  buildUserContextBlock,
  buildStyleBlock,
  buildSettingsBlock,
  buildGoalContextBlock,
  buildProjectContextBlock,
  buildGoogleDataBlock,
  type GoalContext,
  type ProjectContext,
} from '@/lib/chat/prompt';

export async function POST(req: Request) {
  try {
    const key = process.env.GROQ_API_KEY ?? '';
    if (!process.env.OPENAI_API_KEY && !key) {
      console.error('[chat] no AI API key configured');
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

    // Rate + usage limits (each returns a ready 4xx Response when blocked)
    if (!uid) {
      const blocked = await enforceGuestRateLimit(req);
      if (blocked) return blocked;
    } else {
      const freeBlocked = await enforceFreeTierLimit(uid, userData);
      if (freeBlocked) return freeBlocked;
      const paidBlocked = enforcePaidTokenLimit(userData);
      if (paidBlocked) return paidBlocked;
    }

    const body = await req.json() as {
      messages: CoreMessage[];
      personalContext?: string;
      responseStyle?: string;
      customStyle?: string;
      briefingHour?: number;
      briefingTimezone?: string;
      goalContext?: GoalContext;
      projectContext?: ProjectContext;
    };

    // Cap message history (last 20) and individual message length (8000 chars) to limit token costs
    const cappedMessages = body.messages
      .slice(-20)
      .map(msg => ({
        ...msg,
        content: typeof msg.content === 'string' ? msg.content.slice(0, 8000) : msg.content,
      })) as CoreMessage[];

    let personalContext = (body.personalContext ?? '').slice(0, 2000);
    let responseStyle = body.responseStyle ?? '';
    let customStyle = (body.customStyle ?? '').slice(0, 500);
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

    // Derive query text early so context detection can use it
    const lastUserMsg = [...cappedMessages].reverse().find(m => m.role === 'user');
    const queryText = typeof lastUserMsg?.content === 'string' ? lastUserMsg.content : '';

    const wantsEmail    = needsEmailCtx(queryText)    || isVagueQuery(queryText);
    const wantsCalendar = needsCalendarCtx(queryText) || isVagueQuery(queryText);

    // Start Pinecone early — runs in parallel with the other context fetches below
    const memoryPromise: Promise<string> =
      (uid && queryText && process.env.PINECONE_API_KEY)
        ? queryMemoryContext(uid, queryText)
        : Promise.resolve('');

    // Live Google data only when relevant to the query
    let gmailBlock = '';
    let calendarBlock = '';
    if (uid && (wantsEmail || wantsCalendar)) {
      ({ gmailBlock, calendarBlock } = await fetchGoogleData(uid, userData, { wantsEmail, wantsCalendar, briefingTimezone }));
    }

    // User capabilities (stored under settings.capabilities)
    const capabilities: Record<string, boolean> = uid ? {
      ...(userData.capabilities as Record<string, boolean> ?? {}),
      ...(userData.settings?.capabilities as Record<string, boolean> ?? {}),
    } : {};

    const webSearchBlock = await fetchWebSearchBlock(queryText, capabilities);
    const driveBlock = uid ? await fetchDriveBlock(uid, queryText) : '';

    // Collect Pinecone result (started in parallel above)
    const memoryContext = await memoryPromise;

    // Resolve model — BYOK keys take priority, then platform default (Groq)
    const chatModel = resolveChatModel(userData);

    // System prompt blocks
    const userContextBlock = buildUserContextBlock(personalContext);
    const styleBlock = buildStyleBlock(responseStyle, customStyle);
    const settingsBlock = buildSettingsBlock(briefingHour, briefingTimezone);
    const goalContextBlock = buildGoalContextBlock(body.goalContext);
    const projectContextBlock = buildProjectContextBlock(body.projectContext);
    const projectResourcesBlock = (body.projectContext && uid)
      ? await fetchProjectResources(uid, body.projectContext)
      : '';
    const googleDataBlock = buildGoogleDataBlock(gmailBlock, calendarBlock);

    // Connector status + live Notion / Slack / GitHub data
    let connectorBlock = '';
    let notionBlock = '';
    let slackBlock = '';
    let githubBlock = '';
    if (uid) {
      ({ connectorBlock, notionBlock, slackBlock, githubBlock } = await fetchConnectorData(uid, queryText));
    }

    const fullSystemPrompt = MODUS_SYSTEM_PROMPT + userContextBlock + styleBlock + settingsBlock + connectorBlock + memoryContext + goalContextBlock + projectContextBlock + projectResourcesBlock + googleDataBlock + notionBlock + slackBlock + githubBlock + webSearchBlock + driveBlock;

    // Load MCP tools from user's connected servers
    type McpClient = Awaited<ReturnType<typeof experimental_createMCPClient>>;
    const mcpClients: McpClient[] = [];
    let mcpTools: Record<string, unknown> = {};
    let mcpBlock = '';
    if (uid) {
      try {
        const mcpServers = await getMcpServers(uid);
        if (mcpServers.length > 0) {
          const results = await Promise.allSettled(
            mcpServers.map(server =>
              Promise.race([
                // Re-check at connection time: a stored URL could resolve to an
                // internal address now (DNS rebinding) even if it was public when added.
                assertPublicUrl(server.url).then(() =>
                  experimental_createMCPClient({
                    transport: {
                      type: 'sse',
                      url: server.url,
                      headers: server.authHeader ? { Authorization: server.authHeader } : undefined,
                    },
                  }),
                ),
                new Promise<never>((_, reject) =>
                  setTimeout(() => reject(new Error('timeout')), 4000)
                ),
              ])
            )
          );
          const toolNamesByServer: string[] = [];
          for (let i = 0; i < results.length; i++) {
            const result = results[i];
            if (result.status === 'fulfilled') {
              const client = result.value as McpClient;
              try {
                const tools = await client.tools();
                const names = Object.keys(tools);
                if (names.length > 0) {
                  mcpTools = { ...mcpTools, ...tools };
                  toolNamesByServer.push(`${mcpServers[i].name}: ${names.join(', ')}`);
                  mcpClients.push(client);
                }
              } catch {
                try { await client.close(); } catch {}
              }
            }
          }
          if (toolNamesByServer.length > 0) {
            mcpBlock = '\n\nMCP TOOLS AVAILABLE (use these when the user asks for actions your connected servers can perform):\n' +
              toolNamesByServer.join('\n');
          }
        }
      } catch (e) {
        console.error('[chat] MCP setup failed:', e);
      }
    }

    const result = streamText({
      model: chatModel,
      system: fullSystemPrompt + mcpBlock,
      messages: cappedMessages,
      maxTokens: 2048,
      ...(Object.keys(mcpTools).length > 0 ? { tools: mcpTools as Parameters<typeof streamText>[0]['tools'], maxSteps: 5 } : {}),
      onFinish: async ({ text, usage }) => {
        // Close MCP clients
        for (const client of mcpClients) {
          try { await client.close(); } catch {}
        }
        // Track tokens for paid users (fire-and-forget)
        if (uid && usage?.totalTokens) {
          trackTokenUsage(uid, userData, usage.totalTokens);
        }
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
        const s = String(error);
        console.error('[chat] stream error:', s);
        const sl = s.toLowerCase();
        // Normalize Groq/OpenAI rate limit errors → recognizable tokens for the client
        if (sl.includes('tokens per day') || sl.includes('tpd') || sl.includes('daily')) return 'groq_daily_limit';
        if (sl.includes('rate limit') || sl.includes('429') || sl.includes('too many')) return 'rate_limit_reached';
        if (sl.includes('401') || sl.includes('api key') || sl.includes('unauthorized')) return 'api_key_error';
        if (sl.includes('503') || sl.includes('502') || sl.includes('overloaded')) return 'provider_down';
        // Don't leak raw provider/internal error text to the client.
        return 'chat_error';
      },
    });
  } catch (e) {
    console.error('[chat] route error:', String(e));
    return Response.json({ error: 'Something went wrong' }, { status: 500 });
  }
}
