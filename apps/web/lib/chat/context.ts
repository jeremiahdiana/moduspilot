/**
 * Live-context retrieval for the chat route: intent detection + the per-source
 * fetchers (Pinecone memory, Gmail, Calendar, Drive, web search, Notion/Slack/
 * GitHub connectors, pinned project resources). Each fetcher returns the prompt
 * block string(s) it produces and swallows its own failures behind hard
 * timeouts so a slow integration can never kill the response. Logic and strings
 * are reproduced verbatim from the original route.
 */
import { queryMemory } from '@/lib/pinecone';
import { adminDb } from '@/lib/firebase-admin';
import { getValidAccessToken, getAllValidAccessTokens } from '@/lib/google-oauth';
import { getActionableThreads, type GmailThread } from '@/lib/google-gmail';
import { getTodayEvents, fmtEventTime, type CalendarEvent } from '@/lib/google-calendar';
import { webSearch, shouldWebSearch } from '@/lib/tavily';
import { searchDriveFiles, shouldSearchDrive, mimeLabel } from '@/lib/google-drive';
import { getNotionAccounts, getFirstNotionToken } from '@/lib/notion-oauth';
import { getSlackAccounts, getFirstSlackToken } from '@/lib/slack-oauth';
import { getGitHubAccounts, getFirstGitHubToken } from '@/lib/github-oauth';
import { getRecentNotionPages } from '@/lib/notion-data';
import { getRecentSlackActivity } from '@/lib/slack-data';
import { getGitHubWorkItems } from '@/lib/github-data';
import type { ProjectContext } from './prompt';

// ── Contact email cross-reference types ──────────────────────────────────────
export interface ContactEmailEntry {
  name: string;
  company?: string;
  category: 'personal' | 'professional' | 'service' | 'excluded';
}

// Normalize email for reliable matching across aliases:
// - Gmail strips dots from local part (john.doe = johndoe)
// - Gmail strips plus-addressing (user+tag = user)
// - All domains: lowercase + trim
function normalizeEmail(email: string): string {
  const [local, domain] = email.toLowerCase().trim().split('@');
  if (!domain) return email.toLowerCase().trim();
  if (domain === 'gmail.com' || domain === 'googlemail.com') {
    const noPlus = local.split('+')[0];
    return `${noPlus.replace(/\./g, '')}@${domain}`;
  }
  return `${local.split('+')[0]}@${domain}`;
}

