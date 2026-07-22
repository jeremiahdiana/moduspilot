import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { generateText, type LanguageModel } from 'ai';

export interface BriefingTop3Item {
  task: string;
  source: string;
}

export interface BriefingHabit {
  name: string;
  streak: number;
  status: 'at_risk' | 'on_track' | 'done';
}

export interface BriefingScheduleItem {
  time: string;
  title: string;
}

export interface BriefingData {
  openingLine: string;
  narrative?: string;
  top3: BriefingTop3Item[];
  looseEnd: { text: string } | null;
  habits: BriefingHabit[];
  patternCallout: string | null;
  relationshipAlert: string | null;
  schedule: BriefingScheduleItem[];
}

const groq = createOpenAI({ apiKey: process.env.AI_GATEWAY_API_KEY ?? '', baseURL: 'https://ai-gateway.vercel.sh/v1' });

export function todayLabel() {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
  });
}

export function briefingDataToText(data: BriefingData): string {
  const lines: string[] = [data.narrative ?? data.openingLine, ''];
  lines.push('Top 3 for today:');
  data.top3.forEach((item, i) => lines.push(`${i + 1}. ${item.task} (${item.source})`));
  if (data.looseEnd) {
    lines.push('', `Loose end: ${data.looseEnd.text}`);
  }
  if (data.habits.length > 0) {
    lines.push('', 'Habits:');
    data.habits.forEach(h => {
      const s = h.status === 'at_risk' ? 'at risk' : h.status === 'done' ? 'done today' : `${h.streak} day streak`;
      lines.push(`- ${h.name}: ${s}`);
    });
  }
  if (data.patternCallout) lines.push('', data.patternCallout);
  if (data.relationshipAlert) lines.push('', data.relationshipAlert);
  lines.push('', "That's your morning. Anything on your mind?");
  return lines.join('\n');
}

