import { auth } from './firebase';

// expo-location is a NATIVE module. Require it lazily inside a try/catch so a
// JS reload before a native rebuild degrades to IP geolocation instead of
// crashing the whole app with "Cannot find native module 'ExpoLocation'".
function loadLocation(): typeof import('expo-location') | null {
  try { return require('expo-location'); } catch { return null; }
}

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
export type ChatImage = { base64: string; mimeType: string };
export type ChatOpts = {
  signal?: AbortSignal;
  goalContext?: GoalContext;
  projectContext?: ProjectContext;
  /** Attach an image to the last user message (sent as an AI-SDK image part). */
  image?: ChatImage;
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

export type CalEvent = { id: string; title: string; start: string; end?: string; allDay?: boolean };

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

// ── Briefing: news (server endpoint same as web) ──────────────────────────────
export type NewsItem = { title: string; url: string; snippet: string; image?: string | null };

export async function fetchNews(topic?: string): Promise<{ items: NewsItem[]; industry: string }> {
  const headers = await getAuthHeader();
  if (!headers.Authorization) return { items: [], industry: topic ?? '' };
  try {
    const qs = topic ? `?topic=${encodeURIComponent(topic)}` : '';
    const res = await fetch(`${API_BASE}/api/briefing/news${qs}`, { headers });
    if (!res.ok) return { items: [], industry: topic ?? '' };
    const d = await res.json();
    return { items: d.items ?? [], industry: d.industry ?? topic ?? '' };
  } catch {
    return { items: [], industry: topic ?? '' };
  }
}

// ── Weather (IP geolocation → open-meteo; no native location dep) ─────────────
export type Weather = { temp: number; unit: string; desc: string };
const WMO: Record<number, string> = {
  0: 'Clear sky', 1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast',
  45: 'Foggy', 48: 'Foggy', 51: 'Light drizzle', 53: 'Drizzle', 55: 'Heavy drizzle',
  61: 'Light rain', 63: 'Rain', 65: 'Heavy rain', 71: 'Light snow', 73: 'Snow', 75: 'Heavy snow',
  80: 'Rain showers', 81: 'Rain showers', 82: 'Heavy showers', 95: 'Thunderstorm',
};

export async function fetchWeather(): Promise<Weather | null> {
  let lat: number | undefined, lon: number | undefined;
  // Precise GPS first (if the native module is present + permission granted),
  // else fall back to IP geolocation.
  const Location = loadLocation();
  if (Location) {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low });
        lat = pos.coords.latitude; lon = pos.coords.longitude;
      }
    } catch { /* fall through */ }
  }
  if (lat == null || lon == null) {
    try {
      const geo = await fetch('https://ipapi.co/json/').then(r => r.json());
      lat = geo.latitude; lon = geo.longitude;
    } catch { return null; }
  }
  if (lat == null || lon == null) return null;
  try {
    const d = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&temperature_unit=fahrenheit`).then(r => r.json());
    const cw = d.current_weather;
    if (!cw) return null;
    return { temp: Math.round(cw.temperature), unit: '°F', desc: WMO[cw.weathercode] ?? 'Clear' };
  } catch {
    return null;
  }
}

export async function* streamChat(
  messages: Message[],
  opts: ChatOpts = {},
): AsyncGenerator<string> {
  const headers = await getAuthHeader();
  const { signal, goalContext, projectContext, image } = opts;

  // When an image is attached, rewrite the final user message into the AI-SDK
  // structured-content form ([{text},{image}]) — mirrors the web client.
  type OutPart = { type: 'text'; text: string } | { type: 'image'; image: string; mimeType: string };
  type OutMessage = { role: Message['role']; content: string | OutPart[] };
  let outgoing: OutMessage[] = messages;
  if (image) {
    outgoing = messages.map((m, i) => {
      if (i !== messages.length - 1 || m.role !== 'user') return m;
      const text = typeof m.content === 'string' ? m.content : '';
      const parts: OutPart[] = [];
      if (text.trim()) parts.push({ type: 'text', text });
      parts.push({ type: 'image', image: image.base64, mimeType: image.mimeType });
      return { role: m.role, content: parts };
    });
  }

  const response = await fetch(`${API_BASE}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify({
      messages: outgoing,
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
