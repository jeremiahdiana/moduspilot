import type { Message } from 'ai';
import ApprovalCard from './ApprovalCard';

function parseApprovalBlocks(content: string): Array<{ type: 'text'; value: string } | { type: 'approval'; value: string }> {
  const parts: Array<{ type: 'text'; value: string } | { type: 'approval'; value: string }> = [];
  const regex = /```approval\n([\s\S]*?)```/g;
  let last = 0;
  let match;
  while ((match = regex.exec(content)) !== null) {
    if (match.index > last) parts.push({ type: 'text', value: content.slice(last, match.index) });
    parts.push({ type: 'approval', value: match[1].trim() });
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

export default function MessageBubble({ message, isStreaming = false }: { message: Message; isStreaming?: boolean }) {
  const isUser = message.role === 'user';

  if (isUser) {
    const text = extractTextContent(message.content);
    const hasImage = Array.isArray(message.content) && message.content.some(p => p.type === 'image');
    return (
      <div className="flex justify-end">
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
      </div>
    );
  }

  const rawText = extractTextContent(message.content);

  // While streaming, strip approval code blocks so the user never sees raw JSON
  const hasApprovalBlock = rawText.includes('```approval');
  const streamingText = hasApprovalBlock
    ? rawText.replace(/```approval[\s\S]*?```/g, '').replace(/```approval[\s\S]*$/g, '').trimEnd()
    : rawText;

  const parts = isStreaming
    ? [{ type: 'text' as const, value: streamingText }]
    : parseApprovalBlocks(rawText);

  return (
    <div className="flex justify-start">
      <div className="max-w-[72%] space-y-3">
        {parts.map((part, i) =>
          part.type === 'approval' ? (
            <ApprovalCard key={i} raw={part.value} />
          ) : part.value.trim() ? (
            <p key={i} className="text-sm leading-relaxed text-text whitespace-pre-wrap">{part.value}</p>
          ) : null
        )}
        {isStreaming && hasApprovalBlock && (
          <div className="flex items-center gap-2 px-4 py-3 border border-border bg-panel rounded-xl">
            <span className="w-1.5 h-1.5 bg-brand rounded-full animate-pulse" />
            <span className="text-xs text-muted">Preparing action…</span>
          </div>
        )}
      </div>
    </div>
  );
}
