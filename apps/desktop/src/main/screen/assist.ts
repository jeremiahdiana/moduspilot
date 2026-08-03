import log from 'electron-log';
import { getIdToken } from '../sync/ingest';

/**
 * Asks MODUS about a captured screen.
 *
 * Deliberately thin. It calls the SAME https://moduspilot.com/api/chat that the
 * web app calls, with the same Bearer token the sync agent already uses, carrying
 * the same `{ type: 'image' }` message part the chat UI already builds. So the
 * overlay inherits the plan gate, the model switcher, the token accounting, the
 * failover chain and the vision routing for free — and there is exactly one place
 * where any of that can be got wrong.
 *
 * Nothing here re-implements auth, picks a model, or writes to Firestore.
 */

const CHAT_URL = 'https://moduspilot.com/api/chat';

export interface AssistEvents {
  onDelta(text: string): void;
  /** The model that really answered, from the stream's own annotation. */
  onModel(modelId: string): void;
  onDone(): void;
  onError(err: AssistError): void;
  /**
   * The request was cancelled by us (new question, dismissed panel).
   *
   * Separate from onError because there is nothing wrong and nothing to tell the
   * user — but SOMETHING has to fire, or the caller's "busy" state never clears.
   */
  onAborted(): void;
}

export interface AssistError {
  /** Machine-readable so the overlay can style/act, not just print. */
  kind: 'signed-out' | 'no-subscription' | 'limit' | 'offline' | 'server';
  message: string;
}

/**
 * HTTP status → what the user should actually be told.
 *
 * These are not hypothetical: /api/chat 401s without a valid token,
 * enforceSubscriptionGate 402s an account with no card, and
 * enforcePaidTokenLimit 429s a plan that has hit its ceiling. An overlay that
 * renders nothing on any of them is the blank-bubble failure this codebase has
 * already paid for twice — every one of these must produce visible words.
 */
function errorForStatus(status: number, body: string): AssistError {
  if (status === 401) {
    return { kind: 'signed-out', message: 'Open MODUS and sign in, then try again.' };
  }
  if (status === 402) {
    return { kind: 'no-subscription', message: 'Your trial or subscription has ended. Open MODUS to restart it.' };
  }
  if (status === 429) {
    return { kind: 'limit', message: "You've reached your plan's limit for now. It resets shortly." };
  }
  log.error(`[assist] chat API ${status}: ${body.slice(0, 300)}`);
  return { kind: 'server', message: `MODUS could not answer (${status}). Try again in a moment.` };
}

/**
 * Parse the AI SDK data-stream protocol.
 *
 * 🪤 /api/chat returns result.toDataStreamResponse() — NOT plain text. The body is
 * newline-delimited `<code>:<json>` frames, so anything that just decodes the
 * bytes and prints them renders `0:"Here"0:"'s"` at the user. Only a few codes
 * matter here:
 *
 *   0: text delta                 → the answer
 *   g: reasoning delta            → hidden thinking; must NOT be shown as answer text
 *   8: message annotations        → carries modusServedModel (who really answered)
 *   3: error                      → the route's own error message
 *   d: finish
 *
 * Unknown codes are ignored on purpose: the protocol gains codes between SDK
 * versions, and an unrecognised frame is not a reason to fail a request.
 */
export function handleFrame(line: string, events: AssistEvents): void {
  const sep = line.indexOf(':');
  if (sep < 1) return;
  const code = line.slice(0, sep);
  const raw = line.slice(sep + 1);
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return; // a partial frame; the buffering in ask() means this should not happen
  }

  switch (code) {
    case '0':
      if (typeof value === 'string') events.onDelta(value);
      break;
    case '3':
      events.onError({ kind: 'server', message: typeof value === 'string' ? value : 'Something went wrong.' });
      break;
    case '8':
      if (Array.isArray(value)) {
        for (const a of value) {
          if (a && typeof a === 'object' && typeof (a as { modusServedModel?: unknown }).modusServedModel === 'string') {
            events.onModel((a as { modusServedModel: string }).modusServedModel);
          }
        }
      }
      break;
    default:
      break;
  }
}

