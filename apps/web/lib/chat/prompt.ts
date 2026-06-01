/**
 * Pure system-prompt assembly for the chat route. Every string here is part of
 * the model prompt (i.e. functional) and is reproduced verbatim from the
 * original route. No I/O — inputs → string.
 */

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

export function buildGoogleDataBlock(gmailBlock: string, calendarBlock: string): string {
  return gmailBlock || calendarBlock
    ? `${gmailBlock}${calendarBlock}\n\nCRITICAL: Never invent, guess, or fabricate email senders, subjects, content, or calendar events. Only reference what is listed above. If asked about an email or event not in the list, say you don't see it in the last 10 days. NEVER suggest the user connect Gmail or Google — it is already connected. NEVER say you "can't see" or "don't have real-time access to" the calendar — you DO have it. The calendar data above is live and real-time. If no events are listed, that means there are genuinely no events scheduled for today.`
    : '';
}