// ── Intent detection ─────────────────────────────────────────────────────────
export function needsEmailCtx(q: string): boolean {
  return /\b(emails?|mails?|inbox|reply|draft|send|unread|threads?|gmail|message from|wrote|missed)\b/i.test(q);
}
export function needsCalendarCtx(q: string): boolean {
  return /\b(calendar|schedule|meeting|event|appointment|today|tomorrow|this week|next week|when am i|busy|free time)\b/i.test(q);
}
export function needsNotionCtx(q: string): boolean {
  return /\b(notion|notion page|notion doc|notion database|obsidian)\b/i.test(q);
}
export function needsSlackCtx(q: string): boolean {
  return /\b(slack|slack channel|in slack|the channel|team chat)\b/i.test(q);
}
export function needsGithubCtx(q: string): boolean {
  return /\b(github|pull request|\bpr\b|issue|repo|commit|branch|merge|code review)\b/i.test(q);
}
export function needsNotesCtx(q: string): boolean {
  return /\b(notes?|note app|apple notes|jotted|wrote down|grocery|grocery list|reminder)\b/i.test(q);
}
export function needsMessagesCtx(q: string): boolean {
  return /\b(imessage|text(s|ed)?|messaged|message thread|conversation with|texted me|texting)\b/i.test(q);
}
// Contacts are useful whenever a query is about reaching/identifying a person.
// Gating on this (instead of injecting the whole contact list on every message)
// keeps unrelated queries — code, notes, calendar, general chat — from paying
// the ~1.5k-token contacts tax.
export function needsContactsCtx(q: string): boolean {
  return /\b(contacts?|phone ?numbers?|number for|email for|who is|who's|reach out|get in touch|call|text|message|email|birthday|anniversary|address for|introduce)\b/i.test(q);
}
// Short or open-ended queries get Gmail + Calendar by default (most commonly useful)
export function isVagueQuery(q: string): boolean {
  return q.trim().split(/\s+/).length < 6 ||
    /\b(focus|priorit|what('s| is) (next|up|happening|going on)|catch me up|status|brief|overview|update me|check in|morning|today)\b/i.test(q);
}

// ── Pinecone semantic memory ─────────────────────────────────────────────────
export async function queryMemoryContext(uid: string, queryText: string): Promise<string> {
  const matches = await Promise.race([
    queryMemory(uid, queryText, 4),
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 800)),
  ]).catch(e => { console.error('[chat] memory query failed:', e); return []; });
  const relevant = matches.filter(m => (m.score ?? 0) > 0.55);
  if (relevant.length > 0) {
    return '\n\nRELEVANT MEMORY FROM PAST CONVERSATIONS:\n' +
      relevant.map(m => `- ${String(m.metadata?.text ?? '')}`).join('\n');
  }
  return '';
}

// ── Google Gmail + Calendar ──────────────────────────────────────────────────
export async function fetchGoogleData(
  uid: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  userData: Record<string, any>,
  opts: { wantsEmail: boolean; wantsCalendar: boolean; briefingTimezone: string; contactEmailMap?: Map<string, ContactEmailEntry> },
): Promise<{ gmailBlock: string; calendarBlock: string }> {
  const { wantsEmail, wantsCalendar, briefingTimezone, contactEmailMap } = opts;
  let gmailBlock = '';
  let calendarBlock = '';
  // Hard 5s timeout so a slow Gmail API can never kill the whole response
  try {
    await Promise.race([
      (async () => {
        const allAccounts = await getAllValidAccessTokens(uid);
        const googleToken = allAccounts[0]?.token ?? null;
        if (allAccounts.length === 0 && wantsEmail) {
          gmailBlock = '\n\nINBOX: Gmail is connected but the access token could not be refreshed. Do NOT invent or fabricate any emails — tell the user their Gmail token may need to be reconnected.';
          return;
        }
        const gmailFilter = (userData.settings?.gmailFilter as 'primary' | 'all' | undefined) ?? 'primary';
        // Fetch from ALL connected accounts in parallel, then merge + dedupe
        const [allThreadResults, events] = await Promise.all([
          wantsEmail
            ? Promise.all(allAccounts.map(a => getActionableThreads(a.token, { filter: gmailFilter }).catch(() => [] as GmailThread[])))
            : Promise.resolve([] as GmailThread[][]),
          wantsCalendar && googleToken ? getTodayEvents(googleToken, briefingTimezone) : Promise.resolve([] as CalendarEvent[]),
        ]);
        const seenIds = new Set<string>();
        const threads = (allThreadResults as GmailThread[][]).flat()
          .filter(t => { if (seenIds.has(t.id)) return false; seenIds.add(t.id); return true; });
        if (threads.length > 0) {
          gmailBlock = '\n\nINBOX (last 10 days — Gmail IS connected; this is the complete list available. Do NOT suggest connecting Gmail or checking inbox — you already have it. Never invent emails not listed here):\n' +
            threads.slice(0, 10).map((t, i) => {
              // Cross-reference sender with user's contacts
              const contact = contactEmailMap?.get(normalizeEmail(t.fromAddress));
              let fromDisplay: string;
              if (!contact || contact.category === 'excluded') {
                // Unknown sender or excluded contact — show Gmail's display name as-is
                fromDisplay = `${t.from} <${t.fromAddress}>`;
              } else if (contact.category === 'service') {
                fromDisplay = `${contact.name} [Service] <${t.fromAddress}>`;
              } else {
                const catLabel = contact.category === 'professional' ? 'Professional' : 'Personal';
                const companyPart = contact.company ? ` @ ${contact.company}` : '';
                fromDisplay = `${contact.name}${companyPart} [${catLabel}] <${t.fromAddress}>`;
              }
              return `${i + 1}. threadId: ${t.id}\n   From: ${fromDisplay}\n   Reply-to address: ${t.fromAddress}\n   Subject: ${t.subject}\n   Body: ${t.body ? t.body.slice(0, 600) : t.snippet}`;
            }).join('\n\n');
        } else if (wantsEmail) {
          gmailBlock = '\n\nINBOX: Gmail IS connected but no emails found in the last 10 days. Do NOT suggest connecting Gmail — it is already connected.';
        }
        const todayEvents = (events as CalendarEvent[]).filter(e => !e.allDay);
        if (todayEvents.length > 0) {
          calendarBlock = "\n\nTODAY'S CALENDAR:\n" +
            todayEvents.map(e => `- ${fmtEventTime(e.start, briefingTimezone)}: ${e.title}`).join('\n');
        } else if (wantsCalendar) {
          calendarBlock = "\n\nTODAY'S CALENDAR: No events today.";
        }
      })(),
      new Promise<void>(resolve => setTimeout(resolve, 5000)), // hard cap — never block streaming
    ]);
  } catch { /* non-fatal */ }
  return { gmailBlock, calendarBlock };
}

// ── Web search (Tavily) ──────────────────────────────────────────────────────
export async function fetchWebSearchBlock(queryText: string, capabilities: Record<string, boolean>): Promise<string> {
  if (!(capabilities.webSearch && queryText && shouldWebSearch(queryText) && process.env.TAVILY_API_KEY)) return '';
  try {
    const results = await webSearch(queryText, 5);
    if (results.length > 0) {
      return '\n\nWEB SEARCH RESULTS (for this query — use these to answer, cite sources naturally):\n' +
        results.map((r, i) => `${i + 1}. ${r.title ?? ''}\n   Source: ${r.url ?? ''}\n   ${(r.content ?? '').slice(0, 350)}`).join('\n\n');
    }
  } catch (e) {
    console.error('[chat] web search failed:', e);
  }
  return '';
}

// ── Google Drive file search ─────────────────────────────────────────────────
export async function fetchDriveBlock(uid: string, queryText: string): Promise<string> {
  if (!(queryText && shouldSearchDrive(queryText))) return '';
  try {
    const googleToken = await getValidAccessToken(uid);
    if (googleToken) {
      const files = await searchDriveFiles(googleToken, queryText, 5);
      if (files.length > 0) {
        return '\n\nGOOGLE DRIVE FILES (matching this query):\n' +
          files.map(f => `- ${mimeLabel(f.mimeType)}: ${f.name} — ${f.webViewLink} (modified ${f.modifiedTime.slice(0, 10)})`).join('\n');
      }
    }
  } catch { /* non-fatal */ }
  return '';
}

// ── Connector status + live Notion / Slack / GitHub data ─────────────────────
export async function fetchConnectorData(
  uid: string,
  queryText: string,
): Promise<{ connectorBlock: string; notionBlock: string; slackBlock: string; githubBlock: string }> {
  let connectorBlock = '';
  let notionBlock = '';
  let slackBlock = '';
  let githubBlock = '';
  // 4s hard cap — these external APIs must never kill the response
  try {
    await Promise.race([
      (async () => {
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
          notionToken  && needsNotionCtx(queryText)  ? getRecentNotionPages(notionToken.token, 5)                  : Promise.resolve([]),
          slackToken   && needsSlackCtx(queryText)   ? getRecentSlackActivity(slackToken.token, 8)                 : Promise.resolve([]),
          githubToken  && needsGithubCtx(queryText)  ? getGitHubWorkItems(githubToken.token, githubToken.login, 8) : Promise.resolve([]),
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
      })(),
      new Promise<void>(resolve => setTimeout(resolve, 4000)),
    ]);
  } catch { /* non-fatal */ }
  return { connectorBlock, notionBlock, slackBlock, githubBlock };
}

// ── Device contacts (synced from iOS address book) ───────────────────────────

// Builds a lightweight email → contact map for Gmail sender cross-referencing.
// Called only when an email-relevant query is detected — separate from fetchContactsBlock
// so we don't double-fetch on non-email queries.
export async function fetchContactEmailMap(uid: string): Promise<Map<string, ContactEmailEntry>> {
  const map = new Map<string, ContactEmailEntry>();
  try {
    const snap = await adminDb.collection('users').doc(uid).collection('contacts').limit(500).get();
    for (const d of snap.docs) {
      const data = d.data() as {
        name?: string; email?: string; company?: string;
        userCategory?: 'personal' | 'professional' | 'service' | 'excluded';
      };
      if (!data.name || !data.email) continue;
      const rawEmail = data.email.replace(/[\r\n\t<>]/g, '').trim();
      if (!rawEmail) continue;
      const key = normalizeEmail(rawEmail);
      const isPhoneOnly = !data.company && /^\+?[\d\s\-().]{7,}$/.test(data.name) && !/[a-zA-Z]/.test(data.name);
      const category = data.userCategory ?? (data.company ? 'professional' : isPhoneOnly ? 'service' : 'personal');
      map.set(key, {
        name: data.name.replace(/[\r\n\t]/g, ' ').trim().slice(0, 80),
        company: data.company ? data.company.replace(/[\r\n\t]/g, ' ').trim().slice(0, 80) : undefined,
        category,
      });
    }
  } catch { /* non-fatal — map stays empty, Gmail shows without annotations */ }
  return map;
}

export async function fetchContactsBlock(uid: string, enabled = true): Promise<string> {
  if (!enabled) return '';
  try {
    const snap = await adminDb
      .collection('users').doc(uid)
      .collection('contacts')
      .limit(500)
      .get();
    if (snap.empty) return '';

    const today = new Date();

    type RawDoc = {
      name?: string; email?: string; phone?: string;
      company?: string; jobTitle?: string;
      birthday?: { month: number; day: number; year?: number };
      userCategory?: 'personal' | 'professional' | 'service' | 'excluded';
    };

    const personal: string[] = [];
    const professional: string[] = [];
    const services: string[] = [];

    for (const d of snap.docs) {
      const data = d.data() as RawDoc;
      if (!data.name) continue;
      const name = data.name.replace(/[\r\n\t]/g, ' ').trim().slice(0, 80);
      if (!name) continue;

      // User-set exclusion: skip entirely
      if (data.userCategory === 'excluded') continue;

      const email = data.email ? data.email.replace(/[\r\n\t<>]/g, '').slice(0, 100) : null;
      const company = data.company ? data.company.replace(/[\r\n\t]/g, ' ').trim().slice(0, 80) : null;
      const jobTitle = data.jobTitle ? data.jobTitle.replace(/[\r\n\t]/g, ' ').trim().slice(0, 60) : null;

      // Birthday — flag if within 7 days (rolling, handles year-end wrap)
      let birthdayTag = '';
      if (data.birthday?.month && data.birthday?.day) {
        const { month, day } = data.birthday;
        const bdayThisYear = new Date(today.getFullYear(), month - 1, day);
        if (bdayThisYear < today) bdayThisYear.setFullYear(today.getFullYear() + 1);
        const daysUntil = Math.round((bdayThisYear.getTime() - today.getTime()) / 86400000);
        if (daysUntil <= 7) birthdayTag = ` 🎂 birthday in ${daysUntil === 0 ? 'today' : `${daysUntil}d`}`;
      }

      // Category: userCategory overrides auto-detection
      const isPhoneOnly = !email && !company && /^\+?[\d\s\-().]{7,}$/.test(name) && !/[a-zA-Z]/.test(name);
      const category = data.userCategory ?? (company ? 'professional' : isPhoneOnly ? 'service' : 'personal');

      if (category === 'service') {
        services.push(`[Service] ${name}${email ? ` (${email})` : ''}`);
      } else if (category === 'professional') {
        const title = jobTitle ? ` · ${jobTitle}` : '';
        const emailPart = email ? ` (${email})` : '';
        professional.push(`${name}${company ? ` @ ${company}` : ''}${title}${emailPart}${birthdayTag}`);
      } else {
        personal.push(`${name}${email ? ` (${email})` : ''}${birthdayTag}`);
      }
    }

    const total = personal.length + professional.length + services.length;
    if (total === 0) return '';

    const lines: string[] = [
      `\n\nKNOWN CONTACTS (${total} total — reference by name in conversation; if asked to list contacts, reply with group counts and offer to search for a specific person — never output the full list):`,
    ];
    if (personal.length > 0) lines.push(`\nPersonal (${personal.length}):\n${personal.join(', ')}`);
    if (professional.length > 0) lines.push(`\nProfessional (${professional.length}):\n${professional.join('\n')}`);
    if (services.length > 0) lines.push(`\nServices (${services.length}):\n${services.join(', ')}`);

    return lines.join('').slice(0, 6000);
  } catch { return ''; }
}

// Desktop-agent notes sync (MODUS Desktop, Phase 0 proof-of-concept — see
// apps/desktop). Gated on query intent (needsNotesCtx / vague queries) and the
// notesSync capability toggle, same pattern as fetchContactsBlock.
export async function fetchNotesBlock(uid: string, enabled = true): Promise<string> {
  if (!enabled) return '';
  try {
    // Order by the note's actual edit time (modifiedAt), not Firestore's sync
    // time (updatedAt) — a bulk sync writes many notes within the same instant,
    // so updatedAt alone can't surface the most recently *edited* notes.
    const snap = await adminDb
      .collection('users').doc(uid)
      .collection('notes')
      .orderBy('modifiedAt', 'desc')
      .limit(10)
      .get();
    if (snap.empty) return '';

    const lines: string[] = ['\n\nFROM YOUR SYNCED NOTES (desktop app — most recent):'];
    for (const d of snap.docs) {
      const data = d.data() as { title?: string; body?: string };
      const title = (data.title ?? 'Untitled').replace(/[\r\n\t]/g, ' ').trim().slice(0, 100);
      const body = (data.body ?? '').slice(0, 800);
      lines.push(`\n--- ${title} ---\n${body}`);
    }
    return lines.join('').slice(0, 8000);
  } catch { return ''; }
}

// Desktop-agent iMessage sync (MODUS Desktop — see apps/desktop). Unlike
// notes, this is OTHER people's private correspondence, not just the user's
// own content — gated the same way (intent + capability toggle) but the
// capability defaults to OFF (opt-in), not on.
export async function fetchMessagesBlock(uid: string, enabled = true): Promise<string> {
  if (!enabled) return '';
  try {
    const snap = await adminDb
      .collection('users').doc(uid)
      .collection('messages')
      .orderBy('modifiedAt', 'desc')
      .limit(10)
      .get();
    if (snap.empty) return '';

    const lines: string[] = ['\n\nFROM YOUR SYNCED IMESSAGE CONVERSATIONS (desktop app — most recently active):'];
    for (const d of snap.docs) {
      const data = d.data() as { title?: string; body?: string };
      const title = (data.title ?? 'Unknown').replace(/[\r\n\t]/g, ' ').trim().slice(0, 100);
      const body = (data.body ?? '').slice(0, 800);
      lines.push(`\n--- ${title} ---\n${body}`);
    }
    return lines.join('').slice(0, 8000);
  } catch { return ''; }
}

// ── Pinned project resources (live data scoped to a project) ─────────────────
export async function fetchProjectResources(uid: string, pc: ProjectContext): Promise<string> {
  if (!(pc.resources.length > 0)) return '';

  const githubResources = pc.resources.filter(r => r.type === 'github');
  const notionResources  = pc.resources.filter(r => r.type === 'notion');
  const slackResources   = pc.resources.filter(r => r.type === 'slack');
  const driveResources   = pc.resources.filter(r => r.type === 'drive');
  const urlResources     = pc.resources.filter(r => r.type === 'url');

  const allLines: string[] = [];

  // 5s hard cap — project resource fetches must never kill the response
  await Promise.race([
    (async () => {
      // Fetch all token types + all resources in parallel
      const [gh, notionToken, sl, driveToken] = await Promise.all([
        githubResources.length > 0 ? getFirstGitHubToken(uid) : Promise.resolve(null),
        notionResources.length  > 0 ? getFirstNotionToken(uid)  : Promise.resolve(null),
        slackResources.length   > 0 ? getFirstSlackToken(uid)   : Promise.resolve(null),
        driveResources.length   > 0 ? getValidAccessToken(uid)  : Promise.resolve(null),
      ]);

      // Fetch all resources across all types in parallel
      const resourceFetches = await Promise.allSettled([
        // GitHub repos — all in parallel
        ...githubResources.slice(0, 3).map(async r => {
          if (!r.repo || !gh) return '';
          const headers = { Authorization: `Bearer ${gh.token}`, Accept: 'application/vnd.github+json' };
          const [prRes, issueRes] = await Promise.all([
            fetch(`https://api.github.com/search/issues?q=is:open+is:pr+repo:${r.repo}&sort=updated&per_page=5`, { headers }),
            fetch(`https://api.github.com/search/issues?q=is:open+is:issue+repo:${r.repo}&sort=updated&per_page=5`, { headers }),
          ]);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const prItems: any[] = prRes.ok ? ((await prRes.json()).items ?? []) : [];
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const issueItems: any[] = issueRes.ok ? ((await issueRes.json()).items ?? []) : [];
          const parts = [`\nGitHub repo: ${r.repo}`];
          parts.push(prItems.length > 0 ? `  Open PRs: ${prItems.map((p: { title: string; html_url: string }) => `${p.title} — ${p.html_url}`).join('; ')}` : '  Open PRs: none');
          parts.push(issueItems.length > 0 ? `  Open issues: ${issueItems.map((i: { title: string; html_url: string }) => `${i.title} — ${i.html_url}`).join('; ')}` : '  Open issues: none');
          return parts.join('\n');
        }),
        // Notion pages — all in parallel
        ...notionResources.slice(0, 3).map(async r => {
          if (!notionToken) return '';
          const pageId = r.pageId ?? r.url?.split('/').pop();
          if (!pageId) return '';
          const blocksRes = await fetch(`https://api.notion.com/v1/blocks/${pageId}/children?page_size=10`, {
            headers: { Authorization: `Bearer ${notionToken.token}`, 'Notion-Version': '2022-06-28' },
          });
          if (!blocksRes.ok) return `\nNotion page: ${r.name} — (content unavailable)`;
          const blocksData = await blocksRes.json();
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const text = (blocksData.results ?? []).map((b: any) => {
            const rt = b[b.type]?.rich_text ?? [];
            return rt.map((t: { plain_text: string }) => t.plain_text).join('');
          }).join(' ').slice(0, 600);
          return `\nNotion page: ${r.name}${r.url ? ` — ${r.url}` : ''}\n  Content: ${text || '(empty or no text blocks)'}`;
        }),
        // Slack channels — all in parallel
        ...slackResources.slice(0, 3).map(async r => {
          if (!r.channelId || !sl) return '';
          const msgRes = await fetch(`https://slack.com/api/conversations.history?channel=${r.channelId}&limit=8`, {
            headers: { Authorization: `Bearer ${sl.token}` },
          });
          if (!msgRes.ok) return `\nSlack ${r.name}: (unavailable)`;
          const msgData = await msgRes.json() as { ok: boolean; messages?: { text?: string; ts?: string; subtype?: string }[] };
          if (!msgData.ok) return `\nSlack ${r.name}: (unavailable)`;
          const msgs = (msgData.messages ?? []).filter(m => !m.subtype && m.text).slice(0, 8);
          return `\nSlack ${r.name} (recent messages):\n${msgs.map(m => `  [${m.ts}] ${(m.text ?? '').slice(0, 200)}`).join('\n')}`;
        }),
        // Drive files — all in parallel
        ...driveResources.slice(0, 3).map(async r => {
          if (!r.fileId || !driveToken) return '';
          const metaRes = await fetch(`https://www.googleapis.com/drive/v3/files/${r.fileId}?fields=id,name,mimeType,webViewLink`, {
            headers: { Authorization: `Bearer ${driveToken}` },
          });
          if (!metaRes.ok) return `\nDrive file: ${r.name} — (unavailable)`;
          const meta = await metaRes.json() as { name: string; mimeType: string; webViewLink: string };
          const isGoogleDoc = meta.mimeType.includes('google-apps.document') || meta.mimeType.includes('google-apps.spreadsheet') || meta.mimeType.includes('google-apps.presentation');
          const isPlainText = meta.mimeType.startsWith('text/');
          if (isGoogleDoc) {
            const exportRes = await fetch(`https://www.googleapis.com/drive/v3/files/${r.fileId}/export?mimeType=text/plain`, {
              headers: { Authorization: `Bearer ${driveToken}` },
            });
            const text = exportRes.ok ? (await exportRes.text()).slice(0, 2000) : '';
            return `\nDrive file: ${meta.name} — ${meta.webViewLink}\n  Content:\n${text || '(empty)'}`;
          } else if (isPlainText) {
            const dlRes = await fetch(`https://www.googleapis.com/drive/v3/files/${r.fileId}?alt=media`, {
              headers: { Authorization: `Bearer ${driveToken}` },
            });
            const text = dlRes.ok ? (await dlRes.text()).slice(0, 2000) : '';
            return `\nDrive file: ${meta.name} — ${meta.webViewLink}\n  Content:\n${text || '(empty)'}`;
          }
          return `\nDrive file: ${meta.name} — ${meta.webViewLink} (${mimeLabel(meta.mimeType)})`;
        }),
      ]);

      for (const s of resourceFetches) {
        if (s.status === 'fulfilled' && s.value) allLines.push(s.value);
      }
      for (const r of urlResources) {
        allLines.push(`\nURL: ${r.name}${r.url ? ` — ${r.url}` : ''}`);
      }
    })(),
    new Promise<void>(resolve => setTimeout(resolve, 5000)),
  ]).catch(() => {});

  if (allLines.length > 0) {
    return '\n\nPROJECT RESOURCES (live data scoped to pinned resources — treat as primary context for this project):' + allLines.join('');
  }
  return '';
}