/**
 * One turn of the conversation, in the shape /api/chat wants (CoreMessage).
 *
 * The image rides on the USER turn that it was captured for, and only that one.
 */
export type AssistTurn =
  | { role: 'user'; content: Array<{ type: 'image'; image: string } | { type: 'text'; text: string }> }
  | { role: 'assistant'; content: string };

/**
 * Turns raw stream chunks into whole frames.
 *
 * 🪤 A NETWORK CHUNK IS NOT A FRAME. Chunks arrive at whatever size the transport
 * feels like, so `0:"Here is what` and ` I can see"\n` routinely arrive as two
 * reads — and JSON.parse on the first half throws. The trailing partial line MUST
 * stay in the buffer until its newline turns up. Getting this wrong does not
 * crash: it silently drops whichever tokens happened to straddle a chunk
 * boundary, so answers come out subtly missing words on slow connections and
 * look fine on a fast one.
 *
 * Extracted from ask() purely so it can be tested against deliberately hostile
 * chunk splits, which is not something a live request will reliably reproduce.
 */
export function createFrameParser(events: AssistEvents): { push(chunk: string): void; flush(): void } {
  let buffer = '';
  return {
    push(chunk: string): void {
      buffer += chunk;
      let nl: number;
      while ((nl = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, nl);
        buffer = buffer.slice(nl + 1);
        if (line.length > 0) handleFrame(line, events);
      }
    },
    flush(): void {
      const rest = buffer.trim();
      buffer = '';
      if (rest.length > 0) handleFrame(rest, events);
    },
  };
}

/**
 * The model watch mode is pinned to.
 *
 * 💸 NOT the user's Brain, and that is deliberate. An unattended "did anything
 * here need me?" glance does not need a frontier model, but it was getting one:
 * a saved Brain of `auto` routes to Claude Sonnet 5, whose budget weight is 9x
 * Gemini Flash's 1x. Watch was therefore spending nine times what the job costs,
 * unattended, on a loop, while the user was not even looking at the screen.
 *
 * Gemini 3.5 Flash is weight 1 — the cheapest thing in the catalog — and is
 * verified vision-capable (scripts/verify-vision-routing.ts). It is available on
 * every paid plan, so this never trips the tier gate.
 */
export const WATCH_MODEL = 'gemini-3.5-flash';

export interface AskOptions {
  /** Skip the life-OS context assembly server-side. See body.screenMode. */
  screenMode?: boolean;
  /** Pin this request to a specific model, regardless of the saved Brain. */
  modelChoice?: string;
  /**
   * The WHOLE conversation so far, ending with the new user turn.
   *
   * 🪤 This used to be a single message built fresh on every ask, which meant the
   * panel had no memory whatsoever: "what does this error mean?" then "how do I
   * fix it?" and the second question arrived with no image, no first question and
   * no answer — so the model was being asked to fix something it had never seen.
   * It looked like the model being stupid; it was the client throwing the
   * conversation away between turns.
   */
  messages: AssistTurn[];
  /** Abort when the user dismisses the overlay or fires a new capture. */
  signal?: AbortSignal;
}

/**
 * The instruction that turns "here is a picture" into "help me with this".
 *
 * Kept short on purpose — /api/chat already assembles a large system prompt with
 * the user's own context, and piling a second persona on top of it fights that
 * rather than adding to it.
 *
 * ⚠️ Attached to the FIRST user turn only (see buildTurn). Repeating it on every
 * follow-up re-instructs the model to describe the screen when the user has moved
 * on to "ok now fix it", and pays for the tokens again each time.
 */
