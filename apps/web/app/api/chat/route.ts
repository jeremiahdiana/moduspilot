import { createHash } from 'crypto';
import { streamText, experimental_createMCPClient } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import type { CoreMessage, LanguageModel } from 'ai';
import { MODUS_SYSTEM_PROMPT } from '@/lib/claude';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { queryMemory, upsertMemory } from '@/lib/pinecone';
import { getValidAccessToken } from '@/lib/google-oauth';
import { getActionableThreads } from '@/lib/google-gmail';
import { getTodayEvents, fmtEventTime } from '@/lib/google-calendar';
import { webSearch, shouldWebSearch } from '@/lib/tavily';
import { searchDriveFiles, shouldSearchDrive, mimeLabel, getRecentFiles } from '@/lib/google-drive';
import { getNotionAccounts, getFirstNotionToken } from '@/lib/notion-oauth';
import { getSlackAccounts, getFirstSlackToken } from '@/lib/slack-oauth';
import { getGitHubAccounts, getFirstGitHubToken } from '@/lib/github-oauth';
import { getRecentNotionPages } from '@/lib/notion-data';
import { getRecentSlackActivity } from '@/lib/slack-data';
import { getGitHubWorkItems } from '@/lib/github-data';
import { getMcpServers } from '@/lib/mcp-servers';

const STYLE_INSTRUCTIONS: Record<string, string> = {
  normal:      'RESPONSE STYLE: Be extremely direct and blunt. No softening, no filler. Cut straight to the answer.',
  concise:     'RESPONSE STYLE: Ultra-short responses only. One to three sentences max. No explanations unless explicitly asked.',
  formal:      'RESPONSE STYLE: Adopt a strategic advisor tone. Big-picture thinking, sharp analysis, executive-level framing.',
  learning:    'RESPONSE STYLE: Act as a sharp coach. Push the user, hold them accountable, challenge assumptions. Don\'t let them off the hook.',
  explanatory: 'RESPONSE STYLE: Be warm and encouraging but stay honest. Supportive, not sycophantic.',
};

const MODUS_TOKEN_LIMIT  = 500_000;
const PILOT_TOKEN_LIMIT  = 1_500_000;
const MODUS_WEEKLY_LIMIT = MODUS_TOKEN_LIMIT * 7;
const PILOT_WEEKLY_LIMIT = PILOT_TOKEN_LIMIT * 7;

function getWeekKey(): string {
  const now = new Date();
  const day = now.getUTCDay();
  const monday = new Date(now);
  monday.setUTCDate(now.getUTCDate() - (day === 0 ? 6 : day - 1));
  return monday.toISOString().slice(0, 10);
}