export async function generateBriefingData(
  name: string,
  input: {
    goals: { title: string; progress: number }[];
    tasks: { title: string; priority?: string | null; dueDate?: string | null; createdAt?: string | null }[];
    habits: { title: string; streak: number; completedDates: string[] }[];
    today: string;
    yesterday: string;
    schedule?: { time: string; title: string }[];
    unreadEmails?: { from: string; subject: string }[];
    staleContacts?: { name: string; daysSince: number }[];
    slippedTaskTitles30Days?: string[];
    habitRates30Days?: { title: string; doneOutOf30: number }[];
  },
  // Paid users get a frontier model (Claude Sonnet) for the briefing — the
  // flagship daily read — with Groq Llama as the fast/free fallback.
  opts: { premium?: boolean } = {}
): Promise<BriefingData> {
  const { today, yesterday } = input;

  const goalsText = input.goals.length
    ? input.goals.map(g => `- ${g.title} (${g.progress}% complete)`).join('\n')
    : 'None.';

  const tasksText = input.tasks.length
    ? input.tasks.slice(0, 12).map(t => {
        const parts = [`- ${t.title}`];
        if (t.priority) parts.push(`[${t.priority}]`);
        if (t.dueDate) parts.push(`due ${t.dueDate}`);
        if (t.createdAt && t.createdAt <= yesterday) parts.push(`(open since ${t.createdAt})`);
        return parts.join(' ');
      }).join('\n')
    : 'None.';

  const activeHabits = input.habits.filter(
    h => h.streak > 0 || h.completedDates.some(d => d >= yesterday)
  );
  const habitsText = activeHabits.length
    ? activeHabits.map(h => {
        const doneToday = h.completedDates.includes(today);
        const atRisk = !doneToday && h.streak > 0;
        return `- ${h.title}: ${h.streak} day streak${doneToday ? ', done today' : atRisk ? ', NOT done yet (at risk)' : ''}`;
      }).join('\n')
    : 'None.';

  const scheduleText = input.schedule?.length
    ? input.schedule.map(e => `- ${e.time}: ${e.title}`).join('\n')
    : 'No calendar events.';

  const emailsText = input.unreadEmails?.length
    ? input.unreadEmails.map(e => `- ${e.from}: ${e.subject}`).join('\n')
    : '';

  const staleContactsText = input.staleContacts?.length
    ? input.staleContacts.map(c => `- ${c.name} (${c.daysSince} days ago)`).join('\n')
    : '';

  const patternHistoryText = [
    input.slippedTaskTitles30Days?.length ? `Pending/slipped tasks (30d): ${input.slippedTaskTitles30Days.join(', ')}` : '',
    input.habitRates30Days?.length ? `Habit rates (30d): ${input.habitRates30Days.map(h => `${h.title} ${h.doneOutOf30}/30`).join(', ')}` : '',
  ].filter(Boolean).join('\n');

  const systemPrompt = `You are MODUS, an AI chief of staff. Output ONLY a valid JSON object — no markdown fences, no explanation, no other text before or after.

Today is ${todayLabel()}.

Output this exact schema:
{
  "openingLine": "string — one punchy sentence, specific to their data, no filler",
  "narrative": "string — 2-3 sentences. Synthesize the full day: name the calendar constraint if any, call out the most urgent task and why, give one specific timing recommendation. Be direct, no filler.",
  "top3": [
    { "task": "string", "source": "string — e.g. Goal · Fundraising or Due · Tomorrow or Meeting · 2pm" }
  ],
  "looseEnd": { "text": "string — what it is and why it still matters" } or null,
  "habits": [
    { "name": "string", "streak": number, "status": "at_risk" or "on_track" or "done" }
  ],
  "patternCallout": "string" or null,
  "relationshipAlert": "string" or null,
  "schedule": [
    { "time": "string — e.g. 9:00 AM", "title": "string" }
  ]
}

Rules:
- openingLine: one sentence hook, name something specific from their data.
- narrative: 2-3 sentences, concrete and actionable. If meetings exist, mention the focus window around them. Name the #1 risk or opportunity. End with a recommendation.
- top3: exactly 3 items ranked by urgency and goal alignment. Factor in calendar events (meetings eat focus time). If fewer than 3 tasks exist, infer a high-value action from their goals.
- looseEnd: only if a task was open before today. null if nothing is genuinely overdue.
- habits: only habits from the input that have active streaks or were done recently. at_risk = streak > 0 and not done today. on_track = streak > 0 and done today. done = completed today.
- patternCallout: null unless the 30-DAY HISTORY shows a specific, genuine behavioral pattern (a category of tasks repeatedly avoided, a habit with consistently low completion). Name it with counts. Do not invent one if the history is empty.
- relationshipAlert: if STALE CONTACTS exist, write one punchy line naming the person and days since contact. If multiple, name the most overdue. null if no stale contacts.
- UNREAD EMAILS: if any exist and one is genuinely important or time-sensitive, you may surface it as a top3 item (source like "Inbox · {sender}") or as the looseEnd. Never invent emails not in the input; ignore the list if nothing looks urgent.
- schedule: return the calendar events from the input as-is. Empty array if none.
- Never use em dashes. Never fabricate tasks or goals not in the input.`;

  const userPrompt = `Name: ${name}
Today: ${today}
Yesterday: ${yesterday}

ACTIVE GOALS:
${goalsText}

OPEN TASKS:
${tasksText}

HABITS:
${habitsText}

TODAY'S CALENDAR:
${scheduleText}${emailsText ? `\n\nUNREAD EMAILS (awaiting reply):\n${emailsText}` : ''}${patternHistoryText ? `\n\n30-DAY HISTORY (for patternCallout only):\n${patternHistoryText}` : ''}${staleContactsText ? `\n\nSTALE CONTACTS (emailed you, no reply yet):\n${staleContactsText}` : ''}`;

  const fallback = (): BriefingData => ({
    openingLine: `${todayLabel()} — let's get to it.`,
    narrative: `Here's your day, ${name}. Review your top tasks and check your schedule.`,
    top3: input.tasks.slice(0, 3).map(t => ({ task: t.title, source: 'Task' })),
    looseEnd: null,
    habits: activeHabits.map(h => ({
      name: h.title,
      streak: h.streak,
      status: h.completedDates.includes(today) ? 'done' : h.streak > 0 ? 'at_risk' : 'on_track',
    })),
    patternCallout: null,
    relationshipAlert: null,
    schedule: input.schedule ?? [],
  });

  // Paid users lead with Claude Sonnet 4.6; everyone falls back to Groq Llama
  // (fast + free), then to the structured fallback so we never throw.
  //
  // ⚠️ DELIBERATELY still 4.6, even though the chat catalog moved to Sonnet 5 on
  // 2026-07-17. Sonnet 4.6 is not retired and serves fine. "Upgrading" this line
  // ALONE would 400 every briefing: Claude 5 rejects the AI SDK's hardcoded
  // temperature:0, and this file has its own generateText call that does not pass
  // the temperature:1 that chat/route.ts adds. Move it only together with that fix.
  const anthropicKey = process.env.ANTHROPIC_API_KEY?.trim();
  const models: LanguageModel[] = [];
  if (opts.premium && anthropicKey) {
    models.push(createAnthropic({ apiKey: anthropicKey })('claude-sonnet-4-6'));
  }
  // ⚠️ Two GATEWAY models is not two fallbacks. They share one account and one
  // tier, so a free-tier 429 takes both down in the same instant and for the
  // identical reason — the chain looked three deep and was effectively one.
  // gpt-4o-mini is on a DIRECT vendor key, so it is the only link that survives
  // a Gateway tier failure. Without it the briefing simply never generated.
  models.push(groq('meta/llama-3.3-70b'), groq('meta/llama-3.1-8b'));
  const openAIKeyForBriefing = process.env.OPENAI_API_KEY?.trim();
  if (openAIKeyForBriefing) {
    models.push(createOpenAI({ apiKey: openAIKeyForBriefing })('gpt-4o-mini'));
  }
  for (const model of models) {
    try {
      const { text } = await generateText({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        maxTokens: 800,
      });
      const cleaned = text.trim()
        .replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();
      return JSON.parse(cleaned) as BriefingData;
    } catch {
      // Try next model
    }
  }

  // All models failed — return structured fallback so we never throw
  return fallback();
}
