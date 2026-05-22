'use client';

import type { Conversation } from '@/hooks/useConversations';

interface Props {
  conversations: Conversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
}

function relativeTime(date: Date): string {
  const now = Date.now();
  const diff = Math.floor((now - date.getTime()) / 1000);
  if (diff < 60)   return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 172800) return 'Yesterday';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function isToday(date: Date): boolean {
  const now = new Date();
  return date.getDate() === now.getDate() && date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
}

function getLastMessage(conv: Conversation): string {
  const msgs = conv.messages;
  if (!msgs || msgs.length === 0) return '';
  const last = msgs[msgs.length - 1];
  const content = typeof last.content === 'string' ? last.content : '';
  return content.slice(0, 60) + (content.length > 60 ? '…' : '');
}

export default function ConversationList({ conversations, activeId, onSelect, onNew, onDelete }: Props) {
  const todayConvs   = conversations.filter(c => isToday(c.updatedAt));
  const earlierConvs = conversations.filter(c => !isToday(c.updatedAt));

  function renderConv(conv: Conversation) {
    const preview = getLastMessage(conv);
    const isActive = activeId === conv.id;
    return (
      <div
        key={conv.id}
        className={`group relative flex flex-col px-3 py-2.5 rounded-lg cursor-pointer transition-colors ${
          isActive ? 'bg-brand/10' : 'hover:bg-panel'
        }`}
        onClick={() => onSelect(conv.id)}
      >
        <div className="flex items-start justify-between gap-1.5">
          <span className={`text-sm truncate flex-1 font-medium ${isActive ? 'text-brand' : 'text-text'}`}>
            {conv.title}
          </span>
          <span className="text-[10px] text-muted shrink-0 mt-0.5 whitespace-nowrap">
            {relativeTime(conv.updatedAt)}
          </span>
        </div>
        {preview && (
          <p className="text-[11px] text-muted truncate mt-0.5 pr-4">{preview}</p>
        )}
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(conv.id); }}
          className="absolute right-2 top-2.5 opacity-0 group-hover:opacity-100 text-muted hover:text-red-400 transition-all text-xs px-1"
          title="Delete"
        >
          ✕
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 pb-3">
        <button
          onClick={onNew}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-brand/10 border border-brand/20 text-brand text-sm font-medium hover:bg-brand/20 transition-colors"
        >
          <span className="text-lg leading-none">+</span>
          New chat
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-2">
        {conversations.length === 0 && (
          <p className="text-xs text-muted text-center py-6">No conversations yet.</p>
        )}

        {todayConvs.length > 0 && (
          <>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted px-3 py-1.5">Today</p>
            <div className="space-y-0.5">{todayConvs.map(renderConv)}</div>
          </>
        )}

        {earlierConvs.length > 0 && (
          <>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted px-3 py-1.5 mt-3">Earlier</p>
            <div className="space-y-0.5">{earlierConvs.map(renderConv)}</div>
          </>
        )}
      </div>
    </div>
  );
}