export const SCREEN_PROMPT =
  'This is a screenshot of what I am looking at right now. '
  + 'Use it as the primary context for my question. '
  + 'Be direct and specific about what is actually on the screen — quote exact text, names and values you can see. '
  + 'If the screen does not contain what you would need to answer, say so plainly instead of guessing.';

export const DEFAULT_QUESTION = "What's on my screen, and what should I do next?";

/**
 * Build one user turn.
 *
 * `image` is passed only when this turn is about a NEWLY captured frame. A
 * follow-up about the same screen must not re-send it: the provider still has it
 * in context from the earlier turn, so resending is a second full image billed as
 * input tokens for no added information.
 */
export function buildTurn(question: string, image?: string, withPrompt = false): AssistTurn {
  const text = question.trim() || DEFAULT_QUESTION;
  const content: Array<{ type: 'image'; image: string } | { type: 'text'; text: string }> = [];
  // Image FIRST, then the text. Same order the web chat builds (ChatWindow.tsx),
  // and the order every provider documents for "answer about this image".
  if (image) content.push({ type: 'image', image });
  content.push({ type: 'text', text: withPrompt ? `${SCREEN_PROMPT}\n\n${text}` : text });
  return { role: 'user', content };
}

/**
 * The instruction for a watch-mode turn, which compares TWO frames.
 *
 * 🚨 THE ACCURACY BUG THIS FIXES. Watch mode used to send ONE screenshot — the
 * new one — with the words "the screen just changed, say what changed". The model
 * had never seen the previous state, so it could not possibly know what changed.
 * It did the only thing it could: describe the current screen and invent a
 * transition to justify the question. Every watch answer was partly fabricated,
 * and it read as the model hallucinating when in fact it had been asked an
 * unanswerable question.
 *
 * MODUS is not streaming video and cannot; what it can do honestly is hold the
 * last frame and show the model both. That is a real before/after comparison
 * rather than a guess dressed up as one.
 */
export const WATCH_PROMPT =
  'These are two screenshots of my screen: the FIRST is how it looked before, the SECOND is how it looks now. '
  + 'Compare them and tell me, in one or two sentences, what actually changed and whether it needs my attention. '
  + 'Only describe differences you can genuinely see between the two images — do not guess at what might have happened. '
  + 'If nothing meaningful changed, reply with exactly "nothing to flag".';

/** A watch turn: before frame, after frame, then the comparison instruction. */
export function buildWatchTurn(before: string | undefined, after: string): AssistTurn {
  const content: Array<{ type: 'image'; image: string } | { type: 'text'; text: string }> = [];
  if (before) content.push({ type: 'image', image: before });
  content.push({ type: 'image', image: after });
  content.push({
    type: 'text',
    // With no previous frame there is nothing to compare, so ask the honest
    // question instead of pretending there is a before.
    text: before
      ? WATCH_PROMPT
      : 'This is my screen right now. In one or two sentences, say whether anything here needs my attention. '
        + 'If not, reply with exactly "nothing to flag".',
  });
  return { role: 'user', content };
}

/**
 * Keep the thread from growing without limit.
 *
 * 🚨 THE COST BUG THIS FIXES. Conversation history is re-sent in full on EVERY
 * request — that is how the model remembers. But the screenshots live in that
 * history too, so by turn six a follow-up was re-uploading every screenshot taken
 * so far, each one billed again as input tokens. Ten questions about three
 * screenshots is not three images; it is closer to thirty.
 *
 * Two rules:
 *   1. Only the MOST RECENT image survives. Older turns keep their text (which is
 *      what the model needs for continuity) and lose their picture. The current
 *      screen is what a follow-up is about; the one from four questions ago is
 *      being paid for and ignored.
 *   2. Hard cap on turns, keeping the newest. The first user turn is preserved
 *      because it carries the framing instruction that set up the whole thread.
 *
 * apps/web has its own trim for the same reason (verify-message-trim) — this is
 * the desktop's, and it exists for the same reason that one does.
 */
