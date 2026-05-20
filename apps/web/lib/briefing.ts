import { createOpenAI } from '@ai-sdk/openai';
import { generateText } from 'ai';

export interface BriefingTop3Item {
  task: string;
  source: string;
}

export interface BriefingHabit {
  name: string;
  streak: number;
  status: 'at_risk' | 'on_track' | 'done';
}

export interface BriefingData {
  openingLine: string;
  top3: BriefingTop3Item[];
  looseEnd: { text: string } | null;
  habits: BriefingHabit[];
  patternCallout: string | null;
}

const groq = createOpenAI({
  apiKey: process.env.GROQ_API_KEY!,
  baseURL: 'https://api.groq.com/openai/v1',
});

export function todayLabel() {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
  });
}

export function briefingDataToText(data: BriefingData): string {
  const lines: string[] = [data.openingLine, ''];
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
  }
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

  const { text } = await generateText({
    model: groq('llama-3.3-70b-versatile'),
    messages: [
      {
        role: 'system',
        content: `You are MODUS, an AI chief of staff. Output ONLY a valid JSON object — no markdown fences, no explanation, no other text before or after.

Today is ${todayLabel()}.

Output this exact schema:
{
  "openingLine": "string — one sentence, specific to their data, no Good morning filler",
  "top3": [
    { "task": "string", "source": "string — e.g. Goal · Fundraising or Due · Tomorrow or Task" }
  ],
  "looseEnd": { "text": "string — what it is and why it still matters" } or null,
  "habits": [
    { "name": "string", "streak": number, "status": "at_risk" or "on_track" or "done" }
  ],
  "patternCallout": "string" or null
}

Rules:
- top3: exactly 3 items ranked by urgency and goal alignment. If fewer than 3 tasks exist, infer a high-value action from their goals.
- looseEnd: only if a task was open before today. null if nothing is genuinely overdue.
- habits: only habits from the input that have active streaks or were done recently. at_risk = streak > 0 and not done today. on_track = streak > 0 and done today. done = completed today.
- patternCallout: null unless there is a specific, genuine pattern in the data worth naming. Do not invent one.
- Never use em dashes. Never fabricate tasks or goals not in the input.`,
      },
      {
        role: 'user',
        content: `Name: ${name}
Today: ${today}
Yesterday: ${yesterday}

ACTIVE GOALS:
${goalsText}

OPEN TASKS:
${tasksText}

HABITS:
${habitsText}`,
      },
    ],
    maxTokens: 800,
  });

  // Strip markdown fences if model wraps in ```json ... ```
  const cleaned = text.trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();

  let data: BriefingData;
  try {
    data = JSON.parse(cleaned);
  } catch {
    // Fallback if JSON parse fails
    data = {
      openingLine: `${todayLabel()} — let's get to it.`,
      top3: input.tasks.slice(0, 3).map(t => ({ task: t.title, source: 'Task' })),
      looseEnd: null,
      habits: activeHabits.map(h => ({
        name: h.title,
        streak: h.streak,
        status: h.completedDates.includes(today) ? 'done' : h.streak > 0 ? 'at_risk' : 'on_track',
      })),
      patternCallout: null,
    };
  }

  return data;
}
