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

export async function* streamChat(
  messages: Message[],
  signal?: AbortSignal,
): AsyncGenerator<string> {
  const headers = await getAuthHeader();

  const response = await fetch(`${API_BASE}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify({ messages }),
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