export const MAX_TURNS = 12;

export function trimForRequest(messages: AssistTurn[]): AssistTurn[] {
  // Newest image-bearing turn wins, and it keeps ALL of its images — a watch turn
  // legitimately carries two (before and after), and stripping one of them would
  // silently turn the comparison back into the guess this was built to stop.
  let lastImageIdx = -1;
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.role === 'user' && m.content.some((c) => c.type === 'image')) { lastImageIdx = i; break; }
  }

  const stripped = messages.map((m, i) => {
    if (m.role !== 'user' || i === lastImageIdx) return m;
    const withoutImage = m.content.filter((c) => c.type !== 'image');
    // Never produce an empty content array — a user turn with no parts at all is
    // rejected by the API rather than merely being cheaper.
    return withoutImage.length > 0 ? { ...m, content: withoutImage } : m;
  });

  if (stripped.length <= MAX_TURNS) return stripped;
  const head = stripped[0];
  let tail = stripped.slice(stripped.length - (MAX_TURNS - 1));
  if (tail[0] === head) return tail;

  // 🪤 ROLES MUST ALTERNATE. head is always a user turn, so if the tail also opens
  // with one the result is user,user,… — and Anthropic rejects non-alternating
  // roles outright with a 400. That would have surfaced as "the panel just stops
  // working once a conversation gets long", on Claude only, which is the hardest
  // possible shape of bug to attribute. Drop one more from the front so the tail
  // opens on an assistant turn.
  if (tail[0].role === 'user') tail = tail.slice(1);
  if (tail.length === 0) return [head];

  // Dropping the head would drop the SCREEN_PROMPT framing with it, and a thread
  // that suddenly forgets it is looking at a screenshot answers noticeably worse.
  return [head, ...tail];
}

export async function ask(opts: AskOptions, events: AssistEvents): Promise<void> {
  const token = await getIdToken();
  if (!token) {
    // Distinct from a 401: there is no signed-in window to take a token from at
    // all, e.g. the user never signed in or the window is still loading.
    events.onError({ kind: 'signed-out', message: 'Open MODUS and sign in, then try again.' });
    return;
  }

  let res: Response;
  try {
    res = await fetch(CHAT_URL, {
      method: 'POST',
      signal: opts.signal,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        messages: trimForRequest(opts.messages),
        ...(opts.modelChoice ? { modelChoice: opts.modelChoice } : {}),
        // Ask the route to skip the life-OS context assembly. A question about a
        // screenshot does not need the user's inbox, calendar, Apple Notes,
        // iMessage, contacts, long-term memory or Notion/Slack/GitHub/Drive — and
        // that bundle was ~5.6k tokens and several network round trips on EVERY
        // message, which on a $24 plan's 500k/day ceiling is real money and real
        // latency spent on nothing. See body.screenMode in app/api/chat/route.ts.
        screenMode: true,
      }),
    });
  } catch (err) {
    // An abort is the caller's own doing, so it needs no error message — but it
    // DOES need a terminal event. Returning silently left the panel showing
    // "Stop" with nothing running, and the only way out was to close it.
    if ((err as Error)?.name === 'AbortError') { events.onAborted(); return; }
    log.error('[assist] request failed', err);
    events.onError({ kind: 'offline', message: 'No connection to MODUS. Check your network.' });
    return;
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    events.onError(errorForStatus(res.status, body));
    return;
  }
  if (!res.body) {
    events.onError({ kind: 'server', message: 'MODUS returned an empty response.' });
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  const frames = createFrameParser(events);
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      frames.push(decoder.decode(value, { stream: true }));
    }
    frames.flush();
    events.onDone();
  } catch (err) {
    if ((err as Error)?.name === 'AbortError') { events.onAborted(); return; }
    log.error('[assist] stream failed', err);
    events.onError({ kind: 'server', message: 'The answer was cut off. Try again.' });
  }
}
