'use client';

import { useChat } from 'ai/react';
import MessageBubble from './MessageBubble';
import ChatInput from './ChatInput';
import { useRef, useEffect, useState } from 'react';
import type { Message } from 'ai';
import { auth } from '@/lib/firebase';

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
}: Props) {
  const [attachedImage, setAttachedImage] = useState<{ base64: string; mimeType: string } | null>(null);
  const inputAreaRef = useRef<HTMLTextAreaElement>(null);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const prevLoadingRef = useRef(false);
  const savedLengthRef = useRef(initialMessages.length);

  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async (user) => {
      if (user) setAuthToken(await user.getIdToken());
      else setAuthToken(null);
    });
    return unsub;
  }, []);

  const [chatError, setChatError] = useState<string | null>(null);

  const { messages, input, handleInputChange, append, isLoading, setInput, setMessages } = useChat({
    api: '/api/chat',
    initialMessages,
    id: conversationId ?? 'guest',
    headers: authToken ? { Authorization: `Bearer ${authToken}` } : undefined,
    body: {
      personalContext: personalContext ?? '',
      responseStyle: responseStyle ?? 'normal',
      customStyle: customStyle ?? '',
      briefingHour: briefingHour ?? 7,
      briefingTimezone: briefingTimezone ?? 'UTC',
    },
    onError: (err) => {
      const msg = err?.message ?? '';
      if (msg.includes('Rate limit') || msg.includes('TPD') || msg.includes('tokens per day')) {
        setChatError('Daily message limit reached. Try again in a few hours.');
      } else if (msg.includes('rate limit') || msg.includes('429')) {
        setChatError('Too many messages right now. Wait a minute and try again.');
      } else {
        setChatError('Something went wrong. Please try again.');
      }
    },
  });

  const bottomRef = useRef<HTMLDivElement>(null);

  // Pre-fill input if navigated here with ?q= (Cmd+K)
  useEffect(() => {
    if (initialInput) {
      setInput(initialInput);
      setTimeout(() => inputAreaRef.current?.focus(), 100);
    }
  // Only run once on mount
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Reset messages when conversation changes
  useEffect(() => {
    setMessages(initialMessages);
    savedLengthRef.current = initialMessages.length;
  // Only run when conversationId changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  // Save to Firestore when AI finishes responding
  useEffect(() => {
    const justFinished = prevLoadingRef.current && !isLoading;
    prevLoadingRef.current = isLoading;

    if (!justFinished || messages.length === 0 || !onMessagesChange) return;
    if (messages.length <= savedLengthRef.current) return;

    savedLengthRef.current = messages.length;

    const firstUserMsg = messages.find(m => m.role === 'user');
    const isFirstExchange = messages.filter(m => m.role === 'assistant').length === 1;
    const title = isFirstExchange && firstUserMsg
      ? (typeof firstUserMsg.content === 'string' ? firstUserMsg.content.slice(0, 45) : 'New chat')
      : undefined;

    onMessagesChange(messages, title);
  }, [isLoading, messages, onMessagesChange]);

  function handleVoiceTranscript(text: string) {
    setInput(text);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!input.trim() && !attachedImage) return;
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

    setAttachedImage(null);
    setInput('');
    onUserMessage?.();
    await append({ role: 'user', content } as Parameters<typeof append>[0]);
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto px-8 py-6 space-y-4">
        {messages.length === 0 && (
          <div className="text-center mt-20">
            <p className="text-text text-lg font-semibold mb-2">What&apos;s on your plate?</p>
            <p className="text-muted text-sm">
              {isGuest ? 'Sign in to save your conversations.' : 'Your chief of staff. Ready when you are.'}
            </p>
          </div>
        )}
        {messages.map((m, idx) => (
          <MessageBubble
            key={m.id}
            message={m}
            isStreaming={isLoading && idx === messages.length - 1 && m.role === 'assistant'}
          />
        ))}
        {isLoading && (
          <div className="flex gap-1 px-4">
            <span className="w-1.5 h-1.5 bg-muted rounded-full animate-bounce [animation-delay:0ms]" />
            <span className="w-1.5 h-1.5 bg-muted rounded-full animate-bounce [animation-delay:150ms]" />
            <span className="w-1.5 h-1.5 bg-muted rounded-full animate-bounce [animation-delay:300ms]" />
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {chatError && (
        <div className="mx-8 mb-2 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center justify-between gap-3">
          <p className="text-sm text-red-400">{chatError}</p>
          <button onClick={() => setChatError(null)} className="text-red-400 hover:text-red-300 text-xs shrink-0">✕</button>
        </div>
      )}

      {isAtLimit ? (
        <div className="px-8 py-4 border-t border-border text-center">
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
          textareaRef={inputAreaRef}
        />
      )}
    </div>
  );
}
