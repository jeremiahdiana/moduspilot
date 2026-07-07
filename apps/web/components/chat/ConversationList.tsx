'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import type { User } from 'firebase/auth';
import type { Conversation } from '@/hooks/useConversations';
import { Tooltip } from '@/components/ui/Tooltip';

interface Props {
  conversations: Conversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  onRename: (id: string, title: string) => void;
  user: User | null;
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

function ShareIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
      <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
      <polyline points="16 6 12 2 8 6"/>
      <line x1="12" y1="2" x2="12" y2="15"/>
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  );
}

interface ShareModalProps {
  conv: Conversation;
  user: User | null;
  onClose: () => void;
  onShareIdChange: (convId: string, shareId: string | undefined) => void;
}

function ShareModal({ conv, user, onClose, onShareIdChange }: ShareModalProps) {
  const [shareId, setShareId] = useState<string | undefined>(conv.shareId);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const shareUrl = shareId ? `${typeof window !== 'undefined' ? window.location.origin : ''}/s/${shareId}` : '';

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClose]);

  async function createLink() {
    if (!user) return;
    setLoading(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch('/api/share/create', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ convId: conv.id }),
      });
      const data = await res.json();
      if (data.shareId) {
        setShareId(data.shareId);
        onShareIdChange(conv.id, data.shareId);
      }
    } finally {
      setLoading(false);
    }
  }

  async function revokeLink() {
    if (!user || !shareId) return;
    setLoading(true);
    try {
      const token = await user.getIdToken();
      await fetch('/api/share/revoke', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ shareId, convId: conv.id }),
      });
      setShareId(undefined);
      onShareIdChange(conv.id, undefined);
    } finally {
      setLoading(false);
    }
  }

  function copyLink() {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div
      ref={ref}
      className="absolute right-0 top-8 z-50 w-72 bg-panel border border-border rounded-xl shadow-2xl p-4 space-y-3"
      onClick={e => e.stopPropagation()}
    >
      <div>
        <p className="text-sm font-semibold text-text">Share conversation</p>
        <p className="text-[11px] text-muted mt-0.5">Anyone with the link can view this conversation.</p>
      </div>

      {shareId ? (
        <>
          <div className="flex items-center gap-2 bg-bg border border-border rounded-lg px-3 py-2">
            <span className="text-[11px] text-muted truncate flex-1 font-mono">{shareUrl}</span>
            <button
              onClick={copyLink}
              className={`shrink-0 transition-colors ${copied ? 'text-emerald-400' : 'text-muted hover:text-text'}`}
              title="Copy link"
            >
              {copied ? <CheckIcon /> : <CopyIcon />}
            </button>
          </div>
          <div className="flex gap-2">
            <button
              onClick={copyLink}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-brand text-white text-xs font-medium rounded-lg hover:bg-brand/90 transition-colors"
            >
              {copied ? <><CheckIcon /> Copied!</> : <><CopyIcon /> Copy link</>}
            </button>
            <button
              onClick={revokeLink}
              disabled={loading}
              className="px-3 py-2 border border-border text-muted hover:text-red-400 hover:border-red-400/30 text-xs rounded-lg transition-colors disabled:opacity-40"
            >
              {loading ? '…' : 'Revoke'}
            </button>
          </div>
        </>
      ) : (
        <button
          onClick={createLink}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 px-3 py-2.5 bg-brand text-white text-sm font-medium rounded-lg hover:bg-brand/90 disabled:opacity-50 transition-colors"
        >
          {loading ? (
            <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <ShareIcon />
          )}
          {loading ? 'Creating link…' : 'Create share link'}
        </button>
      )}
    </div>
  );
}

type Filter = 'all' | 'chats' | 'briefings';

