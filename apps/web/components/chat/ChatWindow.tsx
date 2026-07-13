'use client';

import { useChat } from 'ai/react';
import MessageBubble from './MessageBubble';
import ChatInput from './ChatInput';
import { useRef, useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import type { Message } from 'ai';
import { auth } from '@/lib/firebase';
import { useAuth } from '@/components/providers/AuthProvider';
import { modelName } from '@/lib/models';
import { motion } from 'framer-motion';

interface ConnectedServices {
  google: boolean; notion: boolean; slack: boolean; github: boolean; contacts: boolean;
}

// Reads the auto-routed model id stashed on a message's annotations (persisted to
// Firestore), so the "MODUS routed this to <model>" chip survives a reload.
function readRoutedAnnotation(m: Message): string | undefined {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const anns = (m as any).annotations as any[] | undefined;
  if (!Array.isArray(anns)) return undefined;
  for (const a of anns) {
    if (a && typeof a === 'object' && typeof a.modusRoutedModel === 'string') return a.modusRoutedModel;
  }
  return undefined;
}

function timeGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

function getSmartPrompts(svc: ConnectedServices): string[] {
  const prompts: string[] = [];
  if (svc.google)   prompts.push("What's on my calendar today?", "Any important emails?");
  if (svc.notion)   prompts.push("Search my Notion notes");
  if (svc.slack)    prompts.push("Catch me up on Slack");
  if (svc.github)   prompts.push("What are my open pull requests?");
  if (svc.contacts) prompts.push("Who do I know at [company]?");
  if (prompts.length === 0) {
    return ["Help me plan my day", "Generate an image", "Make a PDF", "Set a goal"];
  }
  // Keep a generation prompt discoverable alongside connected-service prompts.
  prompts.push("Generate an image");
  return prompts.slice(0, 4);
}

function ServiceBadge({ label }: { label: string }) {
  return (
    <span className="flex items-center gap-1.5 text-xs text-muted">
      <span className="w-1.5 h-1.5 rounded-full bg-green-400/70" />
      {label}
    </span>
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
  const [connectedServices, setConnectedServices] = useState<ConnectedServices | null>(null);
  // In-chat model selection ('auto' | model id | 'default'). Initialized from the
  // saved Brain (defaultModelChoice) and written back to it on change, so the
  // composer and the Brain settings page are one synced setting. The ref keeps the
  // value stable for the useChat request body (avoids stale closures).
  const [modelChoice, setModelChoice] = useState(defaultModelChoice);
  const modelChoiceRef = useRef(defaultModelChoice);
  // Keep in sync if the saved default loads/changes (e.g. from another device).
  useEffect(() => {
    setModelChoice(defaultModelChoice);
    modelChoiceRef.current = defaultModelChoice;
  }, [defaultModelChoice]);
  function handleModelChange(v: string) {
    setModelChoice(v);
    modelChoiceRef.current = v;
    onModelChoiceChange?.(v);
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

  const { messages, input, handleInputChange, append, isLoading, setInput, setMessages, stop, reload } = useChat({
    api: '/api/chat',
    onResponse: (response) => {
      // Capture the model that will answer this message + whether Auto chose it.
      const routedModelId = response.headers.get('x-modus-model') || '';
      const auto = response.headers.get('x-modus-auto') === '1';
      routedRef.current = routedModelId ? { modelId: routedModelId, auto } : null;
      if (response.headers.get('x-modus-downgraded') === '1') {
        const requested = response.headers.get('x-modus-requested-model') || '';
        const label = requested ? modelName(requested) : 'The selected model';
        setModelNotice(`${label} is temporarily unavailable — answered with the fast default model instead.`);
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
      } else if (msg.includes('subscription_required')) {
        setChatError('Start your 3-day free trial to use MODUS.');
        onShowPaywall?.();
      } else if (msg.includes('token_limit_reached')) {
        setChatError("You've hit your daily AI token limit. Resets at midnight.");
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
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el || messages.length === 0) return;
    el.scrollTo({ top: el.scrollHeight, behavior: didInitialScrollRef.current ? 'smooth' : 'auto' });
    didInitialScrollRef.current = true;
  }, [messages]);

  // Reset messages when conversation changes. Abort any in-flight response FIRST
  // — otherwise a stream started in the previous conversation keeps running and
  // its tokens land in (or race against) the newly-selected conversation.
  useEffect(() => {
    stop();
    setMessages(initialMessages);
    savedLengthRef.current = initialMessages.length;
  // Only run when conversationId changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  // Watchdog: guarantee the loading state always resolves. The server caps a
  // request at 60s (maxDuration); if a connection instead stalls open with no
  // finish/error, isLoading would stick true forever and the composer would stay
  // disabled. After 75s of continuous loading, force-stop and surface an error.
  useEffect(() => {
    if (!isLoading) return;
    const t = setTimeout(() => {
      stop();
      setChatError('That response timed out. Please try again.');
    }, 65000);
    return () => clearTimeout(t);
  }, [isLoading, stop]);

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
      const text = typeof last.content === 'string' ? last.content : '';
      const hasBlock = /```(approval|draft_options|image|document|chart)/.test(text);
      if (!hasBlock && text.trim() === '') {
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
      const routed = routedByMsgId[m.id]
        ?? (m.id === last?.id && routedRef.current?.auto ? routedRef.current.modelId : undefined);
      return routed
        ? { ...m, annotations: [{ modusRoutedModel: routed }] }
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
      { body: { modelChoice: modelChoiceRef.current, webSearch: webSearchOn, attachments: filesToSend } },
    );
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      <div ref={scrollContainerRef} className="flex-1 min-h-0 overflow-y-auto">
        {messages.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className="min-h-full flex flex-col items-center justify-center gap-5 px-4 md:px-8 py-8"
          >
            {/* Avatar */}
            <div className="w-14 h-14 rounded-2xl bg-brand/10 border border-brand/20 flex items-center justify-center">
              <Image src="/logo.png" alt="MODUS" width={28} height={28} className="opacity-80 dark:hidden" />
              <Image src="/logo-dark.png" alt="MODUS" width={28} height={28} className="opacity-80 hidden dark:block" />
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

            {/* Smart prompt chips */}
            {!isGuest && connectedServices && (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3, type: 'spring', stiffness: 220, damping: 24 }}
                className="flex flex-wrap gap-2 justify-center max-w-sm"
              >
                {getSmartPrompts(connectedServices).map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => { setInput(prompt); setTimeout(() => inputAreaRef.current?.focus(), 50); }}
                    className="text-xs px-3 py-1.5 rounded-lg border border-border text-muted hover:text-text hover:border-brand/40 hover:bg-brand/5 transition-colors"
                  >
                    {prompt}
                  </button>
                ))}
              </motion.div>
            )}

            {/* Connected services strip */}
            {!isGuest && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.42 }}
                className="flex items-center gap-3 flex-wrap justify-center"
              >
                {connectedServices && Object.values(connectedServices).some(Boolean) ? (
                  <>
                    {connectedServices.google   && <ServiceBadge label="Google" />}
                    {connectedServices.notion   && <ServiceBadge label="Notion" />}
                    {connectedServices.slack    && <ServiceBadge label="Slack" />}
                    {connectedServices.github   && <ServiceBadge label="GitHub" />}
                    {connectedServices.contacts && <ServiceBadge label="Contacts" />}
                    <Link href="/capabilities" className="text-xs text-muted hover:text-text transition-colors">Manage →</Link>
                  </>
                ) : connectedServices !== null ? (
                  <Link href="/capabilities" className="text-xs text-muted hover:text-brand transition-colors">
                    Connect your tools →
                  </Link>
                ) : null}
              </motion.div>
            )}
          </motion.div>
        ) : (
          <div className="px-4 md:px-8 py-6 space-y-4 max-w-6xl mx-auto w-full">
        {messages.map((m, idx) => (
          <MessageBubble
            key={m.id}
            message={m}
            showAvatar={messages[idx - 1]?.role !== m.role}
            isStreaming={isLoading && idx === messages.length - 1 && m.role === 'assistant'}
            routedModel={routedByMsgId[m.id] ?? readRoutedAnnotation(m)}
            onAppend={(text) => {
              setChatError(null);
              onUserMessage?.();
              append({ role: 'user', content: text }, { body: { modelChoice: modelChoiceRef.current } });
            }}
            onApproved={(text) => {
              append({ role: 'assistant', content: text } as Parameters<typeof append>[0]);
            }}
          />
        ))}
        {isLoading && messages[messages.length - 1]?.role !== 'assistant' && (
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
          <button
            onClick={() => { setChatError(null); reload(); }}
            className="text-red-400 hover:text-red-300 text-sm font-medium shrink-0"
          >
            Regenerate
          </button>
          <button onClick={() => setChatError(null)} className="text-red-400 hover:text-red-300 shrink-0" aria-label="Dismiss">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
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
          connectedServices={connectedServices}
          textareaRef={inputAreaRef}
          plan={isGuest ? undefined : plan}
          modelChoice={modelChoice}
          onModelChange={handleModelChange}
        />
      )}
    </div>
  );
}
