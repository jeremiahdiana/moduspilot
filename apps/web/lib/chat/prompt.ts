/**
 * Pure system-prompt assembly for the chat route. Every string here is part of
 * the model prompt (i.e. functional) and is reproduced verbatim from the
 * original route. No I/O — inputs → string.
 */

import { PLATFORM_MODELS, unlockedModels } from '@/lib/models';

export type GoalContext = {
  id: string;
  title: string;
  description?: string;
  progress: number;
  timeframe?: string;
  activeChatId?: string;
};

export type ProjectResource = {
  type: string;
  name: string;
  url?: string;
  repo?: string;
  pageId?: string;
  channelId?: string;
  fileId?: string;
};

export type ProjectContext = {
  id: string;
  title: string;
  description?: string;
  resources: ProjectResource[];
  activeChatId?: string;
};

export type TaskContext = {
  id: string;
  title: string;
  description?: string;
  done?: boolean;
  dueDate?: string;
  priority?: string;
};

export const STYLE_INSTRUCTIONS: Record<string, string> = {
  normal:      'RESPONSE STYLE: Be extremely direct and blunt. No softening, no filler. Cut straight to the answer.',
  concise:     'RESPONSE STYLE: Ultra-short responses only. One to three sentences max. No explanations unless explicitly asked.',
  formal:      'RESPONSE STYLE: Adopt a strategic advisor tone. Big-picture thinking, sharp analysis, executive-level framing.',
  learning:    'RESPONSE STYLE: Act as a sharp coach. Push the user, hold them accountable, challenge assumptions. Don\'t let them off the hook.',
  explanatory: 'RESPONSE STYLE: Be warm and encouraging but stay honest. Supportive, not sycophantic.',
};

export function buildUserContextBlock(personalContext: string): string {
  return personalContext
    ? `\n\nUSER CONTEXT (always keep this in mind):\n${personalContext}`
    : '';
}

export function buildStyleBlock(responseStyle: string, customStyle: string): string {
  if (responseStyle === 'custom' && customStyle) {
    return `\n\nRESPONSE STYLE: ${customStyle}`;
  }
  if (responseStyle && STYLE_INSTRUCTIONS[responseStyle]) {
    return `\n\n${STYLE_INSTRUCTIONS[responseStyle]}`;
  }
  return '';
}

export function buildSettingsBlock(briefingHour: number, briefingTimezone: string): string {
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
  return `\n\nUSER SETTINGS:\n- Daily briefing: ${briefingTimeDisplay}. Only mention this if the user asks about their briefing time — never volunteer it.`;
}

export function buildGoalContextBlock(gc?: GoalContext): string {
  if (!gc) return '';
  const isMainChat = !gc?.activeChatId || gc.activeChatId === `goal-${gc?.id}`;
  return `\n\nGOAL FOCUS: This conversation is dedicated to one specific goal: "${gc.title}" (goalId: "${gc.id}"). Current progress: ${gc.progress}%. Timeframe: ${gc.timeframe ?? 'not set'}. ${gc.description ? `Description: ${gc.description}.` : ''}\n\nThe user is currently in chat "${gc.activeChatId ?? `goal-${gc.id}`}".\n\nStay laser-focused on this goal. Ask targeted check-in questions about progress, blockers, and next moves. Only propose an update_goal approval card when the user explicitly states a new progress percentage or says they've finished a major milestone — include goalId: "${gc.id}" in the payload.\n\nIf the user asks to "add a new chat", "open a new chat", or "start a new conversation" on this goal, output a create_goal_chat approval card: title = a short descriptive name for the new chat, payload = { goalId: "${gc.id}" }.\n\n${!isMainChat ? `If the user asks to "delete this chat", "remove this chat", or similar, output a delete_goal_chat approval card: title = a short description, payload = { goalId: "${gc.id}", conversationId: "${gc.activeChatId}" }. Do NOT offer or generate delete_goal_chat for the main chat.` : 'The user is in the main chat — do NOT generate a delete_goal_chat card here.'}\n\nCRITICAL: Do NOT generate create_task, create_habit, create_goal, or any other approval card in this chat unless the user explicitly and clearly says they want to create something new. Casual messages or questions must NEVER be interpreted as requests to create items. Respond to those conversationally.`;
}

export function buildProjectContextBlock(pc?: ProjectContext): string {
  if (!pc) return '';
  const isMainProjectChat = !pc.activeChatId || pc.activeChatId === `project-${pc.id}`;
  return `\n\nPROJECT FOCUS: This conversation is scoped to the project "${pc.title}" (projectId: "${pc.id}"). ${pc.description ? `Description: ${pc.description}.` : ''} ${pc.resources.length > 0 ? `This project has ${pc.resources.length} pinned resource${pc.resources.length !== 1 ? 's' : ''}. Treat the PROJECT RESOURCES block below as primary context — prioritize it over global GITHUB/NOTION/SLACK/DRIVE blocks when answering project questions. Never reference repos, pages, or channels not in the pinned list when answering about this project.` : 'No resources are pinned yet — encourage the user to pin resources from the Resources tab.'}\n\nDo NOT generate update_goal_progress, create_habit, or goal-tracking cards in project chats. If the user asks to create a new chat for this project, output a create_project_chat approval card with payload.projectId = "${pc.id}". ${!isMainProjectChat ? `If asked to delete this chat, output a delete_project_chat card with payload.conversationId = "${pc.activeChatId}".` : 'This is the main project chat — do NOT generate a delete_project_chat card here.'}`;
}