export default function ConversationList({ conversations, activeId, onSelect, onNew, onDelete, onRename, user }: Props) {
  // Filter the flood of MODUS-generated briefings/check-ins out of the chat list.
  // Defaults to "chats" (real conversations) since that's what the sidebar is for;
  // briefings live on the Briefing page + dashboard, and are one click away here.
  const [filter, setFilter] = useState<Filter>('chats');
  useEffect(() => {
    const saved = localStorage.getItem('modus:chatFilter');
    if (saved === 'all' || saved === 'chats' || saved === 'briefings') setFilter(saved);
  }, []);
  const changeFilter = useCallback((f: Filter) => {
    setFilter(f);
    localStorage.setItem('modus:chatFilter', f);
  }, []);

  const briefingCount = conversations.filter(c => c.system).length;
  const visible = conversations.filter(c =>
    filter === 'all' ? true : filter === 'chats' ? !c.system : c.system
  );
  const todayConvs   = visible.filter(c => isToday(c.updatedAt));
  const earlierConvs = visible.filter(c => !isToday(c.updatedAt));
  const [shareModalId, setShareModalId] = useState<string | null>(null);
  const [shareOverrides, setShareOverrides] = useState<Record<string, string | undefined>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const editInputRef = useRef<HTMLInputElement>(null);

  const startEdit = useCallback((conv: Conversation, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(conv.id);
    setEditingTitle(conv.title);
    setTimeout(() => { editInputRef.current?.focus(); editInputRef.current?.select(); }, 10);
  }, []);

  const saveEdit = useCallback(() => {
    if (editingId) onRename(editingId, editingTitle.trim() || 'New chat');
    setEditingId(null);
  }, [editingId, editingTitle, onRename]);

  function handleShareIdChange(convId: string, sid: string | undefined) {
    setShareOverrides(prev => ({ ...prev, [convId]: sid }));
  }

  function renderConv(conv: Conversation) {
    const preview = getLastMessage(conv);
    const isActive = activeId === conv.id;
    const effectiveShareId = shareOverrides[conv.id] !== undefined ? shareOverrides[conv.id] : conv.shareId;
    const isSharedConv = !!effectiveShareId;
    const isShareOpen = shareModalId === conv.id;

    const isEditing = editingId === conv.id;

    return (
      <div
        key={conv.id}
        className={`group relative flex flex-col px-3 py-2.5 rounded-lg cursor-pointer transition-colors ${
          isActive ? 'bg-brand/10' : 'hover:bg-panel'
        }`}
        onClick={() => { if (!isEditing) onSelect(conv.id); }}
      >
        <div className="flex items-start justify-between gap-1.5">
          {isEditing ? (
            <input
              ref={editInputRef}
              value={editingTitle}
              onChange={e => setEditingTitle(e.target.value)}
              onBlur={saveEdit}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); saveEdit(); } if (e.key === 'Escape') setEditingId(null); }}
              onClick={e => e.stopPropagation()}
              className="flex-1 text-sm font-medium bg-transparent border-b border-brand text-text outline-none min-w-0 pb-0.5"
            />
          ) : (
            <span
              onDoubleClick={e => startEdit(conv, e)}
              title={`${conv.title} · double-click to rename`}
              className={`text-sm truncate flex-1 font-medium flex items-center gap-1.5 ${
                isActive ? 'text-brand' : conv.system ? 'text-muted' : 'text-text'
              }`}
            >
              {conv.system && (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3 shrink-0 opacity-70">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                  <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
              )}
              <span className="truncate">{conv.title}</span>
            </span>
          )}
          {!isEditing && (
            <span className="text-[10px] text-muted shrink-0 mt-0.5 whitespace-nowrap transition-opacity duration-150 group-hover:opacity-0">
              {relativeTime(conv.updatedAt)}
            </span>
          )}
        </div>
        {preview && !isEditing && (
          <p className="text-[11px] text-muted truncate mt-0.5 pr-14">{preview}</p>
        )}

        {/* Hover actions */}
        {!isEditing && (
          <div className={`absolute right-1.5 top-1.5 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg px-0.5 py-0.5 shadow-sm ${isActive ? 'bg-brand/15' : 'bg-panel'}`}>
            <Tooltip label="Rename" side="bottom">
            <button
              onClick={(e) => startEdit(conv, e)}
              className="p-1 rounded text-muted hover:text-brand transition-colors"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3">
                <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            </button>
            </Tooltip>
            <Tooltip label={isSharedConv ? 'Shared' : 'Share'} side="bottom">
            <button
              onClick={(e) => { e.stopPropagation(); setShareModalId(isShareOpen ? null : conv.id); }}
              className={`p-1 rounded transition-colors ${isSharedConv ? 'text-brand' : 'text-muted hover:text-brand'}`}
            >
              <ShareIcon />
            </button>
            </Tooltip>
            <Tooltip label="Delete" side="bottom">
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(conv.id); }}
              className="p-1 rounded text-muted hover:text-red-400 transition-colors text-xs"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
            </Tooltip>
          </div>
        )}

        {isShareOpen && (
          <ShareModal
            conv={{ ...conv, shareId: effectiveShareId }}
            user={user}
            onClose={() => setShareModalId(null)}
            onShareIdChange={handleShareIdChange}
          />
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 pb-2.5">
        <button
          onClick={onNew}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-brand/10 border border-brand/20 text-brand text-sm font-medium hover:bg-brand/20 transition-colors"
        >
          <span className="text-lg leading-none">+</span>
          New chat
        </button>
      </div>

      {/* Filter — hide the flood of MODUS briefings. Only shown when briefings exist. */}
      {briefingCount > 0 && (
        <div className="px-3 pb-2.5">
          <div className="flex items-center gap-0.5 p-0.5 bg-panel/60 border border-border/60 rounded-lg">
            {(['all', 'chats', 'briefings'] as const).map(f => (
              <button
                key={f}
                onClick={() => changeFilter(f)}
                className={`flex-1 text-[11px] font-medium px-2 py-1 rounded-md capitalize transition-colors ${
                  filter === f ? 'bg-brand/15 text-brand' : 'text-muted hover:text-text'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-2">
        {conversations.length === 0 ? (
          <p className="text-xs text-muted text-center py-6">No conversations yet.</p>
        ) : visible.length === 0 && (
          <p className="text-xs text-muted text-center py-6">
            {filter === 'briefings' ? 'No briefings.' : filter === 'chats' ? 'No chats yet.' : 'Nothing here.'}
          </p>
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
