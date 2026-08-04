'use client';

import { useChat } from 'ai/react';
import MessageBubble, { extractTextContent } from './MessageBubble';
import ChatInput from './ChatInput';
import CompareCard from './CompareCard';
import { useRef, useEffect, useState, useMemo } from 'react';
import Image from 'next/image';
import type { Message } from 'ai';
import { auth } from '@/lib/firebase';
import { useAuth } from '@/components/providers/AuthProvider';
import { modelName, unlockedModels } from '@/lib/models';
import { isAwaitingAssistantText } from '@/lib/chat/pending';
import { readWebSearchAnnotation } from '@/lib/chat/annotations';
import { motion, AnimatePresence } from 'framer-motion';

interface ConnectedServices {
  google: boolean; notion: boolean; slack: boolean; github: boolean; contacts: boolean;
}

// Reads the auto-routed model id stashed on a message's annotations (persisted to
// Firestore), so the "MODUS routed this to <model>" chip survives a reload.
//
// NOTE: this is the model Auto INTENDED, taken from the x-modus-model header. The
// header is written before the answer starts, so it cannot know if the failover
// chain later switched models — see readServedAnnotation, which outranks it.
function readRoutedAnnotation(m: Message): string | undefined {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const anns = (m as any).annotations as any[] | undefined;
  if (!Array.isArray(anns)) return undefined;
  for (const a of anns) {
    if (a && typeof a === 'object' && typeof a.modusRoutedModel === 'string') return a.modusRoutedModel;
  }
  return undefined;
}

interface ServedAnnotation {
  /** The model that actually produced this answer. */
  served: string;
  /** The model we asked for first, and told the client about via the header. */
  requested: string;
  /** True when `requested` was a model we explicitly promised the user. */
  downgraded: boolean;
}

/**
 * Reads the server's record of which model REALLY answered. Written by the chat
 * route only when the failover chain had to switch models mid-answer, which no
 * response header can report (headers are built before the first token).
 *
 * This is the authority. Where it disagrees with the header-derived routed model,
 * the header is describing a request that didn't happen.
 */
function readServedAnnotation(m: Message): ServedAnnotation | undefined {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const anns = (m as any).annotations as any[] | undefined;
  if (!Array.isArray(anns)) return undefined;
  for (const a of anns) {
    if (a && typeof a === 'object' && typeof a.modusServedModel === 'string') {
      return {
        served: a.modusServedModel,
        requested: typeof a.modusRequestedModel === 'string' ? a.modusRequestedModel : '',
        downgraded: a.modusDowngraded === true,
      };
    }
  }
  return undefined;
}

/** A message's plain text, whether it's a bare string or multimodal parts. */
function messageText(m: Message): string {
  if (typeof m.content === 'string') return m.content;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const parts = m.content as any[];
  if (!Array.isArray(parts)) return '';
  return parts.filter(p => p.type === 'text').map(p => p.text as string).join('\n');
}

/**
 * True when the newest message is MODUS asking a question and nothing has
 * answered it yet.
 *
 * The card's answer arrives as a real user turn, so "the last message still
 * carries the question block" IS "unanswered" — no cross-component state needed.
 * The composer uses this to say the question is waiting, rather than letting the
 * user type straight past it and leave the card stranded mid-stepper.
 */
