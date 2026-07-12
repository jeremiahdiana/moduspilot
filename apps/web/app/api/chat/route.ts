import { streamText, experimental_createMCPClient } from 'ai';
import type { CoreMessage } from 'ai';
import { MODUS_SYSTEM_PROMPT, looksLikePromptExtraction, PROMPT_EXTRACTION_REMINDER } from '@/lib/claude';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { upsertMemory } from '@/lib/pinecone';
import { extractDurableMemory } from '@/lib/chat/memory';
import { getMcpServers } from '@/lib/mcp-servers';
import { connectMcpClient } from '@/lib/mcp-client';
import { assertPublicUrl } from '@/lib/ssrf';
import {
  enforceGuestRateLimit,
  enforceSubscriptionGate,
  enforcePaidTokenLimit,
  trackTokenUsage,
} from '@/lib/chat/limits';
import { resolveChatModel } from '@/lib/chat/model';
import { routeTask } from '@/lib/chat/auto-route';
import { isModelUnlocked } from '@/lib/models';
import {
  needsEmailCtx,
  needsCalendarCtx,
  needsNotesCtx,
  needsMessagesCtx,
  needsContactsCtx,
  isVagueQuery,
  queryMemoryContext,
  fetchGoogleData,
  fetchWebSearchBlock,
  fetchDriveBlock,
  fetchConnectorData,
  fetchProjectResources,
  fetchContactsBlock,
  fetchContactEmailMap,
  fetchNotesBlock,
  fetchMessagesBlock,
} from '@/lib/chat/context';
import { fetchGroupAvailabilityBlock } from '@/lib/chat/group-context';
import {
  buildUserContextBlock,
  buildStyleBlock,
  buildSettingsBlock,
  buildGoalContextBlock,
  buildProjectContextBlock,
  buildTaskContextBlock,
  buildGoogleDataBlock,
  buildModelCatalogBlock,
  type GoalContext,
  type ProjectContext,
  type TaskContext,
} from '@/lib/chat/prompt';