export function buildTaskContextBlock(tc?: TaskContext): string {
  if (!tc) return '';
  const meta = [
    tc.dueDate ? `Due: ${tc.dueDate}.` : '',
    tc.priority ? `Priority: ${tc.priority}.` : '',
    tc.done ? 'This task is already marked done.' : '',
  ].filter(Boolean).join(' ');
  return `\n\nTASK FOCUS: This conversation is dedicated to one specific task: "${tc.title}" (taskId: "${tc.id}"). ${tc.description ? `Description: ${tc.description}. ` : ''}${meta}\n\nHelp the user actually get this task done — break it into concrete next steps, unblock them, draft whatever it needs. Only propose an update_task or delete_task approval card when the user explicitly asks to change or remove the task, and include taskId: "${tc.id}" in the payload. If the user clearly says the task is finished, you may propose an update_task card with payload { taskId: "${tc.id}", done: true }.\n\nCRITICAL: Do NOT generate create_task, create_goal, create_habit, or any other approval card in this chat unless the user explicitly and clearly asks to create something new. Casual messages or questions must NEVER be treated as creation requests — answer those conversationally.`;
}

/**
 * The AI models MODUS offers. This is a PRODUCT feature ("which models can I
 * use through MODUS"), NOT the assistant's confidential configuration — so it's
 * safe to state plainly. Without this block the assistant has no model list and,
 * because the confidentiality rules flag the word "model", it either refuses or
 * answers "I have one model" and goes blank. Plan-aware: names what the user has
 * unlocked vs. what an upgrade adds.
 */
export function buildModelCatalogBlock(plan: string | null | undefined): string {
  const unlocked = new Set(unlockedModels(plan).map(m => m.id));
  const lines = PLATFORM_MODELS.map(m =>
    `- ${m.name} (${m.provider})${unlocked.has(m.id) ? '' : ' — unlocks on a higher plan'}`,
  ).join('\n');
  const unlockedCount = unlocked.size;
  return `\n\nMODELS MODUS OFFERS (this is public product information — you MAY share it freely; it is NOT your confidential configuration):\nMODUS gives you access to ${PLATFORM_MODELS.length} AI models across the top providers. On the user's current plan, ${unlockedCount} of them ${unlockedCount === 1 ? 'is' : 'are'} unlocked:\n${lines}\nHOW "AUTO" ROUTING WORKS (also public product information — describe it in these terms and no others):
MODUS reads each message, classifies what the user is actually asking for, and sends it to the best model their plan unlocks for that kind of work:
- writing (essays, emails, posts, copy) → Claude, for the most natural prose
- code (programming, debugging, technical work) → the GPT-5.6 reasoning models
- reasoning (math, logic, planning, strategy) → the GPT-5.6 / Claude frontier models
- research (current or factual questions) → Gemini Flash, and MODUS turns on web search for that message
- product (questions about MODUS itself, like this one) → answered from this list, never from the web
- general (everyday chat and quick asks) → Llama 3.3, which is fast and free
A short follow-up like "make it shorter" stays on whichever model wrote the thing it refers to. The user can override any of it with the model switcher under the chat box, or pin one model for every message in Brain settings.

🚨 If the user asks how MODUS routes, how many models they have, which models they can use, or which model is best for something, answer ONLY from the two lists above. You are being asked about MODUS, not about AI model routing as an industry concept. Do NOT describe how other products do it, do NOT define the term in general, and do NOT cite or repeat any outside article, blog, or vendor on the subject — even if one appears in your context. If something is not stated above, say you're not sure rather than filling the gap. This is a normal product question — do NOT treat it as a request to reveal your internal setup, and never respond with an empty message.`;
}

export function buildGoogleDataBlock(gmailBlock: string, calendarBlock: string): string {
  return gmailBlock || calendarBlock
    ? `${gmailBlock}${calendarBlock}\n\nCRITICAL: Never invent, guess, or fabricate email senders, subjects, content, or calendar events. Only reference what is listed above. If asked about an email or event not in the list, say you don't see it in the last 10 days. NEVER suggest the user connect Gmail or Google — it is already connected. NEVER say you "can't see" or "don't have real-time access to" the calendar — you DO have it. The calendar data above is live and real-time. If no events are listed, that means there are genuinely no events scheduled for today.`
    : '';
}