function hasOpenQuestion(messages: Message[]): boolean {
  const last = messages[messages.length - 1];
  if (!last || last.role !== 'assistant') return false;
  return /```(options|draft_options)\n/.test(messageText(last));
}

function timeGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

/**
 * Usage is only worth saying once it changes what you'd do. Below this it is
 * noise, and a meter that is always on screen turns "you have plenty left" into
 * a thing to watch while you type.
 */
const USAGE_NOTICE_AT = 75;
/** Past this the tone stops being informational — you are about to be cut off. */
const USAGE_URGENT_AT = 90;
/** How long the notice stays before it gets out of the way. */
const USAGE_NOTICE_MS = 6000;

type SmartPrompt = { text: string; icon: PromptIconName };

function getSmartPrompts(svc: ConnectedServices): SmartPrompt[] {
  const prompts: SmartPrompt[] = [];
  if (svc.google)   prompts.push({ text: "What's on my calendar today?", icon: 'calendar' }, { text: 'Any important emails?', icon: 'mail' });
  if (svc.notion)   prompts.push({ text: 'Search my Notion notes', icon: 'doc' });
  if (svc.slack)    prompts.push({ text: 'Catch me up on Slack', icon: 'chat' });
  if (svc.github)   prompts.push({ text: 'What are my open pull requests?', icon: 'branch' });
  if (svc.contacts) prompts.push({ text: 'Who do I know at [company]?', icon: 'people' });
  if (prompts.length === 0) {
    return [
      { text: 'Help me plan my day', icon: 'calendar' },
      { text: 'Generate an image',   icon: 'image' },
      { text: 'Make a PDF',          icon: 'doc' },
      { text: 'Set a goal',          icon: 'target' },
    ];
  }
  // Keep a generation prompt discoverable alongside connected-service prompts.
  prompts.push({ text: 'Generate an image', icon: 'image' });
  return prompts.slice(0, 4);
}

type PromptIconName = 'calendar' | 'mail' | 'doc' | 'chat' | 'branch' | 'people' | 'image' | 'target';

/** Line icons only — a filled or coloured glyph here would out-shout the text. */
function PromptIcon({ name }: { name: PromptIconName }) {
  const paths: Record<PromptIconName, React.ReactNode> = {
    calendar: <><rect x="3" y="4.5" width="18" height="16" rx="2" /><path d="M3 9.5h18M8 2.5v4M16 2.5v4" /></>,
    mail:     <><rect x="2.5" y="5" width="19" height="14" rx="2" /><path d="M3 7l9 6 9-6" /></>,
    doc:      <><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5" /></>,
    chat:     <path d="M21 11.5a7.5 7.5 0 0 1-9.9 7.1L4 21l1.5-5.4A7.5 7.5 0 1 1 21 11.5z" />,
    branch:   <><circle cx="6.5" cy="5.5" r="2.2" /><circle cx="6.5" cy="18.5" r="2.2" /><circle cx="17.5" cy="8.5" r="2.2" /><path d="M6.5 7.7v8.6M17.5 10.7c0 4-4.4 3.3-11 5.6" /></>,
    people:   <><circle cx="9" cy="8" r="3.2" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0M17 11.2A3.2 3.2 0 0 0 17 5M18.5 20a6.2 6.2 0 0 0-3-5.3" /></>,
    image:    <><rect x="3" y="4.5" width="18" height="15" rx="2" /><circle cx="8.5" cy="10" r="1.6" /><path d="M21 16l-5-5-8 8.5" /></>,
    target:   <><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="4" /><circle cx="12" cy="12" r="0.6" /></>,
  };
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className="w-[18px] h-[18px] shrink-0">
      {paths[name]}
    </svg>
  );
}

interface Props {
  conversationId: string | null;
  initialMessages?: Message[];
  initialInput?: string;
  onMessagesChange?: (messages: Message[], title?: string) => void;
  onUserMessage?: () => void;
  isGuest?: boolean;
  isAtLimit?: boolean;
  onShowPaywall?: () => void;
  personalContext?: string;
  responseStyle?: string;
  customStyle?: string;
  briefingHour?: number;
  briefingTimezone?: string;
  plan?: string;
  /** The saved default Brain ('auto' | model id | 'default' for BYOK). */
  defaultModelChoice?: string;
  /** Persist a composer model change as the account default (synced to the Brain page). */
  onModelChoiceChange?: (value: string) => void;
}

export default function ChatWindow({
  conversationId,
  initialMessages = [],
  initialInput,
  onMessagesChange,
  onUserMessage,
  isGuest,
  isAtLimit,
  onShowPaywall,
  personalContext,
  responseStyle,
  customStyle,
  briefingHour,
  briefingTimezone,
  plan,
  defaultModelChoice = 'auto',
  onModelChoiceChange,
}: Props) {
  const { user } = useAuth();
  const firstName = user?.displayName?.trim().split(/\s+/)[0] ?? '';
  const [attachedImage, setAttachedImage] = useState<{ base64: string; mimeType: string } | null>(null);
  const [attachedFiles, setAttachedFiles] = useState<{ name: string; text: string }[]>([]);
  const [webSearchOn, setWebSearchOn] = useState(false);
  // Compare mode: the next message is answered by 3 models side by side.
  // compare !== null is what mounts the card. It carries its own id because the
  // prompt alone can't key the card — asking the same question twice would reuse
  // the component and replay the first run's state.
  const [compareOn, setCompareOn] = useState(false);
  const [compare, setCompare] = useState<{ prompt: string; id: string } | null>(null);
  // The DEFAULT set only — the user picks the real one in ModelPicker. Seeded
  // with 3 unlocked models from DIFFERENT providers, since GPT-4o vs o4-mini
  // says much less than GPT-4o vs Claude vs Gemini.
  const defaultCompareModels = useMemo(() => {
    const unlocked = unlockedModels(plan);
    const picked: typeof unlocked = [];
    for (const m of unlocked) {
      if (picked.length >= 3) break;
      if (!picked.some(p => p.provider === m.provider)) picked.push(m);
    }
    for (const m of unlocked) {
      if (picked.length >= 3) break;
      if (!picked.includes(m)) picked.push(m);
    }
    return picked.map(m => m.id);
  }, [plan]);
  const [compareModels, setCompareModels] = useState<string[]>([]);

  // Restore the last picked set, dropping any model this plan no longer unlocks
  // (a downgrade would otherwise leave a locked model selected and 402 on send).
  useEffect(() => {
    const unlockedIds = unlockedModels(plan).map(m => m.id);
    let restored: string[] = [];
    try {
      const saved = JSON.parse(localStorage.getItem('modus:compareModels') ?? '[]') as unknown;
      if (Array.isArray(saved)) {
        restored = saved.filter((id): id is string => typeof id === 'string' && unlockedIds.includes(id)).slice(0, 3);
      }
    } catch { /* corrupt entry — fall through to the default */ }
    setCompareModels(restored.length >= 2 ? restored : defaultCompareModels);
  }, [plan, defaultCompareModels]);

  const toggleCompareModel = (id: string) => {
    setCompareModels(prev => {
      const next = prev.includes(id)
        ? prev.filter(m => m !== id)
        : prev.length >= 3 ? prev : [...prev, id];
      localStorage.setItem('modus:compareModels', JSON.stringify(next));
      return next;
    });
  };
  const [connectedServices, setConnectedServices] = useState<ConnectedServices | null>(null);
  // In-chat model selection ('auto' | model id | 'default'). Initialized from the
  // saved Brain (defaultModelChoice) and written back to it on change, so the
  // composer and the Brain settings page are one synced setting. The ref keeps the
  // value stable for the useChat request body (avoids stale closures).
  // 🧭 A MODEL PICK BELONGS TO THE CONVERSATION, NOT TO THE ACCOUNT.
  // The picker used to be bound to the saved Brain setting and wrote every
  // change back, so choosing Claude Sonnet once made it the default for every
  // future chat on every device. Auto is the product's own recommendation and
  // is what a new conversation should start from, so picking a model now
  // applies to THIS conversation only and is not persisted.
  const [modelChoice, setModelChoice] = useState('auto');
  const modelChoiceRef = useRef('auto');
  // Every new/switched conversation starts at Auto.
  useEffect(() => {
    setModelChoice('auto');
    modelChoiceRef.current = 'auto';
  }, [conversationId]);
  function handleModelChange(v: string) {
    setModelChoice(v);
    modelChoiceRef.current = v;
  }
  const inputAreaRef = useRef<HTMLTextAreaElement>(null);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const prevLoadingRef = useRef(false);
  const savedLengthRef = useRef(initialMessages.length);
  // When the composer is on "Auto", the server reports which model it picked via
  // the x-modus-model + x-modus-auto response headers. routedRef holds the pick
  // for the in-flight response; routedByMsgId maps it onto the assistant message
  // once it appears, driving the "MODUS routed this to <model>" chip.
  const routedRef = useRef<{ modelId: string; auto: boolean } | null>(null);
  const [routedByMsgId, setRoutedByMsgId] = useState<Record<string, string>>({});

  // The model Auto picked for the previous turn, sent with the next message so a
  // short follow-up ("make it shorter") isn't re-classified as generic chat and
  // demoted to the fast default. Only reports models Auto itself chose — an
  // explicit pick by the user is already carried by modelChoice.
  const lastAutoRoutedModel = () =>
    routedRef.current?.auto ? routedRef.current.modelId : undefined;

  // onIdTokenChanged fires on login AND whenever Firebase refreshes the token (~1h),
  // so requests stay authenticated without a page reload.
  useEffect(() => {
    const unsub = auth.onIdTokenChanged(async (user) => {
      if (user) setAuthToken(await user.getIdToken());
      else setAuthToken(null);
    });
    return unsub;
  }, []);

  // Fetch connector status once when empty state is visible — drives smart prompts
  useEffect(() => {
    if (!authToken || isGuest || messages.length > 0) return;
    let cancelled = false;
    Promise.all([
      fetch('/api/google/status',     { headers: { Authorization: `Bearer ${authToken}` } }).then(r => r.json()).catch(() => ({})),
      fetch('/api/connectors/status', { headers: { Authorization: `Bearer ${authToken}` } }).then(r => r.json()).catch(() => ({})),
      fetch('/api/mobile/status',     { headers: { Authorization: `Bearer ${authToken}` } }).then(r => r.json()).catch(() => ({})),
    ]).then(([g, c, m]) => {
      if (cancelled) return;
      setConnectedServices({
        google:   (g.accounts?.length  ?? 0) > 0,
        notion:   (c.notion?.length    ?? 0) > 0,
        slack:    (c.slack?.length     ?? 0) > 0,
        github:   (c.github?.length    ?? 0) > 0,
        contacts: (m.contacts?.count   ?? 0) > 0,
      });
    });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authToken, isGuest]);

  const [chatError, setChatError] = useState<string | null>(null);
  // Neutral (non-error) notice, e.g. when a premium model pick was unavailable
  // and MODUS answered with the fast default instead — surfaced so we never pass
  // Llama off as the model the user selected.
  const [modelNotice, setModelNotice] = useState<string | null>(null);

  // Plan usage, 0–100, from the x-modus-usage header. Only ever SHOWN past
  // USAGE_NOTICE_AT — below that it is a number nobody needs, and a permanent
  // meter on a chat screen is a reason to feel watched while you type.
  const [usagePct, setUsagePct] = useState<number | null>(null);
  const [usageDismissed, setUsageDismissed] = useState(false);

  // Show it, then get out of the way. Re-arms whenever the figure MOVES, so a
  // user who keeps going gets told again as they climb — but a stable number
  // does not keep interrupting.
  useEffect(() => {
    if (usagePct === null || usagePct < USAGE_NOTICE_AT) return;
    setUsageDismissed(false);
    const t = setTimeout(() => setUsageDismissed(true), USAGE_NOTICE_MS);
    return () => clearTimeout(t);
  }, [usagePct]);

  const { messages, input, handleInputChange, append, isLoading, setInput, setMessages, stop, reload } = useChat({
    api: '/api/chat',
    onResponse: (response) => {
      // Capture the model that will answer this message + whether Auto chose it.
      const routedModelId = response.headers.get('x-modus-model') || '';
      const auto = response.headers.get('x-modus-auto') === '1';
      routedRef.current = routedModelId ? { modelId: routedModelId, auto } : null;

      // Plan usage. Absent header = no ceiling on this plan; show nothing.
      const rawUsage = response.headers.get('x-modus-usage');
      if (rawUsage !== null) {
        const pct = Number(rawUsage);
        if (Number.isFinite(pct)) setUsagePct(pct);
      }
      if (response.headers.get('x-modus-downgraded') === '1') {
        const requested = response.headers.get('x-modus-requested-model') || '';
        const label = requested ? modelName(requested) : 'The selected model';
        const served = response.headers.get('x-modus-model') || '';
        // 'vision' is a DIFFERENT fact from 'unavailable' and must not borrow its
        // sentence: the model is working perfectly, it just has no vision tower.
        // Naming who did answer matters more here than in the unavailable case —
        // the user is about to judge an image answer and deserves to know whose.
        if (response.headers.get('x-modus-downgrade-reason') === 'vision') {
          const by = served ? modelName(served) : 'a vision model';
          setModelNotice(`${label} can't read images — ${by} answered this one instead.`);
        } else {
          setModelNotice(`${label} is temporarily unavailable — answered with the fast default model instead.`);
        }
      } else {
        setModelNotice(null);
      }
    },
    initialMessages,
    id: conversationId ?? 'guest',
    headers: authToken ? { Authorization: `Bearer ${authToken}` } : undefined,
    body: {
      personalContext: personalContext ?? '',
      responseStyle: responseStyle ?? 'normal',
      customStyle: customStyle ?? '',
      briefingHour: briefingHour ?? 7,
      briefingTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone || briefingTimezone || 'UTC',
    },
    onError: (err) => {
      const msg = (err?.message ?? '').toLowerCase();
      if (msg.includes('authentication_required')) {
        setChatError('Your session expired. Please sign in again.');
      } else if (msg.includes('free_limit_reached')) {
        // A DISTINCT code from subscription_required on purpose. This person has
        // been using MODUS for ten messages — telling them to "start your free
        // trial" reads as the product forgetting who they are. Name what ran out.
        setChatError("That's your 10 free messages. Subscribe to keep going.");
        onShowPaywall?.();
      } else if (msg.includes('image_requires_subscription')) {
        setChatError('Images are a paid feature — subscribe to attach one.');
        onShowPaywall?.();
      } else if (msg.includes('subscription_required')) {
        setChatError('Start your 3-day free trial to use MODUS.');
        onShowPaywall?.();
      } else if (msg.includes('empty_message')) {
        // The composer already blocks this, so it only reaches here from another
        // client (mobile, the API directly). Say something useful rather than
        // "something went wrong".
        setChatError('That message was empty — type something first.');
      } else if (msg.includes('token_limit_reached')) {
        // "usage limit", not "token limit" — the ceiling counts cost units, and
        // the two differ by up to 27x on frontier models.
        setChatError("You've hit your daily AI usage limit. Resets at midnight.");
      } else if (msg.includes('groq_daily_limit')) {
        setChatError('AI daily limit reached — switch models with the selector below the chat box, or try again tomorrow.');
      } else if (msg.includes('rate_limit_reached') || msg.includes('rate limit') || msg.includes('429') || msg.includes('tpd') || msg.includes('tokens per day') || msg.includes('too many')) {
        setChatError('AI service is busy. Wait a moment and try again.');
      } else if (msg.includes('api_key_error') || msg.includes('401') || msg.includes('unauthorized') || msg.includes('api key') || msg.includes('invalid key')) {
        setChatError('AI service configuration error. Contact support.');
      } else if (msg.includes('provider_down') || msg.includes('503') || msg.includes('502') || msg.includes('unavailable') || msg.includes('overloaded')) {
        setChatError('AI service is down. Try again in a moment.');
      } else if (msg.includes('all_models_busy') || msg.includes('message_too_large')) {
        // NOT a message-length problem — the server already tried every model and
        // all were briefly throttled. Honest transient copy, no "shorten it".
        setChatError('The AI is briefly busy right now. Wait a few seconds and try again, or switch models below.');
      } else {
        setChatError('Something went wrong. Please try again.');
      }
    },
  });

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const didInitialScrollRef = useRef(false);

  // Latest messages, for handlers that must not close over a stale array.
  const messagesRef = useRef(messages);
  useEffect(() => { messagesRef.current = messages; }, [messages]);

  // Adds turns we ALREADY have the text for, without calling the model.
  //
  // useChat's `append` is not an option here: it calls triggerRequest
  // unconditionally, whatever the role, so using it to drop in an answer we
  // already hold fires a second, racing generation and bills for it. setMessages
  // is the non-triggering path — but the save effect only runs on an isLoading
  // transition, so nothing would persist. Hence the explicit save.
  const appendLocal = (additions: { role: 'user' | 'assistant'; content: string }[]) => {
    // `parts` is not optional on a UIMessage and is what the SDK reads back, so
    // build it rather than casting past it — a message without parts renders
    // blank once it round-trips through the SDK.
    const stamped = additions.map(m => ({
      ...m,
      id: crypto.randomUUID(),
      createdAt: new Date(),
      parts: [{ type: 'text' as const, text: m.content }],
    }));
    const next = [...messagesRef.current, ...stamped];
    messagesRef.current = next;
    setMessages(next);
    savedLengthRef.current = next.length;
    onMessagesChange?.(next);
  };

  // Pre-fill input if navigated here with ?q= (Cmd+K)
  useEffect(() => {
    if (initialInput) {
      setInput(initialInput);
      setTimeout(() => inputAreaRef.current?.focus(), 100);
    }
  // Only run once on mount
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the message list pinned to the bottom. Scroll ONLY this container via
  // element.scrollTo — NOT scrollIntoView, which scrolls every scrollable
  // ancestor (including the document) and, during the loading→loaded hand-off,
  // scrolled the whole window up and cropped the header + sidebar. Instant on
  // first load (no visible jump), smooth for messages that arrive after.
  // ⚠️ `behavior: 'smooth'` must NOT be used for streaming growth. `messages` gets
  // a new identity on EVERY token, so this effect fires per token — and each call
  // cancels the previous smooth animation and starts a new one, which is a scroll
  // that never settles while the answer is being written. Smooth belongs to the
  // arrival of a NEW message (a real event worth animating); token-by-token growth
  // has to be instant or it fights itself.
  const prevMsgCountRef = useRef(0);
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el || messages.length === 0) return;
    const isNewMessage = messages.length !== prevMsgCountRef.current;
    prevMsgCountRef.current = messages.length;
    el.scrollTo({
      top: el.scrollHeight,
      behavior: didInitialScrollRef.current && isNewMessage ? 'smooth' : 'auto',
    });
    didInitialScrollRef.current = true;
  }, [messages]);

  // Reset messages when conversation changes. Abort any in-flight response FIRST
  // — otherwise a stream started in the previous conversation keeps running and
  // its tokens land in (or race against) the newly-selected conversation.
  useEffect(() => {
    stop();
    setMessages(initialMessages);
    savedLengthRef.current = initialMessages.length;
    // The comparison belongs to the conversation it was started in. It lives in
    // component state, not in messages, so without this it stays mounted and
    // follows the user into whichever chat they open next.
    setCompare(null);
    setCompareOn(false);
  // Only run when conversationId changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  // Watchdog: guarantee the loading state always resolves. The server caps a
  // request at 60s (maxDuration); if a connection instead stalls open with no
  // finish/error, isLoading would stick true forever and the composer would stay
  // disabled. After 75s of continuous loading, force-stop and surface an error.
  // ⚠️ The watchdog's own message must survive. stop() flips isLoading, which runs
  // the just-finished effect below — and that effect sees an assistant message
  // with no text and overwrites "timed out" with "the model returned an empty
  // response". The user was told the wrong thing about the one failure we
  // actually understood. This flag lets the empty-answer check stand down when it
  // was the watchdog that ended the turn.
  const timedOutRef = useRef(false);
  useEffect(() => {
    if (!isLoading) return;
    const t = setTimeout(() => {
      timedOutRef.current = true;
      stop();
      setChatError('That response timed out. Please try again.');
    }, 65000);
    return () => clearTimeout(t);
  }, [isLoading, stop]);

  // The server's record of which model REALLY answered each message. This outranks
  // routedByMsgId and modusRoutedModel: both of those come from the x-modus-model
  // header, which is written before the answer starts and so names the model we
  // ATTEMPTED. When the failover chain switched, they name a model that never ran.
  // It also gives a switched MANUAL pick a chip at all — the Auto routing chip
  // never rendered for those, so the swap was previously unlabelled entirely.
  const servedByMsgId = useMemo(() => {
    const out: Record<string, ServedAnnotation> = {};
    for (const m of messages) {
      const s = readServedAnnotation(m);
      if (s) out[m.id] = s;
    }
    return out;
  }, [messages]);

  // Which model this message's chip should name, or undefined for no chip.
  //
  // Three cases, and the order matters:
  //  1. A promised model didn't answer -> always name who did, even on a manual
  //     pick that would never have had a chip. This is the whole fix.
  //  2. Auto announced a pick -> the chip exists either way, so it must name
  //     whoever ACTUALLY answered, not the model Auto merely intended.
  //  3. Nothing was promised (the free default) -> stay quiet. A same-class Groq
  //     TPM hop is an implementation detail, and Groq's free tier trips it often
  //     enough that chipping it would be constant noise about nothing.
  const chipModel = (m: Message): string | undefined => {
    const served = servedByMsgId[m.id];
    if (served?.downgraded) return served.served;
    const announced = routedByMsgId[m.id] ?? readRoutedAnnotation(m);
    if (announced) return served?.served ?? announced;
    return undefined;
  };

  // Tag the current assistant message with the Auto-routed model as soon as it
  // appears, so the "routed this to <model>" chip shows while the answer streams.
  // Only for Auto — a manual model pick doesn't need a routing chip.
  useEffect(() => {
    const r = routedRef.current;
    if (!r?.auto || !r.modelId) return;
    const last = messages[messages.length - 1];
    if (last?.role === 'assistant') {
      setRoutedByMsgId(prev => (prev[last.id] === r.modelId ? prev : { ...prev, [last.id]: r.modelId }));
    }
  }, [messages]);

  // The server reports a mid-answer model switch as an annotation, because the
  // headers read in onResponse were already sent by then. This is the only signal
  // that the model the user picked is not the one that replied, so surface it:
  // MODUS still answers (the chain's whole purpose), it just stops implying the
  // answer came from a model that never ran.
  //
  // Gated on `downgraded`, which the server sets only when we actually named a
  // model. A free-tier Llama→Llama TPM hop promised nothing and stays silent —
  // otherwise Groq's ~2 msgs/min free limit would put a notice on nearly every
  // message and train people to ignore all of them.
  //
  // Gated on isLoading too, so only a LIVE switch speaks. The annotation is
  // appended before the first token, so it always renders at least once while
  // loading; without this, replaying a stored annotation would fire a stale notice
  // every time an old conversation is reopened. The chip carries the durable truth
  // in history — the notice is the live alert.
  useEffect(() => {
    if (!isLoading) return;
    const last = messages[messages.length - 1];
    if (last?.role !== 'assistant') return;
    const s = readServedAnnotation(last);
    if (!s?.downgraded) return;
    setModelNotice(
      `${s.requested ? modelName(s.requested) : 'The selected model'} was unavailable — ${modelName(s.served)} answered instead.`,
    );
  }, [messages, isLoading]);

  // Save to Firestore when AI finishes responding
  useEffect(() => {
    const justFinished = prevLoadingRef.current && !isLoading;
    prevLoadingRef.current = isLoading;

    if (!justFinished) return;

    // Universal backstop against a silent blank bubble: if the finished response
    // is an assistant message with no text and no rich block, something dropped
    // it (content filter, a reasoning model that spent its whole token budget, a
    // provider hiccup). Tell the user and let them retry — never leave it empty.
    const last = messages[messages.length - 1];
    if (last?.role === 'assistant') {
      // Same reader MessageBubble uses — see extractTextContent. Reading this
      // field two different ways is how a rendered answer could still be called
      // empty.
      const text = extractTextContent(last.content);
      // Must list every block type MessageBubble can render — a reply that is
      // ONLY a block (no prose) would otherwise trip the empty-response error.
      const hasBlock = /```(approval|draft_options|options|image|document|chart)/.test(text);
      // The watchdog already told the user what happened, and it knows more than
      // this check does — so stand down rather than talking over it. Note this
      // only suppresses the MESSAGE: the partial response must still be saved
      // below, which an early return here would have quietly skipped.
      const watchdogSpoke = timedOutRef.current;
      timedOutRef.current = false;
      if (!watchdogSpoke && !hasBlock && text.trim() === '') {
        setChatError('The model returned an empty response. Try again, or switch models below.');
      }
    }

    if (messages.length === 0 || !onMessagesChange) return;
    if (messages.length <= savedLengthRef.current) return;

    savedLengthRef.current = messages.length;

    const firstUserMsg = messages.find(m => m.role === 'user');
    const isFirstExchange = messages.filter(m => m.role === 'assistant').length === 1;
    const title = isFirstExchange && firstUserMsg
      ? (typeof firstUserMsg.content === 'string' ? firstUserMsg.content.slice(0, 45) : 'New chat')
      : undefined;

    // Persist the Auto-routed model per assistant message as an annotation, so the
    // routing chip survives a reload. Earlier turns keep their tag via routedByMsgId;
    // the just-finished one is read straight from the header ref (state may not have
    // flushed yet). Messages without a tag are saved unchanged (keeps any existing
    // annotation from a reloaded conversation).
    const messagesToSave = messages.map(m => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const existing = ((m as any).annotations as any[] | undefined) ?? [];
      const has = (key: string) =>
        existing.some(a => a && typeof a === 'object' && typeof a[key] === 'string');
      // The server's switch record is the truth and must survive the save. This
      // used to REPLACE annotations wholesale, which would have overwritten
      // modusServedModel with the header's intended model — persisting "answered
      // by Gemini" onto a reply Llama wrote, forever.
      if (has('modusServedModel')) return m;
      // Already tagged (e.g. reloaded from Firestore) — appending again would
      // duplicate the annotation on every subsequent save.
      if (has('modusRoutedModel')) return m;
      const routed = routedByMsgId[m.id]
        ?? (m.id === last?.id && routedRef.current?.auto ? routedRef.current.modelId : undefined);
      return routed
        ? { ...m, annotations: [...existing, { modusRoutedModel: routed }] }
        : m;
    });

    onMessagesChange(messagesToSave, title);
  }, [isLoading, messages, onMessagesChange, routedByMsgId]);

  function handleVoiceTranscript(text: string) {
    setInput(text);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!input.trim() && !attachedImage && attachedFiles.length === 0) return;
    if (isAtLimit) { onShowPaywall?.(); return; }

    // Compare mode short-circuits the normal send: the prompt goes to three
    // models side by side instead of into the conversation.
    if (compareOn && input.trim()) {
      // /api/chat/compare takes a bare prompt, so an attachment cannot come
      // along. Say so and keep it in the composer — this used to return here
      // without clearing the attachment or sending it, so the file just sat
      // there and the models answered a question about a file they never saw.
      if (attachedImage || attachedFiles.length > 0) {
        setModelNotice('Multi-model can’t read attachments yet. Remove the file to compare models, or turn multi-model off to send it.');
        return;
      }
      setCompare({ prompt: input.trim(), id: crypto.randomUUID() });
      setInput('');
      setCompareOn(false);
      return;
    }

    const content = attachedImage
      ? [
          ...(input.trim() ? [{ type: 'text' as const, text: input.trim() }] : []),
          {
            type: 'image' as const,
            image: attachedImage.base64,
            mimeType: attachedImage.mimeType as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif',
          },
        ]
      : input.trim();

    const filesToSend = attachedFiles;
    setAttachedImage(null);
    setAttachedFiles([]);
    setInput('');
    setChatError(null);
    setModelNotice(null);
    onUserMessage?.();
    await append(
      { role: 'user', content } as Parameters<typeof append>[0],
      { body: { modelChoice: modelChoiceRef.current, webSearch: webSearchOn, attachments: filesToSend, lastRoutedModel: lastAutoRoutedModel() } },
    );
  }

  // 🎬 THE OPENING SCREEN AND THE CONVERSATION ARE ONE LAYOUT, NOT TWO.
  // On a new chat the greeting and the composer sit together in the middle of
  // the pane; the first message drops the composer to the bottom and the
  // transcript takes the space above it. That move is a real animation, not a
  // cut, and it only works because <ChatInput> stays the SAME React node
  // across both states — framer-motion's `layout` then FLIPs it between the two
  // measured positions. Rendering a second composer inside the empty state
  // would remount it (losing focus, draft text and attachments) and could not
  // animate at all.
  const isEmpty = messages.length === 0 && !compare;

  return (
    <div className={`flex flex-col h-full min-h-0 ${isEmpty ? 'justify-center' : ''}`}>
      <div
        ref={scrollContainerRef}
        className={isEmpty ? 'shrink-0 overflow-y-auto' : 'flex-1 min-h-0 overflow-y-auto'}
      >
        {messages.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            /* No min-h-full here: the block must be CONTENT height so it can be
               centred as a group with the composer. min-h-full forced it to
               fill the pane, which is what pinned the composer to the bottom. */
            className="flex flex-col items-center justify-center gap-5 px-4 md:px-8 py-8"
          >
            {/* The mark itself, with no container. The tinted rounded-2xl box
                that used to sit behind it read as a generic app medallion —
                the "vibecoded" tell — and a chat opening screen wants the
                brand present, not framed. */}
            <div className="flex items-center justify-center">
              <Image src="/logo.png" alt="MODUS" width={40} height={40} className="dark:hidden" />
              <Image src="/logo-dark.png" alt="MODUS" width={40} height={40} className="hidden dark:block" />
            </div>

            {/* Title */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.18, type: 'spring', stiffness: 220, damping: 24 }}
              className="text-center"
            >
              <p className="text-text text-base font-semibold mb-1">
                {isGuest ? "What's on your plate?" : `${timeGreeting()}${firstName ? `, ${firstName}` : ''}.`}
              </p>
              <p className="text-muted text-sm">
                {isGuest ? 'Sign in to save your conversations.' : "What's on your plate?"}
              </p>
            </motion.div>

          </motion.div>
        ) : (
          // Same max-w-4xl + px as ChatInput's inner box, so the transcript and
          // the composer it came from share one column and one left edge.
          // Measured before this change: prose ran 84 characters per line,
          // where 60–75 is the comfortable range for reading — and prose is the
          // entire product.
          <div className="px-4 md:px-8 py-6 space-y-4 max-w-4xl mx-auto w-full">
        {messages.map((m, idx) => (
          <MessageBubble
            key={m.id}
            message={m}
            showAvatar={messages[idx - 1]?.role !== m.role}
            isStreaming={isLoading && idx === messages.length - 1 && m.role === 'assistant'}
            routedModel={chipModel(m)}
            replacedModel={servedByMsgId[m.id]?.downgraded ? servedByMsgId[m.id]?.requested : undefined}
            webSearchCount={readWebSearchAnnotation(m)}
            isLatest={idx === messages.length - 1}
            followingUserText={
              messages[idx + 1]?.role === 'user' ? messageText(messages[idx + 1]) : undefined
            }
            onAppend={(text) => {
              setChatError(null);
              onUserMessage?.();
              append({ role: 'user', content: text }, { body: { modelChoice: modelChoiceRef.current, lastRoutedModel: lastAutoRoutedModel() } });
            }}
            onApproved={(text) => {
              // The approval already did the work and handed back its own
              // confirmation line — appending it must not ask the model to
              // generate a second one on top.
              appendLocal([{ role: 'assistant', content: text }]);
            }}
          />
        ))}

        {compare && (
          <div className="space-y-2">
            {/* Stand-in for the prompt while the comparison runs. Picking a
                model closes the card and writes the prompt as a real user turn,
                so the two never render at once. */}
            <div className="flex justify-end">
              <div className="bg-brand text-white rounded-2xl rounded-br-sm px-4 py-2.5 max-w-[72%]">
                <p className="text-sm leading-relaxed">{compare.prompt}</p>
              </div>
            </div>
            <CompareCard
              key={compare.id}
              prompt={compare.prompt}
              models={compareModels}
              onClose={() => setCompare(null)}
              onRunNormally={(p) => {
                // Drop out of compare and send it as an ordinary turn. `append`
                // (not appendLocal) is deliberate and is the one place it's
                // right: we WANT the request, so the model emits its ```image /
                // ```document / ```chart block and the real card renders it.
                setCompare(null);
                setChatError(null);
                onUserMessage?.();
                append(
                  { role: 'user', content: p },
                  { body: { modelChoice: modelChoiceRef.current, lastRoutedModel: lastAutoRoutedModel() } },
                );
              }}
              onUse={(text) => {
                // Picking a model ENDS the comparison — Jeremiah, after living
                // with the card staying open: "it should just be exited out if
                // user chooses a model it still shows". Once you've chosen, the
                // other two answers are noise sitting under the one you want.
                appendLocal([
                  { role: 'user', content: compare.prompt },
                  { role: 'assistant', content: text },
                ]);
                setCompare(null);
              }}
            />
          </div>
        )}
        {isAwaitingAssistantText(messages, isLoading) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.2 }}
            className="flex items-center gap-2.5"
          >
            <div className="w-7 h-7 rounded-full bg-brand/10 border border-brand/20 flex items-center justify-center shrink-0">
              <Image src="/logo.png" alt="MODUS" width={14} height={14} className="opacity-75 dark:hidden" />
              <Image src="/logo-dark.png" alt="MODUS" width={14} height={14} className="opacity-75 hidden dark:block" />
            </div>
            <div className="flex gap-1 items-end">
              <span className="typing-dot w-1.5 h-1.5 bg-brand/60 rounded-full" />
              <span className="typing-dot w-1.5 h-1.5 bg-brand/60 rounded-full" />
              <span className="typing-dot w-1.5 h-1.5 bg-brand/60 rounded-full" />
            </div>
          </motion.div>
        )}
          </div>
        )}
      </div>

      {/* Plan usage. Appears only past USAGE_NOTICE_AT, sits on the composer's
          column, and leaves on its own after a few seconds. A hairline bar
          rather than a number alone, because "82%" means nothing without the
          shape of how far along that is. */}
      <AnimatePresence>
        {usagePct !== null && usagePct >= USAGE_NOTICE_AT && !usageDismissed && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className="max-w-4xl mx-auto w-full px-4 md:px-8 mb-2"
          >
            <div className="flex items-center gap-3 px-3 py-2 rounded-lg border border-border bg-panel">
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline justify-between gap-3 mb-1.5">
                  <span className="text-xs text-muted truncate">
                    {usagePct >= USAGE_URGENT_AT
                      ? 'You’re close to this period’s limit'
                      : 'Usage this period'}
                  </span>
                  <span className={`text-xs tabular-nums ${usagePct >= USAGE_URGENT_AT ? 'text-amber-500' : 'text-muted'}`}>
                    {usagePct}%
                  </span>
                </div>
                <div className="h-1 rounded-full bg-border overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${usagePct}%` }}
                    transition={{ duration: 0.5, ease: 'easeOut' }}
                    className={`h-full rounded-full ${usagePct >= USAGE_URGENT_AT ? 'bg-amber-500' : 'bg-muted'}`}
                  />
                </div>
              </div>
              <button
                onClick={() => setUsageDismissed(true)}
                className="text-muted hover:text-text shrink-0 -mr-1"
                aria-label="Dismiss"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {modelNotice && (
        <div className="mx-4 md:mx-8 mb-2 px-4 py-3 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center justify-between gap-3">
          <p className="text-sm text-amber-500">{modelNotice}</p>
          <button onClick={() => setModelNotice(null)} className="text-amber-500 hover:text-amber-400 shrink-0" aria-label="Dismiss">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
      )}

      {chatError && (
        <div className="mx-4 md:mx-8 mb-2 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center justify-between gap-3">
          <p className="text-sm text-red-400">{chatError}</p>
          {/* The actions are one group on the right — justify-between across
              three children stranded Regenerate in the middle of the bar. */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={() => { setChatError(null); reload(); }}
              className="text-red-400 hover:text-red-300 text-sm font-medium"
            >
              Regenerate
            </button>
            <button onClick={() => setChatError(null)} className="text-red-400 hover:text-red-300" aria-label="Dismiss">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
        </div>
      )}

      {isAtLimit ? (
        <div className="px-4 md:px-8 py-4 border-t border-border text-center">
          <p className="text-muted text-sm mb-2">You&apos;ve used your free messages for today.</p>
          <button
            onClick={onShowPaywall}
            className="bg-brand text-white text-sm font-semibold px-6 py-2.5 rounded-xl hover:bg-brand/90 transition-colors"
          >
            Upgrade to MODUS
          </button>
        </div>
      ) : (
        <motion.div
          layout
          /* Spring, not a duration: the distance travelled changes with the
             viewport, and a fixed duration reads as fast on a laptop and slow
             on a large display. Damped hard enough not to overshoot into the
             transcript. */
          transition={{ type: 'spring', stiffness: 260, damping: 30, mass: 0.9 }}
        >
        <ChatInput
          input={input}
          onChange={handleInputChange}
          onSubmit={handleSubmit}
          onVoiceTranscript={handleVoiceTranscript}
          onImageAttach={(base64, mimeType) => setAttachedImage({ base64, mimeType })}
          isLoading={isLoading}
          attachedImage={attachedImage?.base64 ?? null}
          onClearImage={() => setAttachedImage(null)}
          attachedFiles={attachedFiles}
          onFileAttach={(name, text) => setAttachedFiles(f => [...f, { name, text }])}
          onRemoveFile={(i) => setAttachedFiles(f => f.filter((_, idx) => idx !== i))}
          webSearchOn={webSearchOn}
          onToggleWebSearch={() => setWebSearchOn(v => !v)}
          // Multi-model needs 2+ UNLOCKED models to mean anything, so a free
          // plan (Llama only) never sees the toggle. Gated on what the plan
          // unlocks, not on the current selection — otherwise deselecting down
          // to one model would rip the toggle out mid-use.
          compareOn={compareOn}
          onToggleCompare={unlockedModels(plan).length >= 2 ? () => setCompareOn(v => !v) : undefined}
          compareSelected={compareModels}
          onToggleCompareModel={toggleCompareModel}
          connectedServices={connectedServices}
          onSeedPrompt={(t) => { setInput(t); setTimeout(() => inputAreaRef.current?.focus(), 50); }}
          openQuestion={hasOpenQuestion(messages)}
          textareaRef={inputAreaRef}
          plan={isGuest ? undefined : plan}
          modelChoice={modelChoice}
          onModelChange={handleModelChange}
          docked={!isEmpty}
        />
        </motion.div>
      )}

      {/* Suggestions sit UNDER the composer, not above it. Above, they wrapped
          into a ragged 2–1–1 centred pile that pushed the composer off centre
          and read as clutter. A left-aligned column below reads as a quiet
          menu: the composer stays the thing you look at, and each row is a
          full-width hit target instead of a small pill. They disappear the
          moment the conversation starts. */}
      {isEmpty && !isGuest && connectedServices && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.28, type: 'spring', stiffness: 220, damping: 24 }}
          /* Same container as ChatInput's inner box (max-w-4xl mx-auto px-4
             md:px-8) so the rows line up with the composer's left edge. The
             -mx-2 / px-2 pair puts the TEXT on that edge while letting the
             hover background bleed slightly outside it. */
          className="max-w-4xl mx-auto w-full px-4 md:px-8 pb-6"
        >
          <div className="-mx-2">
            {getSmartPrompts(connectedServices).map((prompt) => (
              <button
                key={prompt.text}
                onClick={() => { setInput(prompt.text); setTimeout(() => inputAreaRef.current?.focus(), 50); }}
                className="w-full flex items-center gap-3 px-2 py-2.5 rounded-lg text-left text-muted hover:text-text hover:bg-text/[0.04] transition-colors"
              >
                <PromptIcon name={prompt.icon} />
                <span className="text-sm">{prompt.text}</span>
              </button>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}
