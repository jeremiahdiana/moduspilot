'use client';

import type { Conversation } from '@/hooks/useConversations';

interface Props {
  conversations: Conversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
}

export default function ConversationList({ conversations, activeId, onSelect, onNew, onDelete }: Props) {
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

      <div className="flex-1 overflow-y-auto space-y-0.5 px-2">
        {conversations.length === 0 && (
          <p className="text-xs text-muted text-center py-6">No conversations yet.</p>
        )}
        {conversations.map(conv => (
          <div
            key={conv.id}
            className={`group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
              activeId === conv.id ? 'bg-brand/10 text-text' : 'hover:bg-panel text-muted hover:text-text'
            }`}
            onClick={() => onSelect(conv.id)}
          >
            <span className="flex-1 text-sm truncate">{conv.title}</span>
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(conv.id); }}
              className="opacity-0 group-hover:opacity-100 text-muted hover:text-red-400 transition-all text-xs px-1"
              title="Delete"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
