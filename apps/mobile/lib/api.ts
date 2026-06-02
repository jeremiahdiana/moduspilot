import { auth } from './firebase';

export const API_BASE = 'https://app.moduspilot.com';

export async function getAuthHeader(): Promise<Record<string, string>> {
  const user = auth.currentUser;
  if (!user) return {};
  const token = await user.getIdToken();
  return { Authorization: `Bearer ${token}` };
}

export type Message = {
  role: 'user' | 'assistant' | 'system';
  content: string;
};

// Scoped-chat context — mirrors the web goal/project detail chat body, so the
// server builds a goal/project-aware system prompt.
export type GoalContext = { id: string; title: string; description?: string; progress?: number };
export type ProjectContext = { id: string; title: string; description?: string; status?: string };
export type ChatOpts = {
  signal?: AbortSignal;
  goalContext?: GoalContext;
  projectContext?: ProjectContext;
};

// ── Google: today's inbox + calendar (same endpoints the web dashboard uses) ──

export type InboxThread = {
  id: string;
  from: string;
  subject: string;
  snippet: string;
  date: string;
  unread: boolean;
  accountEmail?: string;
};

export async function fetchInbox(
  filter: 'primary' | 'all' = 'primary',
): Promise<{ threads: InboxThread[]; notConnected: boolean }> {
  const headers = await getAuthHeader();
  if (!headers.Authorization) return { threads: [], notConnected: true };
  try {
    const res = await fetch(`${API_BASE}/api/google/inbox?filter=${filter}`, { headers });
    if (!res.ok) return { threads: [], notConnected: false };
    const data = await res.json();
    return { threads: data.threads ?? [], notConnected: !!data.notConnected };
  } catch {
    return { threads: [], notConnected: false };
  }
}

export type CalEvent = { id: string; title: string; start: string };

export async function fetchTodayEvents(): Promise<{ events: CalEvent[]; notConnected: boolean }> {
  const headers = await getAuthHeader();
  if (!headers.Authorization) return { events: [], notConnected: true };
  try {
    const res = await fetch(`${API_BASE}/api/google/today`, { headers });
    if (!res.ok) return { events: [], notConnected: false };
    const data = await res.json();
    return { events: data.events ?? [], notConnected: !!data.notConnected };
  } catch {
    return { events: [], notConnected: false };
  }
}

export async function* streamChat(
  messages: Message[],
  opts: ChatOpts = {},
): AsyncGenerator<string> {
  const headers = await getAuthHeader();
  const { signal, goalContext, projectContext } = opts;

  const response = await fetch(`${API_BASE}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify({
      messages,
      ...(goalContext ? { goalContext } : {}),
      ...(projectContext ? { projectContext } : {}),
    }),
    signal,
  });

  if (!response.ok || !response.body) {
    const err = await response.text().catch(() => 'Unknown error');
    throw new Error(err);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      // Vercel AI SDK data stream: lines like `0:"text chunk"`
      if (line.startsWith('0:')) {
        try {
          const text: string = JSON.parse(line.slice(2));
          yield text;
        } catch {
          // malformed chunk — skip
        }
      }
    }
  }
}