// This route streams LLM output and does Firebase-admin/crypto work → Node
// runtime, not Edge. Without an explicit maxDuration, Vercel applies a short
// default and KILLS the function mid-stream on slower premium/reasoning models —
// which the user experiences as the chat freezing with no answer. 60s is the
// safe ceiling across Vercel tiers.
export const runtime = 'nodejs';
export const maxDuration = 60;

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
      const gateBlocked = await enforceSubscriptionGate(uid, userData);
      if (gateBlocked) return gateBlocked;
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
      taskContext?: TaskContext;
      // In-chat model switcher: 'auto' (MODUS picks per task), a specific model
      // id, or undefined/'default' (use the saved Brain setting).
      modelChoice?: string;
      // Per-message "+" menu: force a web search for this message, and any files
      // the user attached (PDF text extracted server-side, text files read client-side).
      webSearch?: boolean;
      attachments?: { name: string; text: string }[];
    };

    // Validate payload before touching any model. A malformed/empty history is a
    // client bug or a truncated request — return a clean 400 the UI can surface,
    // never a 500 or an empty stream that looks like a silent drop.
    if (!Array.isArray(body.messages) || body.messages.length === 0) {
      return Response.json({ error: 'invalid_request' }, { status: 400 });
    }

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

    // Derive query text early so context detection can use it. For image
    // messages the content is an array of parts — pull the text out of it.
    const lastUserMsg = [...cappedMessages].reverse().find(m => m.role === 'user');
    const queryText = typeof lastUserMsg?.content === 'string'
      ? lastUserMsg.content
      : Array.isArray(lastUserMsg?.content)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ? (lastUserMsg!.content as any[]).filter(p => p?.type === 'text').map(p => p.text).join(' ')
        : '';

    // Any image parts in the conversation → we need a vision-capable model.
    const hasImage = cappedMessages.some(m =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      Array.isArray(m.content) && (m.content as any[]).some(p => p?.type === 'image'),
    );

    const wantsEmail    = needsEmailCtx(queryText)    || isVagueQuery(queryText);
    const wantsCalendar = needsCalendarCtx(queryText) || isVagueQuery(queryText);
    const wantsNotes    = needsNotesCtx(queryText)    || isVagueQuery(queryText);
    // No isVagueQuery fallback — this is other people's private correspondence,
    // not just the user's own content, so only surface it on explicit intent.
    const wantsMessages = needsMessagesCtx(queryText);
    // Contacts are broadly useful for people/vague queries but were previously
    // injected on EVERY message — gate them so unrelated queries don't pay the cost.
    const wantsContacts = needsContactsCtx(queryText) || isVagueQuery(queryText);

    // Start Pinecone early — runs in parallel with the other context fetches below
    const memoryPromise: Promise<string> =
      (uid && queryText && process.env.PINECONE_API_KEY)
        ? queryMemoryContext(uid, queryText)
        : Promise.resolve('');

    // Live Google data only when relevant to the query
    let gmailBlock = '';
    let calendarBlock = '';
    if (uid && (wantsEmail || wantsCalendar)) {
      const contactsEnabled = userData.settings?.deviceAccess?.contacts !== false;
      // Build contact map first (~50ms Firestore read) so Gmail threads can be annotated with known contact names.
      // This is sequential by necessity but adds negligible time vs the Gmail API which takes up to 5s.
      const contactEmailMap = contactsEnabled ? await fetchContactEmailMap(uid) : new Map();
      ({ gmailBlock, calendarBlock } = await fetchGoogleData(uid, userData, { wantsEmail, wantsCalendar, briefingTimezone, contactEmailMap }));
    }

    // User capabilities (stored under settings.capabilities)
    const capabilities: Record<string, boolean> = uid ? {
      ...(userData.capabilities as Record<string, boolean> ?? {}),
      ...(userData.settings?.capabilities as Record<string, boolean> ?? {}),
    } : {};

    // Model selection for this message. 'auto' → MODUS classifies the task and
    // picks the best unlocked model (and turns web search on for research);
    // a specific id → use it (gated by plan in resolveChatModel); else the saved
    // Brain setting. Only paid/grandfathered users reach here past the gate, but
    // resolveChatModel still falls back to Llama if a model isn't unlocked.
    const modelChoice = body.modelChoice;
    let forcedModelId: string | undefined;
    // The "+" menu web-search toggle forces it for this message; Auto-routing can also.
    let forceWebSearch = body.webSearch === true;
    if (uid && queryText) {
      // Saved Brain: 'auto' means MODUS routes per task. Used when the composer
      // sends no explicit per-message choice (or sends 'default').
      const savedModel = userData.settings?.modelSettings as { provider?: string; model?: string } | undefined;
      const savedIsPlatform = !savedModel?.provider || savedModel.provider === 'platform';
      const wantsAuto = modelChoice === 'auto'
        || ((!modelChoice || modelChoice === 'default') && savedIsPlatform && savedModel?.model === 'auto');

      if (wantsAuto) {
        const routed = await routeTask(queryText, userData.plan);
        forcedModelId = routed.modelId;
        forceWebSearch = routed.webSearch;
      } else if (modelChoice && modelChoice !== 'default' && isModelUnlocked(modelChoice, userData.plan)) {
        forcedModelId = modelChoice;
      }
    }

    const searchCapabilities = forceWebSearch ? { ...capabilities, webSearch: true } : capabilities;
    const webSearchBlock = await fetchWebSearchBlock(queryText, searchCapabilities);
    const driveBlock = uid ? await fetchDriveBlock(uid, queryText) : '';
    // Agent-to-agent: when the user asks about a groupmate's availability, pull
    // the busy windows of members who opted to share their calendar.
    const groupBlock = uid ? await fetchGroupAvailabilityBlock(uid, queryText, briefingTimezone) : '';

    // Collect Pinecone result (started in parallel above)
    const memoryContext = await memoryPromise;

    // Resolve model — an in-chat/Auto override wins for this message, else BYOK
    // keys, then the platform default (Groq). hasImage forces a vision model.
    const resolved = resolveChatModel(userData, { hasImage, modelId: forcedModelId });
    const chatModel = resolved.model;
    if (resolved.downgraded) {
      // Loud + alertable: a premium model was requested but we served Llama
      // (missing provider key or plan gate). Previously silent — a rotated/removed
      // key would drop every paid user to Llama with no signal anywhere.
      console.error(`[chat] MODEL DOWNGRADE: requested ${resolved.requestedId} → served ${resolved.modelId} (missing provider key or plan gate) uid=${uid ?? 'guest'}`);
    }

    // System prompt blocks
    const userContextBlock = buildUserContextBlock(personalContext);
    const styleBlock = buildStyleBlock(responseStyle, customStyle);
    const settingsBlock = buildSettingsBlock(briefingHour, briefingTimezone);
    const goalContextBlock = buildGoalContextBlock(body.goalContext);
    const projectContextBlock = buildProjectContextBlock(body.projectContext);
    const taskContextBlock = buildTaskContextBlock(body.taskContext);
    const projectResourcesBlock = (body.projectContext && uid)
      ? await fetchProjectResources(uid, body.projectContext)
      : '';
    const googleDataBlock = buildGoogleDataBlock(gmailBlock, calendarBlock);
    const modelCatalogBlock = buildModelCatalogBlock(userData.plan);

    // Connector status + live Notion / Slack / GitHub data
    let connectorBlock = '';
    let notionBlock = '';
    let slackBlock = '';
    let githubBlock = '';
    let contactsBlock = '';
    let notesBlock = '';
    let messagesBlock = '';
    if (uid) {
      [{ connectorBlock, notionBlock, slackBlock, githubBlock }, contactsBlock, notesBlock, messagesBlock] = await Promise.all([
        fetchConnectorData(uid, queryText),
        fetchContactsBlock(uid, wantsContacts && userData.settings?.deviceAccess?.contacts !== false),
        fetchNotesBlock(uid, wantsNotes && capabilities.notesSync !== false),
        // Opt-in only — defaults to OFF, unlike notesSync, since this surfaces
        // other people's private messages, not just the user's own content.
        fetchMessagesBlock(uid, wantsMessages && capabilities.messagesSync === true),
      ]);
    }

    // Files the user attached via the composer "+" menu — treat as primary context.
    const attachmentsBlock = (body.attachments && body.attachments.length)
      ? '\n\nATTACHED FILES (the user attached these to their latest message — use them as primary context for their question; cite by file name):\n' +
        body.attachments.map(a => `\n--- ${a.name} ---\n${(a.text ?? '').slice(0, 24000)}`).join('\n') + '\n'
      : '';

    const fullSystemPrompt = MODUS_SYSTEM_PROMPT + userContextBlock + styleBlock + settingsBlock + modelCatalogBlock + connectorBlock + contactsBlock + notesBlock + messagesBlock + memoryContext + goalContextBlock + projectContextBlock + taskContextBlock + projectResourcesBlock + googleDataBlock + notionBlock + slackBlock + githubBlock + webSearchBlock + driveBlock + groupBlock + attachmentsBlock;

    // Load MCP tools from user's connected servers
    type McpClient = Awaited<ReturnType<typeof experimental_createMCPClient>>;
    const mcpClients: McpClient[] = [];
    let mcpTools: Record<string, unknown> = {};
    let mcpBlock = '';
    if (uid) {
      try {
        const mcpServers = await getMcpServers(uid);
        if (mcpServers.length > 0) {
          // Reject a promise after `ms` without leaving the underlying work
          // uncancelled leaking. Used to bound both connect and tools() so a slow
          // plugin can never stall the whole chat.
          const withTimeout = <T>(p: Promise<T>, ms: number, label: string): Promise<T> =>
            Promise.race([
              p,
              new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`${label} timeout`)), ms)),
            ]);

          const connections = await Promise.allSettled(
            mcpServers.map(async (server) => {
              // Re-check at connection time: a stored URL could resolve to an
              // internal address now (DNS rebinding) even if it was public when added.
              await assertPublicUrl(server.url);
              const connectP = connectMcpClient({ url: server.url, authHeader: server.authHeader, transport: server.transport });
              let gaveUp = false;
              // If the socket opens AFTER we already timed out, close it so the
              // connection never leaks (the previous Promise.race dropped it).
              connectP.then(c => { if (gaveUp) c.close().catch(() => {}); }).catch(() => {});
              const client = await Promise.race([
                connectP,
                new Promise<never>((_, reject) => setTimeout(() => { gaveUp = true; reject(new Error('connect timeout')); }, 4000)),
              ]) as McpClient;
              return { server, client };
            })
          );

          const toolNamesByServer: string[] = [];
          for (const conn of connections) {
            if (conn.status !== 'fulfilled') {
              // Log instead of swallowing — a plugin that stopped working should
              // be visible in logs, not silently dropped from the toolset.
              console.error('[chat] MCP connect failed:', String((conn as PromiseRejectedResult).reason));
              continue;
            }
            const { server, client } = conn.value;
            try {
              const tools = await withTimeout(client.tools(), 4000, 'tools');
              const names = Object.keys(tools);
              if (names.length > 0) {
                mcpTools = { ...mcpTools, ...tools };
                toolNamesByServer.push(`${server.name}: ${names.join(', ')}`);
                mcpClients.push(client);
              } else {
                try { await client.close(); } catch {}
              }
            } catch (e) {
              console.error(`[chat] MCP tools() failed for ${server.name}:`, String(e));
              try { await client.close(); } catch {}
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

    // Layer 2: if the latest message looks like a prompt-extraction / override
    // attempt, reinforce the refusal for this turn (the prompt's confidentiality
    // section is layer one).
    const extractionGuard = looksLikePromptExtraction(queryText) ? PROMPT_EXTRACTION_REMINDER : '';

    // OpenAI o-series reasoning models (o4-mini, o1, o3) spend hidden reasoning
    // tokens that count against max_completion_tokens. A flat 2048 cap gets
    // entirely consumed by reasoning → the model returns finishReason:'length'
    // with EMPTY visible text → blank message bubble (200, no error). Give
    // reasoning models enough headroom to reason AND still emit an answer.
    const isReasoningModel = /^o\d/.test(resolved.modelId);
    const maxTokens = isReasoningModel ? 8000 : 2048;

    const result = streamText({
      model: chatModel,
      system: fullSystemPrompt + mcpBlock + extractionGuard,
      messages: cappedMessages,
      maxTokens,
      ...(Object.keys(mcpTools).length > 0 ? { tools: mcpTools as Parameters<typeof streamText>[0]['tools'], maxSteps: 5 } : {}),
      onError: async ({ error }) => {
        // onFinish does NOT fire when the stream errors, so without this the MCP
        // sockets opened above would leak on every failed request. Also surfaces
        // the raw provider error to logs (getErrorMessage below only sends the
        // client a sanitized token).
        console.error('[chat] streamText onError:', String(error));
        for (const client of mcpClients) {
          try { await client.close(); } catch {}
        }
      },
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
        // Respect the user's "generate memory from chat" setting (was ignored).
        if (userData?.settings?.generateMemoryFromChat === false) return;
        try {
          // Only persist a durable fact about the user — not the raw exchange.
          const fact = await extractDurableMemory(queryText, text);
          if (fact) {
            await upsertMemory(uid, fact, { type: 'extracted_fact', ts: Date.now().toString() });
          }
        } catch (e) {
          console.error('[chat] memory upsert failed:', e);
        }
      },
    });

    return result.toDataStreamResponse({
      headers: {
        // Honest labeling: what actually answered this message, so the client can
        // show a notice when a premium pick was downgraded to the free default.
        'x-modus-model': resolved.modelId,
        ...(resolved.downgraded
          ? { 'x-modus-downgraded': '1', 'x-modus-requested-model': resolved.requestedId ?? '' }
          : {}),
      },
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
