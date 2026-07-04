import type { Message } from 'ai';
import Image from 'next/image';
import { motion } from 'framer-motion';
import ApprovalCard from './ApprovalCard';
import DraftOptionsCard from './DraftOptionsCard';
import ImageCard from './ImageCard';
import DocumentCard from './DocumentCard';

type Part =
  | { type: 'text'; value: string }
  | { type: 'approval'; value: string }
  | { type: 'draft_options'; value: string }
  | { type: 'image'; value: string }
  | { type: 'document'; value: string };

function parseBlocks(content: string): Part[] {
  const parts: Part[] = [];
  const regex = /```(approval|draft_options|image|document)\n([\s\S]*?)```/g;
  let last = 0;
  let match;
  while ((match = regex.exec(content)) !== null) {
    if (match.index > last) parts.push({ type: 'text', value: content.slice(last, match.index) });
    parts.push({ type: match[1] as 'approval' | 'draft_options' | 'image' | 'document', value: match[2].trim() });
    last = match.index + match[0].length;
  }
  if (last < content.length) parts.push({ type: 'text', value: content.slice(last) });
  return parts;
}

function extractTextContent(content: Message['content']): string {
  if (typeof content === 'string') return content;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const parts = content as any[];
  if (Array.isArray(parts)) {
    return parts
      .filter((p) => p.type === 'text')
      .map((p) => p.text as string)
      .join('\n');
  }
  return '';
}

function ModusAvatar() {
  return (
    <div className="w-7 h-7 rounded-full bg-brand/10 border border-brand/20 flex items-center justify-center shrink-0 mt-0.5">
      <Image src="/logo.png" alt="MODUS" width={14} height={14} className="opacity-75 dark:hidden" />
      <Image src="/logo-dark.png" alt="MODUS" width={14} height={14} className="opacity-75 hidden dark:block" />
    </div>
  );
}

export default function MessageBubble({
  message,
  isStreaming = false,
  onAppend,
  onApproved,
}: {
  message: Message;
  isStreaming?: boolean;
  onAppend?: (text: string) => void;
  onApproved?: (text: string) => void;
}) {
  const isUser = message.role === 'user';

  if (isUser) {
    const text = extractTextContent(message.content);
    const hasImage = Array.isArray(message.content) && message.content.some(p => p.type === 'image');
    return (
      <motion.div
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        className="flex justify-end"
      >
        <div className="max-w-[72%] space-y-1.5">
          {hasImage && (
            <div className="bg-brand/10 border border-brand/20 rounded-xl px-3 py-2 text-xs text-brand text-right">
              Image attached
            </div>
          )}
          {text && (
            <div className="bg-brand text-white rounded-2xl rounded-br-sm px-4 py-2.5">
              <p className="text-sm leading-relaxed">{text}</p>
            </div>
          )}
        </div>
      </motion.div>
    );
  }

  const rawText = extractTextContent(message.content);

  const hasSpecialBlock = rawText.includes('```approval') || rawText.includes('```draft_options') || rawText.includes('```image') || rawText.includes('```document');
  const streamingText = hasSpecialBlock
    ? rawText
        .replace(/```(approval|draft_options|image|document)[\s\S]*?```/g, '')
        .replace(/```(approval|draft_options|image|document)[\s\S]*$/g, '')
        .trimEnd()
    : rawText;

  const parts = isStreaming
    ? [{ type: 'text' as const, value: streamingText }]
    : parseBlocks(rawText);

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
      className="flex justify-start gap-2.5"
    >
      <ModusAvatar />
      <div className="max-w-[72%] space-y-3">
        {parts.map((part, i) =>
          part.type === 'approval' ? (
            <ApprovalCard key={i} raw={part.value} onApproved={onApproved} />
          ) : part.type === 'draft_options' ? (
            <DraftOptionsCard key={i} raw={part.value} onAppend={onAppend ?? (() => {})} />
          ) : part.type === 'image' ? (
            <ImageCard key={i} raw={part.value} />
          ) : part.type === 'document' ? (
            <DocumentCard key={i} raw={part.value} />
          ) : part.value.trim() ? (
            <p key={i} className="text-sm leading-relaxed text-text whitespace-pre-wrap">{part.value}</p>
          ) : null
        )}
        {isStreaming && hasSpecialBlock && (
          <div className="flex items-center gap-2 px-4 py-3 border border-border bg-panel rounded-xl">
            <span className="w-1.5 h-1.5 bg-brand rounded-full animate-pulse" />
            <span className="text-xs text-muted">Preparing action…</span>
          </div>
        )}
      </div>
    </motion.div>
  );
}
