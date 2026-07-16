import { streamText, experimental_createMCPClient, StreamData } from 'ai';
import type { CoreMessage } from 'ai';
import { MODUS_SYSTEM_PROMPT, looksLikePromptExtraction, PROMPT_EXTRACTION_REMINDER, PROJECT_CHAT_RULES } from '@/lib/claude';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { upsertMemory } from '@/lib/pinecone';
import { extractDurableMemory } from '@/lib/chat/memory';
import { getMcpServers } from '@/lib/mcp-servers';
import { connectMcpClient } from '@/lib/mcp-client';
import { assertPublicUrl } from '@/lib/ssrf';
import {
  enforceSubscriptionGate,
  enforcePaidTokenLimit,
  trackTokenUsage,
} from '@/lib/chat/limits';
import { resolveChatModel, LLAMA_FALLBACK, chatFallbackChain, createFallbackModel, isPremiumModel } from '@/lib/chat/model';
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

    // Auth is REQUIRED — MODUS is accounts-only. A missing or invalid/expired
    // token leaves uid null, which is rejected with a 401 just below.
    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    let uid: string | null = null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let userData: Record<string, any> = {};
    // Body parsing is independent of auth, so read it concurrently rather than
    // after. The user-doc read still waits on verifyIdToken — it needs the uid,
    // and it gates the paywall, so it must be a real read of real identity.
    const bodyPromise = req.json().catch(() => null);
    if (token) {
      try {
        const decoded = await adminAuth.verifyIdToken(token);
        uid = decoded.uid;
        const snap = await adminDb.collection('users').doc(uid).get();
        userData = snap.data() ?? {};
      } catch {
        // Invalid/expired token → treated as unauthenticated (401 below).
      }
    }

    // MODUS is accounts-only — there is no guest/anonymous access. Reject any
    // request without a valid signed-in user (missing OR invalid/expired token).
    if (!uid) {
      return Response.json({ error: 'authentication_required' }, { status: 401 });
    }

    // Rate + usage limits (each returns a ready 4xx Response when blocked)
    const gateBlocked = await enforceSubscriptionGate(uid, userData);
    if (gateBlocked) return gateBlocked;
    const paidBlocked = enforcePaidTokenLimit(userData);
    if (paidBlocked) return paidBlocked;

    const body = await bodyPromise as {
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
      // The model Auto picked for the PREVIOUS turn. Lets a short follow-up
      // ("make it shorter") stay on the model that wrote the thing it refers to.
      lastRoutedModel?: string;
      // Per-message "+" menu: force a web search for this message, and any files
      // the user attached (PDF text extracted server-side, text files read client-side).
      webSearch?: boolean;
      attachments?: { name: string; text: string }[];
    };

    // req.json() rejects on a malformed body; bodyPromise swallows that into null.
    if (!body) {
      return Response.json({ error: 'invalid_request' }, { status: 400 });
    }

    // Validate payload before touching any model. A malformed/empty history is a
    // client bug or a truncated request — return a clean 400 the UI can surface,
    // never a 500 or an empty stream that looks like a silent drop.
    if (!Array.isArray(body.messages) || body.messages.length === 0) {
      return Response.json({ error: 'invalid_request' }, { status: 400 });
    }

    // Cap history by TOTAL size, walking backwards from the newest message.
    // The old cap was per-message (20 × 8000 chars), which bounded nothing in
    // practice: a long chat could ship ~160k chars (~40k tokens) of history on
    // every single turn. Keep the newest turns whole and stop at the budget.
    const HISTORY_CHAR_BUDGET = 24_000;
    const MAX_HISTORY_MESSAGES = 20;
    const recent = body.messages.slice(-MAX_HISTORY_MESSAGES);
    const kept: CoreMessage[] = [];
    let historyChars = 0;
    for (let i = recent.length - 1; i >= 0; i--) {
      const msg = recent[i];
      // Spread only in the string branch — spreading across the whole CoreMessage
      // union widens `content` and breaks the per-role discrimination.
      const trimmed: CoreMessage = typeof msg.content === 'string'
        ? ({ ...msg, content: msg.content.slice(0, 8000) } as CoreMessage)
        : msg;
      const size = typeof trimmed.content === 'string'
        ? trimmed.content.length
        : JSON.stringify(trimmed.content).length;
      // Always keep the newest message even if it alone blows the budget —
      // dropping the thing the user just asked would be worse than the cost.
      if (kept.length > 0 && historyChars + size > HISTORY_CHAR_BUDGET) break;
      historyChars += size;
      kept.unshift(trimmed);
    }
    let cappedMessages = kept;

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

    // Auto routing depends only on the query text, never on the fetched context —
    // but it used to be awaited AFTER the Gmail/Calendar fetch, so a context-heavy
    // turn paid Google's 5s cap and the classifier's back to back. Start it here
    // and collect it below; it now overlaps the context fetch instead.
    // (Same trick as memoryPromise above.)
    const savedModelSetting = userData.settings?.modelSettings as { provider?: string; model?: string } | undefined;
    const savedIsPlatformModel = !savedModelSetting?.provider || savedModelSetting.provider === 'platform';
    const wantsAutoRoute = !!uid && !!queryText && (
      body.modelChoice === 'auto'
      || ((!body.modelChoice || body.modelChoice === 'default') && savedIsPlatformModel && savedModelSetting?.model === 'auto')
    );
    const routePromise = wantsAutoRoute
      ? routeTask(queryText, userData.plan)
      : null;

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
    // Whether MODUS auto-picked the model for this message (composer on "Auto").
    // Surfaced to the client (x-modus-auto header) so it can show a
    // "MODUS routed this to <model>" chip above the answer.
    let wasAutoRouted = false;
    // The "+" menu web-search toggle forces it for this message; Auto-routing can also.
    let forceWebSearch = body.webSearch === true;
    if (uid && queryText) {
      // Saved Brain: 'auto' means MODUS routes per task. Used when the composer
      // sends no explicit per-message choice (or sends 'default').
      // wantsAutoRoute + routePromise were resolved before the context fetch above.
      if (routePromise) {
        wasAutoRouted = true;
        const routed = await routePromise;
        forcedModelId = routed.modelId;
        forceWebSearch = routed.webSearch;

        // Sticky Auto. The router only ever sees the LATEST message, so a short
        // follow-up like "make it shorter" or "try again" classifies as 'general'
        // → Llama, and Llama rewrites the code Claude just wrote. When the
        // follow-up carries no task signal of its own, stay on the model that
        // produced the thing it refers to.
        const last = body.lastRoutedModel;
        const isShortFollowUp = queryText.trim().split(/\s+/).length < 6;
        if (
          routed.category === 'general' &&
          isShortFollowUp &&
          cappedMessages.length > 1 &&
          last && last !== forcedModelId && isModelUnlocked(last, userData.plan)
        ) {
          console.log(`[route] sticky: follow-up stays on ${last} (router said general)`);
          forcedModelId = last;
        }
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
    let resolved = resolveChatModel(userData, { hasImage, modelId: forcedModelId });
    let chatModel = resolved.model;
    // The model the USER was promised: their explicit pick, Auto's announced
    // choice, or their saved Brain. Snapshotted HERE, before the size guard below,
    // which swaps Llama→Terra on MODUS's own initiative for large requests. That
    // swap is not a promise to the user, so if the chain later fails away from it
    // we must not report "GPT-5.6 Terra was unavailable" to someone who picked the
    // free default and never heard of Terra.
    const promisedModelId = resolved.modelId;
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
    // Budgeted in TOTAL, not per-file: the per-file 24k cap left the file COUNT
    // unbounded, so 10 attachments meant ~60k tokens on one request.
    const ATTACHMENT_CHAR_BUDGET = 48_000;
    const MAX_ATTACHMENTS = 10;
    let attachmentsBlock = '';
    if (body.attachments && body.attachments.length) {
      const parts: string[] = [];
      let used = 0;
      for (const a of body.attachments.slice(0, MAX_ATTACHMENTS)) {
        if (used >= ATTACHMENT_CHAR_BUDGET) break;
        const text = (a.text ?? '').slice(0, Math.min(24_000, ATTACHMENT_CHAR_BUDGET - used));
        used += text.length;
        parts.push(`\n--- ${a.name} ---\n${text}`);
      }
      if (parts.length > 0) {
        attachmentsBlock = '\n\nATTACHED FILES (the user attached these to their latest message — use them as primary context for their question; cite by file name):\n' +
          parts.join('\n') + '\n';
      }
      if (parts.length < body.attachments.length) {
        console.log(`[chat] attachments truncated: ${parts.length}/${body.attachments.length} included (${used} chars)`);
      }
    }

    // Project-chat rules only apply when a project is actually in scope; they
    // were previously in MODUS_SYSTEM_PROMPT, costing every other message ~210
    // tokens of instructions about blocks that weren't present.
    const projectRules = body.projectContext ? PROJECT_CHAT_RULES : '';

    // Split for Anthropic prompt caching. Caching is a PREFIX match, so the
    // stable half must be byte-identical across this user's messages and the
    // volatile half must come after it — anything that changes per message
    // sitting early would invalidate the whole thing every turn.
    //   stable   = the ~5.2k-token constant + this user's fixed preferences
    //   volatile = live context (inbox, notes, memory, connectors, …)
    let stableSystem = MODUS_SYSTEM_PROMPT + userContextBlock + styleBlock + settingsBlock + modelCatalogBlock;
    let volatileSystem = projectRules + connectorBlock + contactsBlock + notesBlock + messagesBlock + memoryContext + goalContextBlock + projectContextBlock + taskContextBlock + projectResourcesBlock + googleDataBlock + notionBlock + slackBlock + githubBlock + webSearchBlock + driveBlock + groupBlock + attachmentsBlock;
    let fullSystemPrompt = stableSystem + volatileSystem;

    // Size guard: Groq/Llama has a hard ~12k tokens-per-minute cap. A large request
    // (big system prompt + injected context + a long user message) sent to Llama 429s
    // with "Request too large" → empty/errored reply. If we'd use Llama and the request
    // is large, upgrade to a large-context model the user can access; else trim to fit.
    const LLAMA_TPM_SAFE_TOKENS = 9000;
    const approxTokens = Math.ceil((fullSystemPrompt.length + JSON.stringify(cappedMessages).length) / 4);
    if (resolved.modelId === LLAMA_FALLBACK && approxTokens > LLAMA_TPM_SAFE_TOKENS) {
      let upgraded = false;
      // Real catalog ids, not legacy aliases: resolveChatModel canonicalises the
      // id it's given, so passing 'gpt-4o' here would come back as 'gpt-5.6-terra'
      // and the `cand.modelId === up` check below would never match — the upgrade
      // would silently stop happening and large requests would 429 on Llama again.
      // claude-sonnet-5, NOT claude-sonnet-4-6: the comment above is not theoretical.
      // 4-6 became a LEGACY id on 2026-07-17, so resolveChatModel would canonicalise
      // it to claude-sonnet-5 and `cand.modelId === up` would never match — the
      // size-guard upgrade would silently stop and large requests would 429 on Llama.
      for (const up of ['gpt-5.6-terra', 'claude-sonnet-5']) {
        const cand = resolveChatModel(userData, { hasImage, modelId: up });
        if (cand.modelId === up) {
          resolved = cand;
          chatModel = cand.model;
          upgraded = true;
          console.log(`[chat] size-guard: upgraded Llama→${up} (~${approxTokens} tokens)`);
          break;
        }
      }
      if (!upgraded) {
        // Free/guest — only Llama available. Trim so Llama can accept the request.
        // Keep the stable/volatile split consistent with fullSystemPrompt; this
        // path is Llama-only so it never reaches the Anthropic cache branch, but
        // letting them drift would be a trap for the next change.
        stableSystem = MODUS_SYSTEM_PROMPT + modelCatalogBlock + styleBlock;
        volatileSystem = '';
        fullSystemPrompt = stableSystem;
        cappedMessages = cappedMessages.map(m =>
          typeof m.content === 'string' && m.content.length > 24000
            ? { ...m, content: m.content.slice(0, 24000) }
            : m,
        ) as CoreMessage[];
        console.log(`[chat] size-guard: trimmed oversized request for Llama (~${approxTokens} tokens)`);
      }
    }

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

          // tools() must run in PARALLEL across servers. It used to sit in a
          // sequential for-loop, so each server serialised its own 4s cap —
          // three plugins could add up to 12s before the first token, not 4s.
          const fetched = await Promise.all(
            connections.map(async (conn) => {
              if (conn.status !== 'fulfilled') {
                // Log instead of swallowing — a plugin that stopped working should
                // be visible in logs, not silently dropped from the toolset.
                console.error('[chat] MCP connect failed:', String((conn as PromiseRejectedResult).reason));
                return null;
              }
              const { server, client } = conn.value;
              try {
                const tools = await withTimeout(client.tools(), 4000, 'tools');
                if (Object.keys(tools).length === 0) {
                  try { await client.close(); } catch {}
                  return null;
                }
                return { server, client, tools };
              } catch (e) {
                console.error(`[chat] MCP tools() failed for ${server.name}:`, String(e));
                try { await client.close(); } catch {}
                return null;
              }
            })
          );

          // Merge in a stable, name-sorted order. Object key order feeds the
          // provider's tool serialisation, which is the first thing in an
          // Anthropic cache prefix — non-deterministic order would break caching
          // (see the Phase 2 plan) and makes logs harder to diff.
          const toolNamesByServer: string[] = [];
          for (const ok of fetched.filter(x => x !== null).sort((a, b) => a!.server.name.localeCompare(b!.server.name))) {
            const { server, client, tools } = ok!;
            mcpTools = { ...mcpTools, ...tools };
            toolNamesByServer.push(`${server.name}: ${Object.keys(tools).join(', ')}`);
            mcpClients.push(client);
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

    // OpenAI o-series AND the gpt-5.x family spend hidden reasoning tokens that
    // count against max_completion_tokens. A flat 2048 cap gets entirely consumed
    // by reasoning → the model returns finishReason:'length' with EMPTY visible
    // text → blank message bubble (200, no error). Give them enough headroom to
    // reason AND still emit an answer.
    //
    // gpt-5.x is not a guess. Measured 2026-07-16, one hard prompt to gpt-5.6-sol:
    //   @ 2048  → reasoning_tokens 2048/2048, finish 'length', 0 chars of answer
    //   @ 16000 → reasoning_tokens 3965,      finish 'stop',   4740 chars
    // Miss this and PILOT users get a blank bubble on exactly the hard questions
    // they upgraded for. "gpt-5.6-terra" burns less but is the same shape.
    // The Claude 5 family (Sonnet 5, Fable 5) is the same shape and had to be added
    // here the day it shipped. Measured 2026-07-17 through THIS code path (the real
    // @ai-sdk/anthropic client, one hard prompt):
    //   claude-sonnet-5 @ 2048  → finish 'length', **0 chars** — a blank bubble
    //   claude-sonnet-5 @ 16000 → finish 'stop',   3541 chars
    //   claude-fable-5  @ 2048  → finish 'length', 2322 chars (truncated mid-answer)
    //   claude-fable-5  @ 16000 → finish 'stop',   2173 chars
    // On Claude 5 thinking is adaptive and ALWAYS counts against max_tokens, so a
    // 2048 cap is spent on reasoning before a single visible character is emitted.
    // Gemini 3.x thinks too, and it was ALREADY truncating the model we ship on
    // MODUS $24. Measured 2026-07-17 through @ai-sdk/google, same hard prompt:
    //   gemini-3.5-flash       @ 2048  → finish 'length', 881 chars — CUT OFF
    //   gemini-3.5-flash       @ 16000 → finish 'stop',   2258 chars
    //   gemini-3.1-pro-preview @ 2048  → finish 'stop',   1438 chars (fine either way)
    // Flash was losing the back half of its answers in production. This is a CAP,
    // not a target — a short answer bills what it generates, so raising it costs
    // nothing except on the long answers the user actually asked for.
    const isReasoningModel = /^o\d/.test(resolved.modelId)
      || /^gpt-5/.test(resolved.modelId)
      || /-5$/.test(resolved.modelId)
      || /^gemini-3/.test(resolved.modelId);
    const maxTokens = isReasoningModel ? 16000 : 2048;

    // 🚨 Claude 5 REJECTS a non-default temperature — and the AI SDK always sends one.
    // ai@4.3.19 hardcodes `temperature: temperature != null ? temperature : 0` (its own
    // comment: "TODO v5 remove default 0 for temperature"), so omitting it is impossible:
    // every request would 400 with "`temperature` is deprecated for this model" — not a
    // blank reply, a hard failure on every message. Anthropic's own default is 1, and
    // passing the default explicitly is accepted, which is what makes these models
    // servable on this SDK version at all. Verified: temp 0 → 400, temp 1 → answers.
    const isClaude5 = /^claude-.*-5$/.test(resolved.modelId);

    // Transparent model failover: if the chosen model rejects the request with a
    // transient rate/size limit (e.g. Groq's per-minute TPM 429 on the free
    // model), retry the next model in the chain — a second free Groq model with a
    // fresh TPM budget, then a paid gpt-4o-mini safety net — so MODUS always
    // answers instead of showing "ran out / too long".
    //
    // The failover itself stays transparent. What is NOT transparent any more is
    // WHO ANSWERED. This used to be silent, and the silence was the bug: Google's
    // billing 429 ("check your plan and billing details") matches isFailoverError
    // on both '429' and 'quota', so a PILOT user could pick Gemini, be answered by
    // Llama, and be told nothing — while the routing chip kept Gemini's name and
    // logo on the reply and persisted that claim to Firestore.
    //
    // servedModelId is the answering model. It cannot travel on a response header:
    // toDataStreamResponse() builds headers synchronously, before doStream has
    // resolved, so a switch decided here would miss them every time. It rides the
    // data stream as a message annotation instead — the same channel the routing
    // chip already reads and useConversations already persists.
    const streamData = new StreamData();
    let servedModelId = resolved.modelId;
    let streamDataClosed = false;
    // close() is idempotent here because onError and onFinish are mutually
    // exclusive in practice but not guaranteed to be — closing twice throws.
    const closeStreamData = async () => {
      if (streamDataClosed) return;
      streamDataClosed = true;
      try { await streamData.close(); } catch (e) { console.error('[chat] streamData close failed:', e); }
    };

    const failoverModel = createFallbackModel(
      chatFallbackChain(chatModel as Parameters<typeof createFallbackModel>[0][number]),
      {
        onFallback: (from, to, err) => console.log(`[chat] failover: ${from}→${to} (${String(err).slice(0, 140)})`),
        onServed: (id) => {
          servedModelId = id;
          if (id === resolved.modelId) return;
          // Loud, and matches the pre-flight MODEL DOWNGRADE log above: both
          // downgrade routes are now visible in logs AND to the user.
          console.error(`[chat] MODEL FAILOVER: requested ${resolved.modelId} → served ${id} uid=${uid ?? 'guest'}`);
          // Always correct the chip — a wrong model name on a reply is a false
          // claim regardless of tier. Only flag `downgraded` (which surfaces the
          // user-facing notice) when we actually promised a specific model, i.e.
          // the same isPremiumModel rule the pre-flight gate uses, applied to what
          // the USER picked rather than to whatever the size guard swapped in. A
          // free-tier Llama→Llama TPM hop never promised anything, so it stays
          // quiet — Groq's free tier trips that often enough that a notice there
          // would be constant and people would learn to ignore all of them.
          streamData.appendMessageAnnotation({
            modusServedModel: id,
            modusRequestedModel: promisedModelId,
            modusDowngraded: isPremiumModel(promisedModelId),
          });
        },
      },
    );

    // ── Anthropic prompt caching ──────────────────────────────────────────────
    // Claude re-reads the same ~5.2k-token prefix on every message at full price.
    // cache_control drops cached input to ~10% and cuts time-to-first-token — but
    // @ai-sdk/anthropic only attaches it to a system message carrying
    // providerOptions (dist/index.mjs:196), and `system:` is a bare string with
    // nowhere to hang it. So Claude gets the two-system-message form instead.
    //
    // Only Claude. Every other provider keeps the exact string it gets today:
    // Groq can't cache, and gpt-4o already caches automatically for free.
    const systemTail = volatileSystem + mcpBlock + extractionGuard;
    const useAnthropicCache = resolved.modelId.startsWith('claude-');

    if (useAnthropicCache) {
      // Correctness never depends on this working: if the AI SDK routes these
      // through its UI-message path (which drops providerOptions, index.mjs:1742)
      // the prompt text is still delivered in full — we just lose the cache. Log
      // it so a silent zero-hit-rate is visible rather than mysterious.
      const uiShaped = cappedMessages.some(m =>
        m != null && typeof m === 'object' &&
        ('parts' in m || 'toolInvocations' in m || 'experimental_attachments' in m),
      );
      if (uiShaped) console.log('[chat] cache: skipped — messages are UI-shaped, providerOptions would be dropped');
      else console.log(`[chat] cache: breakpoint on ${Math.ceil(stableSystem.length / 4)}~tok stable prefix (${resolved.modelId})`);
    }

    const cachedSystemMessages: CoreMessage[] = [
      {
        role: 'system',
        content: stableSystem,
        providerOptions: { anthropic: { cacheControl: { type: 'ephemeral' } } },
      },
      ...(systemTail ? [{ role: 'system' as const, content: systemTail }] : []),
    ];

    const result = streamText({
      model: failoverModel,
      ...(useAnthropicCache
        ? { messages: [...cachedSystemMessages, ...cappedMessages] }
        : { system: fullSystemPrompt + mcpBlock + extractionGuard, messages: cappedMessages }),
      maxTokens,
      ...(isClaude5 ? { temperature: 1 } : {}),
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
        // onFinish does not run on error, and an unclosed StreamData never ends
        // the response stream — the client would hang instead of seeing the error.
        await closeStreamData();
      },
      onFinish: async ({ text, usage }) => {
        // Close MCP clients
        for (const client of mcpClients) {
          try { await client.close(); } catch {}
        }
        // Must close or the data stream (and so the response) never ends.
        await closeStreamData();
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
      data: streamData,
      headers: {
        // Honest labeling: what we are ABOUT TO ask, so the client can show a
        // notice when a premium pick was downgraded by the pre-flight gate.
        //
        // Headers are still computed before streaming begins, so this remains the
        // model we ATTEMPTED — it cannot know about a runtime failover. That gap
        // is now covered: createFallbackModel reports the real answering model via
        // onServed, which rides the data stream as a modusServedModel annotation
        // and OVERRIDES this value on the client. Header = intent, annotation =
        // truth; when they disagree, the annotation wins.
        'x-modus-model': resolved.modelId,
        // Auto mode picked this model for the task → client shows a routing chip.
        ...(wasAutoRouted ? { 'x-modus-auto': '1' } : {}),
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
        // "too large"/TPM from Groq is a TRANSIENT per-minute throttle, not a
        // permanent "your message is too long" — and the failover chain above
        // already tried every model, so reaching here means all were briefly
        // busy. Surface that honestly (never tell the user to shorten a 2-char
        // message). Kept the `message_too_large` alias for older cached clients.
        if (sl.includes('too large') || sl.includes('tokens per minute') || sl.includes('reduce') || sl.includes('message_too_large')) return 'all_models_busy';
        // Don't leak raw provider/internal error text to the client.
        return 'chat_error';
      },
    });
  } catch (e) {
    console.error('[chat] route error:', String(e));
    return Response.json({ error: 'Something went wrong' }, { status: 500 });
  }
}