function needsEmailCtx(q: string): boolean {
  return /\b(email|mail|inbox|reply|draft|send|unread|thread|gmail|message from|wrote)\b/i.test(q);
}
function needsCalendarCtx(q: string): boolean {
  return /\b(calendar|schedule|meeting|event|appointment|today|tomorrow|this week|next week|when am i|busy|free time)\b/i.test(q);
}
function needsNotionCtx(q: string): boolean {
  return /\bnotion\b/i.test(q);
}
function needsSlackCtx(q: string): boolean {
  return /\bslack\b/i.test(q);
}
function needsGithubCtx(q: string): boolean {
  return /\b(github|pull request|\bpr\b|issue|repo|commit|branch|merge|code review)\b/i.test(q);
}
// Short or open-ended queries get Gmail + Calendar by default (most commonly useful)
function isVagueQuery(q: string): boolean {
  return q.trim().split(/\s+/).length < 6 ||
    /\b(focus|priorit|what('s| is) (next|up|happening|going on)|catch me up|status|brief|overview|update me|check in|morning|today)\b/i.test(q);
}

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

    // Guest rate limit — 5 messages per day per IP (unauthenticated users)
    if (!uid) {
      const ip = (req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? 'unknown')
        .split(',')[0].trim();
      const ipHash = createHash('sha256').update(ip).digest('hex').slice(0, 32);
      const todayStr = new Date().toISOString().slice(0, 10);
      const guestRef = adminDb.collection('guestRateLimits').doc(ipHash);
      let guestBlocked = false;
      await adminDb.runTransaction(async (txn) => {
        const snap = await txn.get(guestRef);
        const data = snap.data() ?? {};
        const count = (data.date as string) === todayStr ? ((data.count as number) ?? 0) : 0;
        if (count >= 5) { guestBlocked = true; return; }
        txn.set(guestRef, { count: count + 1, date: todayStr });
      });
      if (guestBlocked) {
        return Response.json({ error: 'guest_limit_reached' }, { status: 429 });
      }
    }

    // Authenticated user rate limit — atomic transaction prevents race-condition bypass
    if (uid) {
      const plan = userData.plan as string | undefined;
      const isPaid = plan === 'modus' || plan === 'pilot';
      if (!isPaid) {
        // Use modusPilotSignupAt for trial — more reliable than Firebase Auth creation time.
        // If missing (existing users), set it now so their 30-day trial starts from today.
        let inTrial = false;
        const rawSignup = userData.modusPilotSignupAt;
        if (rawSignup) {
          const signupMs = typeof rawSignup.toDate === 'function'
            ? rawSignup.toDate().getTime()
            : new Date(rawSignup as string).getTime();
          inTrial = Date.now() - signupMs < 30 * 24 * 60 * 60 * 1000;
        } else {
          // First time — record signup date and grant full trial
          adminDb.collection('users').doc(uid).set(
            { modusPilotSignupAt: FieldValue.serverTimestamp() },
            { merge: true }
          ).catch(() => {});
          inTrial = true;
        }

        if (!inTrial) {
          const todayStr = new Date().toISOString().slice(0, 10);
          const userRef = adminDb.collection('users').doc(uid);
          let limitReached = false;
          await adminDb.runTransaction(async (txn) => {
            const snap = await txn.get(userRef);
            const data = snap.data() ?? {};
            const usageDate = (data.usageDate as string) ?? '';
            const dailyMessages = (data.dailyMessages as number) ?? 0;
            const count = usageDate === todayStr ? dailyMessages : 0;
            if (count >= 20) { limitReached = true; return; }
            if (usageDate === todayStr) {
              txn.set(userRef, { dailyMessages: FieldValue.increment(1) }, { merge: true });
            } else {
              txn.set(userRef, { dailyMessages: 1, usageDate: todayStr }, { merge: true });
            }
          });
          if (limitReached) {
            return Response.json({ error: 'daily_limit_reached' }, { status: 429 });
          }
        }
      }
    }

    // Paid user daily + weekly token limits
    if (uid) {
      const plan = userData.plan as string | undefined;
      if (plan === 'modus' || plan === 'pilot') {
        const todayStr  = new Date().toISOString().slice(0, 10);
        const weekKey   = getWeekKey();
        const dailyLimit  = plan === 'pilot' ? PILOT_TOKEN_LIMIT  : MODUS_TOKEN_LIMIT;
        const weeklyLimit = plan === 'pilot' ? PILOT_WEEKLY_LIMIT : MODUS_WEEKLY_LIMIT;
        const tokensToday  = (userData.tokenDate  as string) === todayStr ? ((userData.dailyTokens  as number) ?? 0) : 0;
        const tokensWeek   = (userData.tokenWeek  as string) === weekKey  ? ((userData.weeklyTokens as number) ?? 0) : 0;
        if (tokensToday >= dailyLimit || tokensWeek >= weeklyLimit) {
          return Response.json({ error: 'token_limit_reached' }, { status: 429 });
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
      projectContext?: { id: string; title: string; description?: string; resources: Array<{ type: string; name: string; url?: string; repo?: string; pageId?: string; channelId?: string; fileId?: string }>; activeChatId?: string };
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

    // Start Pinecone early — runs in parallel with all other context fetches below
    const memoryPromise: Promise<Awaited<ReturnType<typeof queryMemory>>> =
      (uid && queryText && process.env.PINECONE_API_KEY)
        ? Promise.race([
            queryMemory(uid, queryText, 4),
            new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 800)),
          ]).catch(e => { console.error('[chat] memory query failed:', e); return []; })
        : Promise.resolve([]);

    // Fetch live Google data only when relevant to the query
    let gmailBlock = '';
    let calendarBlock = '';
    if (uid && (wantsEmail || wantsCalendar)) {
      try {
        const googleToken = await getValidAccessToken(uid);
        if (!googleToken && wantsEmail) {
          gmailBlock = '\n\nINBOX: Gmail is connected but the access token could not be refreshed. Do NOT invent or fabricate any emails — tell the user their Gmail token may need to be reconnected.';
        }
        if (googleToken) {
          const gmailFilter = (userData.settings?.gmailFilter as 'primary' | 'all' | undefined) ?? 'primary';
          const [threads, events] = await Promise.all([
            wantsEmail    ? getActionableThreads(googleToken, { filter: gmailFilter }) : Promise.resolve([]),
            wantsCalendar ? getTodayEvents(googleToken) : Promise.resolve([]),
          ]);
          if (threads.length > 0) {
            gmailBlock = '\n\nINBOX (last 10 days — Gmail IS connected; this is the complete list available. Do NOT suggest connecting Gmail or checking inbox — you already have it. Never invent emails not listed here):\n' +
              threads.slice(0, 10).map((t, i) =>
                `${i + 1}. threadId: ${t.id}\n   From: ${t.from}\n   Subject: ${t.subject}\n   Body: ${t.body ? t.body.slice(0, 600) : t.snippet}`
              ).join('\n\n');
          } else if (wantsEmail) {
            gmailBlock = '\n\nINBOX: Gmail IS connected but no emails found in the last 10 days. Do NOT suggest connecting Gmail — it is already connected.';
          }
          const todayEvents = events.filter(e => !e.allDay);
          if (todayEvents.length > 0) {
            calendarBlock = "\n\nTODAY'S CALENDAR:\n" +
              todayEvents.map(e => `- ${fmtEventTime(e.start)}: ${e.title}`).join('\n');
          } else if (wantsCalendar) {
            calendarBlock = "\n\nTODAY'S CALENDAR: No events today.";
          }
        }
      } catch { /* non-fatal */ }
    }

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

    // Collect Pinecone result (started in parallel above)
    let memoryContext = '';
    {
      const matches = await memoryPromise;
      const relevant = matches.filter(m => (m.score ?? 0) > 0.55);
      if (relevant.length > 0) {
        memoryContext = '\n\nRELEVANT MEMORY FROM PAST CONVERSATIONS:\n' +
          relevant.map(m => `- ${String(m.metadata?.text ?? '')}`).join('\n');
      }
    }

    // Resolve model — BYOK keys take priority, then platform default (Groq — free, reliable)
    let chatModel: LanguageModel;
    const ms = userData.modelSettings as { provider?: string; model?: string; openaiKey?: string; anthropicKey?: string } | undefined;
    const modelProvider = ms?.provider ?? 'platform';

    if (modelProvider === 'openai' && ms?.openaiKey) {
      chatModel = createOpenAI({ apiKey: ms.openaiKey })(ms.model ?? 'gpt-4o-mini');
    } else if (modelProvider === 'anthropic' && ms?.anthropicKey) {
      chatModel = createAnthropic({ apiKey: ms.anthropicKey })(ms.model ?? 'claude-sonnet-4-6');
    } else {
      // Platform default: route by model name — gpt-* goes to OpenAI (paid only), llama-* goes to Groq
      const platformPlan = userData.plan as string | undefined;
      const isPaid = platformPlan === 'modus' || platformPlan === 'pilot';
      const selectedModel = ms?.model ?? 'llama-3.3-70b-versatile';
      const openAIKey = process.env.OPENAI_API_KEY?.trim().replace(/\s/g, '');
      const wantsOpenAI = selectedModel.startsWith('gpt') && isPaid && openAIKey;
      if (wantsOpenAI) {
        chatModel = createOpenAI({ apiKey: openAIKey })(selectedModel);
      } else {
        const groqModel = selectedModel.startsWith('gpt') ? 'llama-3.3-70b-versatile' : selectedModel;
        chatModel = createOpenAI({ baseURL: 'https://api.groq.com/openai/v1', apiKey: key })(groqModel);
      }
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

    // Project context + scoped resource data
    const pc = body.projectContext;
    let projectContextBlock = '';
    let projectResourcesBlock = '';
    if (pc) {
      const isMainProjectChat = !pc.activeChatId || pc.activeChatId === `project-${pc.id}`;
      projectContextBlock = `\n\nPROJECT FOCUS: This conversation is scoped to the project "${pc.title}" (projectId: "${pc.id}"). ${pc.description ? `Description: ${pc.description}.` : ''} ${pc.resources.length > 0 ? `This project has ${pc.resources.length} pinned resource${pc.resources.length !== 1 ? 's' : ''}. Treat the PROJECT RESOURCES block below as primary context — prioritize it over global GITHUB/NOTION/SLACK/DRIVE blocks when answering project questions. Never reference repos, pages, or channels not in the pinned list when answering about this project.` : 'No resources are pinned yet — encourage the user to pin resources from the Resources tab.'}\n\nDo NOT generate update_goal_progress, create_habit, or goal-tracking cards in project chats. If the user asks to create a new chat for this project, output a create_project_chat approval card with payload.projectId = "${pc.id}". ${!isMainProjectChat ? `If asked to delete this chat, output a delete_project_chat card with payload.conversationId = "${pc.activeChatId}".` : 'This is the main project chat — do NOT generate a delete_project_chat card here.'}`;

      if (pc.resources.length > 0 && uid) {
        // Fetch live scoped data for each pinned resource type
        const githubResources = pc.resources.filter(r => r.type === 'github');
        const notionResources  = pc.resources.filter(r => r.type === 'notion');
        const slackResources   = pc.resources.filter(r => r.type === 'slack');
        const driveResources   = pc.resources.filter(r => r.type === 'drive');
        const urlResources     = pc.resources.filter(r => r.type === 'url');

        const lines: string[] = [];

        try {
          // GitHub: open PRs + issues per pinned repo
          if (githubResources.length > 0) {
            const gh = await getFirstGitHubToken(uid);
            if (gh) {
              const headers = { Authorization: `Bearer ${gh.token}`, Accept: 'application/vnd.github+json' };
              for (const r of githubResources.slice(0, 3)) {
                if (!r.repo) continue;
                try {
                  const [prRes, issueRes] = await Promise.all([
                    fetch(`https://api.github.com/search/issues?q=is:open+is:pr+repo:${r.repo}&sort=updated&per_page=5`, { headers }),
                    fetch(`https://api.github.com/search/issues?q=is:open+is:issue+repo:${r.repo}&sort=updated&per_page=5`, { headers }),
                  ]);
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  const prItems: any[] = prRes.ok ? ((await prRes.json()).items ?? []) : [];
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  const issueItems: any[] = issueRes.ok ? ((await issueRes.json()).items ?? []) : [];
                  lines.push(`\nGitHub repo: ${r.repo}`);
                  if (prItems.length > 0) lines.push(`  Open PRs: ${prItems.map((p: { title: string; html_url: string }) => `${p.title} — ${p.html_url}`).join('; ')}`);
                  else lines.push('  Open PRs: none');
                  if (issueItems.length > 0) lines.push(`  Open issues: ${issueItems.map((i: { title: string; html_url: string }) => `${i.title} — ${i.html_url}`).join('; ')}`);
                  else lines.push('  Open issues: none');
                } catch { /* skip this repo */ }
              }
            }
          }

          // Notion: first ~600 chars of block content for each pinned page
          if (notionResources.length > 0) {
            const notionToken = await getFirstNotionToken(uid);
            if (notionToken) {
              for (const r of notionResources.slice(0, 3)) {
                const pageId = r.pageId ?? r.url?.split('/').pop();
                if (!pageId) continue;
                try {
                  const blocksRes = await fetch(`https://api.notion.com/v1/blocks/${pageId}/children?page_size=10`, {
                    headers: { Authorization: `Bearer ${notionToken.token}`, 'Notion-Version': '2022-06-28' },
                  });
                  if (!blocksRes.ok) { lines.push(`\nNotion page: ${r.name} — (content unavailable)`); continue; }
                  const blocksData = await blocksRes.json();
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  const text = (blocksData.results ?? []).map((b: any) => {
                    const rt = b[b.type]?.rich_text ?? [];
                    return rt.map((t: { plain_text: string }) => t.plain_text).join('');
                  }).join(' ').slice(0, 600);
                  lines.push(`\nNotion page: ${r.name}${r.url ? ` — ${r.url}` : ''}\n  Content: ${text || '(empty or no text blocks)'}`);
                } catch { lines.push(`\nNotion page: ${r.name} — (error fetching content)`); }
              }
            }
          }

          // Slack: recent messages from each pinned channel
          if (slackResources.length > 0) {
            const sl = await getFirstSlackToken(uid);
            if (sl) {
              for (const r of slackResources.slice(0, 3)) {
                if (!r.channelId) continue;
                try {
                  const msgRes = await fetch(`https://slack.com/api/conversations.history?channel=${r.channelId}&limit=8`, {
                    headers: { Authorization: `Bearer ${sl.token}` },
                  });
                  if (!msgRes.ok) { lines.push(`\nSlack ${r.name}: (unavailable)`); continue; }
                  const msgData = await msgRes.json() as { ok: boolean; messages?: { text?: string; ts?: string; subtype?: string }[] };
                  if (!msgData.ok) { lines.push(`\nSlack ${r.name}: (unavailable)`); continue; }
                  const msgs = (msgData.messages ?? []).filter(m => !m.subtype && m.text).slice(0, 8);
                  lines.push(`\nSlack ${r.name} (recent messages):\n${msgs.map(m => `  [${m.ts}] ${(m.text ?? '').slice(0, 200)}`).join('\n')}`);
                } catch { lines.push(`\nSlack ${r.name}: (error)`); }
              }
            }
          }

          // Drive: file name + link (text content for Docs/Sheets via export)
          if (driveResources.length > 0) {
            const driveToken = await getValidAccessToken(uid);
            if (driveToken) {
              for (const r of driveResources.slice(0, 3)) {
                if (!r.fileId) continue;
                try {
                  const metaRes = await fetch(`https://www.googleapis.com/drive/v3/files/${r.fileId}?fields=id,name,mimeType,webViewLink`, {
                    headers: { Authorization: `Bearer ${driveToken}` },
                  });
                  if (!metaRes.ok) { lines.push(`\nDrive file: ${r.name} — (unavailable)`); continue; }
                  const meta = await metaRes.json() as { name: string; mimeType: string; webViewLink: string };
                  const isGoogleDoc = meta.mimeType.includes('google-apps.document') || meta.mimeType.includes('google-apps.spreadsheet') || meta.mimeType.includes('google-apps.presentation');
                  const isPlainText = meta.mimeType.startsWith('text/');
                  if (isGoogleDoc) {
                    const exportRes = await fetch(`https://www.googleapis.com/drive/v3/files/${r.fileId}/export?mimeType=text/plain`, {
                      headers: { Authorization: `Bearer ${driveToken}` },
                    });
                    const text = exportRes.ok ? (await exportRes.text()).slice(0, 2000) : '';
                    lines.push(`\nDrive file: ${meta.name} — ${meta.webViewLink}\n  Content:\n${text || '(empty)'}`);
                  } else if (isPlainText) {
                    // .md, .txt, .csv etc — download directly
                    const dlRes = await fetch(`https://www.googleapis.com/drive/v3/files/${r.fileId}?alt=media`, {
                      headers: { Authorization: `Bearer ${driveToken}` },
                    });
                    const text = dlRes.ok ? (await dlRes.text()).slice(0, 2000) : '';
                    lines.push(`\nDrive file: ${meta.name} — ${meta.webViewLink}\n  Content:\n${text || '(empty)'}`);
                  } else {
                    lines.push(`\nDrive file: ${meta.name} — ${meta.webViewLink} (${mimeLabel(meta.mimeType)})`);
                  }
                } catch { lines.push(`\nDrive file: ${r.name} — (error)`); }
              }
            }
          }

          // URLs: just list them
          for (const r of urlResources) {
            lines.push(`\nURL: ${r.name}${r.url ? ` — ${r.url}` : ''}`);
          }
        } catch { /* non-fatal */ }

        if (lines.length > 0) {
          projectResourcesBlock = '\n\nPROJECT RESOURCES (live data scoped to pinned resources — treat as primary context for this project):' + lines.join('');
        }
      }
    }

    const googleDataBlock = gmailBlock || calendarBlock
      ? `${gmailBlock}${calendarBlock}\n\nCRITICAL: Never invent, guess, or fabricate email senders, subjects, content, or calendar events. Only reference what is listed above. If asked about an email or event not in the list, say you don't see it in the last 10 days. NEVER suggest the user connect Gmail or Google — it is already connected.`
      : '';

    // Connector status + live data from Notion, Slack, GitHub
    let connectorBlock = '';
    let notionBlock = '';
    let slackBlock = '';
    let githubBlock = '';
    if (uid) {
      try {
        const [notionAccounts, slackAccounts, githubAccounts, notionToken, slackToken, githubToken] = await Promise.all([
          getNotionAccounts(uid),
          getSlackAccounts(uid),
          getGitHubAccounts(uid),
          getFirstNotionToken(uid),
          getFirstSlackToken(uid),
          getFirstGitHubToken(uid),
        ]);

        const connected: string[] = ['Google (Gmail · Calendar · Drive)'];
        if (notionAccounts.length > 0) connected.push(`Notion (${notionAccounts.map(a => a.workspaceName).join(', ')})`);
        if (slackAccounts.length > 0) connected.push(`Slack (${slackAccounts.map(a => a.teamName).join(', ')})`);
        if (githubAccounts.length > 0) connected.push(`GitHub (@${githubAccounts.map(a => a.login).join(', @')})`);
        const notConnected: string[] = [];
        if (notionAccounts.length === 0) notConnected.push('Notion');
        if (slackAccounts.length === 0) notConnected.push('Slack');
        if (githubAccounts.length === 0) notConnected.push('GitHub');
        connectorBlock = `\n\nCONNECTED INTEGRATIONS: ${connected.join(', ')}`;
        if (notConnected.length > 0) connectorBlock += `\nNOT YET CONNECTED: ${notConnected.join(', ')} — generate a connect card if the user asks about these services`;

        // Fetch live data only when the query is about that service
        const [notionPages, slackMessages, githubItems] = await Promise.all([
          notionToken  && needsNotionCtx(queryText)  ? getRecentNotionPages(notionToken.token, 5)                        : Promise.resolve([]),
          slackToken   && needsSlackCtx(queryText)   ? getRecentSlackActivity(slackToken.token, 8)                       : Promise.resolve([]),
          githubToken  && needsGithubCtx(queryText)  ? getGitHubWorkItems(githubToken.token, githubToken.login, 8)       : Promise.resolve([]),
        ]);

        if (notionPages.length > 0) {
          notionBlock = '\n\nNOTION (recently edited pages — only reference these, never invent others):\n' +
            notionPages.map(p => `- [${p.type === 'database' ? 'DB' : 'Page'}] ${p.title} (edited ${p.lastEdited})${p.url ? ' — ' + p.url : ''}`).join('\n');
        }

        if (slackMessages.length > 0) {
          slackBlock = '\n\nSLACK (recent messages from your channels):\n' +
            slackMessages.map(m => `#${m.channel} [${m.ts}]: ${m.text}`).join('\n');
        }

        if (githubItems.length > 0) {
          const prs = githubItems.filter(i => i.kind === 'pr');
          const issues = githubItems.filter(i => i.kind === 'issue');
          githubBlock = '\n\nGITHUB:';
          if (prs.length) githubBlock += `\nOpen PRs: ${prs.map(p => `${p.title} (${p.repo})`).join(' · ')}`;
          if (issues.length) githubBlock += `\nAssigned issues: ${issues.map(i => `${i.title} (${i.repo})`).join(' · ')}`;
        }
      } catch { /* non-fatal */ }
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
                experimental_createMCPClient({
                  transport: {
                    type: 'sse',
                    url: server.url,
                    headers: server.authHeader ? { Authorization: server.authHeader } : undefined,
                  },
                }),
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
          const plan = userData.plan as string | undefined;
          if (plan === 'modus' || plan === 'pilot') {
            const userRef = adminDb.collection('users').doc(uid);
            adminDb.runTransaction(async (txn) => {
              const snap = await txn.get(userRef);
              const data = snap.data() ?? {};
              const todayStr   = new Date().toISOString().slice(0, 10);
              const weekKey    = getWeekKey();
              const isToday    = (data.tokenDate  as string) === todayStr;
              const isThisWeek = (data.tokenWeek  as string) === weekKey;
              txn.set(userRef, {
                dailyTokens:  isToday    ? FieldValue.increment(usage.totalTokens) : usage.totalTokens,
                tokenDate:    todayStr,
                weeklyTokens: isThisWeek ? FieldValue.increment(usage.totalTokens) : usage.totalTokens,
                tokenWeek:    weekKey,
              }, { merge: true });
            }).catch(e => console.error('[chat] token increment failed:', e));
          }
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
        return s;
      },
    });
  } catch (e) {
    const s = String(e);
    console.error('[chat] route error:', s);
    return Response.json({ error: s }, { status: 500 });
  }
}
