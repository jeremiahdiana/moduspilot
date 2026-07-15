'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
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
  onTogglePin?: (id: string, pinned: boolean) => void;
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

function PinIcon({ filled = false }: { filled?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
      <path d="M12 17v5" />
      <path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z" />
    </svg>
  );
}

function DotsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5">
      <circle cx="12" cy="5" r="1.75" /><circle cx="12" cy="12" r="1.75" /><circle cx="12" cy="19" r="1.75" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
      <path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m3 0v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6" />
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
      <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
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

/**
 * The ⋯ overflow menu: rename / share / delete. Pin lives outside it, as its own toggle.
 *
 * The menu is PORTALLED to document.body and positioned fixed. Two reasons, both
 * of which made it unusable in place:
 *
 *  - Each row is a `motion.div layout="position"`, and framer-motion's layout
 *    prop applies a transform. A transformed element creates a stacking context,
 *    which TRAPS the menu's z-index inside its own row — so every row below
 *    painted straight over the menu, no matter how high the z-index went. That
 *    is not a z-index bug and raising it cannot fix it.
 *  - The list is an `overflow-y-auto` scroller, so an absolutely-positioned menu
 *    on a row near the bottom gets clipped by the scroller regardless.
 *
 * A portal escapes both. The trade: fixed coords go stale when the list scrolls,
 * so the menu closes on scroll rather than drifting away from its button.
 */
function RowMenu({ open, onOpen, onClose, onRename, onShare, onDelete }: {
  open: boolean; onOpen: () => void; onClose: () => void;
  onRename: (e: React.MouseEvent) => void; onShare: () => void; onDelete: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState<{ top: number; right: number } | null>(null);

  // Measure off the trigger, and flip above it when there isn't room below —
  // the menu is fixed to the viewport now, so it can't rely on the row for
  // placement the way an absolutely-positioned child did.
  useEffect(() => {
    if (!open) { setCoords(null); return; }
    const btn = ref.current?.getBoundingClientRect();
    if (!btn) return;
    const MENU_H = 116;
    const below = window.innerHeight - btn.bottom;
    setCoords({
      top: below < MENU_H + 8 ? btn.top - MENU_H - 4 : btn.bottom + 4,
      right: Math.max(8, window.innerWidth - btn.right),
    });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      const t = e.target as Node;
      if (ref.current?.contains(t) || menuRef.current?.contains(t)) return;
      onClose();
    }
    function onEsc(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onEsc);
    // Fixed coords are a snapshot; any scroll invalidates them. Capture phase so
    // the list's own scroller is heard, not just the window.
    window.addEventListener('scroll', onClose, true);
    window.addEventListener('resize', onClose);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onEsc);
      window.removeEventListener('scroll', onClose, true);
      window.removeEventListener('resize', onClose);
    };
  }, [open, onClose]);

  return (
    <div ref={ref} className="relative">
      <Tooltip label="More" side="bottom">
        <button
          onClick={(e) => { e.stopPropagation(); open ? onClose() : onOpen(); }}
          className={`p-1 rounded transition-colors ${open ? 'text-brand' : 'text-muted hover:text-text'}`}
          aria-label="More actions"
          aria-haspopup="menu"
          aria-expanded={open}
        >
          <DotsIcon />
        </button>
      </Tooltip>
      {open && coords && createPortal(
          <motion.div
            ref={menuRef}
            role="menu"
            initial={{ opacity: 0, scale: 0.94, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.14, ease: [0.16, 1, 0.3, 1] }}
            onClick={e => e.stopPropagation()}
            style={{ top: coords.top, right: coords.right }}
            className="fixed z-[100] w-36 origin-top-right bg-panel border border-border rounded-lg shadow-2xl p-1"
          >
            <button role="menuitem" onClick={(e) => { onClose(); onRename(e); }} className="flex items-center gap-2 w-full px-2 py-1.5 rounded-md text-xs text-text hover:bg-bg transition-colors">
              <span className="text-muted"><PencilIcon /></span> Rename
            </button>
            <button role="menuitem" onClick={() => { onClose(); onShare(); }} className="flex items-center gap-2 w-full px-2 py-1.5 rounded-md text-xs text-text hover:bg-bg transition-colors">
              <span className="text-muted"><ShareIcon /></span> Share
            </button>
            <div className="my-1 border-t border-border/60" />
            <button role="menuitem" onClick={() => { onClose(); onDelete(); }} className="flex items-center gap-2 w-full px-2 py-1.5 rounded-md text-xs text-red-400 hover:bg-red-400/10 transition-colors">
              <TrashIcon /> Delete
            </button>
          </motion.div>,
          document.body,
      )}
    </div>
  );
}

type Filter = 'all' | 'chats' | 'briefings';

export default function ConversationList({ conversations, activeId, onSelect, onNew, onDelete, onRename, onTogglePin, user }: Props) {
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
  // Pinned chats leave the date groups entirely — otherwise a pinned chat would
  // render twice (once under Pinned, once under Today/Earlier).
  const pinnedConvs  = visible.filter(c => c.pinned);
  const unpinned     = visible.filter(c => !c.pinned);
  const todayConvs   = unpinned.filter(c => isToday(c.updatedAt));
  const earlierConvs = unpinned.filter(c => !isToday(c.updatedAt));
  const [shareModalId, setShareModalId] = useState<string | null>(null);
  const [menuId, setMenuId] = useState<string | null>(null);
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
    const isMenuOpen = menuId === conv.id;

    const isEditing = editingId === conv.id;

    return (
      <motion.div
        key={conv.id}
        layout="position"
        transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
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
              {/* Share state used to live in the row's share button; that button
                  moved into the ⋯ menu, so the link state needs its own marker. */}
              {isSharedConv && (
                <Tooltip label="Shared link is live" side="bottom">
                  <span className="text-brand shrink-0 opacity-80"><ShareIcon /></span>
                </Tooltip>
              )}
            </span>
          )}
          {!isEditing && (
            <span className={`text-[10px] text-muted shrink-0 mt-0.5 whitespace-nowrap transition-opacity duration-150 group-hover:opacity-0 ${
              isMenuOpen || isShareOpen ? 'opacity-0' : ''
            }`}>
              {relativeTime(conv.updatedAt)}
            </span>
          )}
        </div>
        {preview && !isEditing && (
          <p className="text-[11px] text-muted truncate mt-0.5 pr-14">{preview}</p>
        )}

        {/* Row actions: pin toggle + an overflow menu (rename / share / delete).
            Stays visible while its menu is open, or the menu would vanish the
            moment the pointer left the row. Deliberately NOT force-shown for
            pinned rows: the actions sit on top of the timestamp, and the
            "Pinned" group header already says the chat is pinned. */}
        {!isEditing && (
          <div
            className={`absolute right-1.5 top-1.5 flex items-center gap-0.5 rounded-lg px-0.5 py-0.5 shadow-sm transition-all duration-150 ${isActive ? 'bg-brand/15' : 'bg-panel'} ${
              isMenuOpen || isShareOpen
                ? 'opacity-100 translate-x-0'
                : 'opacity-0 translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 focus-within:opacity-100 focus-within:translate-x-0'
            }`}
          >
            <Tooltip label={conv.pinned ? 'Unpin' : 'Pin'} side="bottom">
              <motion.button
                whileTap={{ scale: 0.82 }}
                onClick={(e) => { e.stopPropagation(); onTogglePin?.(conv.id, !conv.pinned); }}
                className={`p-1 rounded transition-colors ${conv.pinned ? 'text-brand' : 'text-muted hover:text-brand'}`}
                aria-label={conv.pinned ? 'Unpin conversation' : 'Pin conversation'}
                aria-pressed={!!conv.pinned}
              >
                <PinIcon filled={!!conv.pinned} />
              </motion.button>
            </Tooltip>
            <RowMenu
              open={isMenuOpen}
              onOpen={() => setMenuId(conv.id)}
              onClose={() => setMenuId(null)}
              onRename={(e) => startEdit(conv, e)}
              onShare={() => setShareModalId(conv.id)}
              onDelete={() => onDelete(conv.id)}
            />
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
      </motion.div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 pb-2.5">
        <motion.button
          onClick={onNew}
          whileTap={{ scale: 0.97 }}
          transition={{ duration: 0.12 }}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-brand/10 border border-brand/20 text-brand text-sm font-medium hover:bg-brand/20 transition-colors"
        >
          <span className="text-lg leading-none">+</span>
          New chat
        </motion.button>
      </div>

      {/* Filter — hide the flood of MODUS briefings. Only shown when briefings exist. */}
      {briefingCount > 0 && (
        <div className="px-3 pb-2.5">
          <div className="flex items-center gap-0.5 p-0.5 bg-panel/60 border border-border/60 rounded-lg">
            {(['all', 'chats', 'briefings'] as const).map(f => (
              <button
                key={f}
                onClick={() => changeFilter(f)}
                className={`relative flex-1 text-[11px] font-medium px-2 py-1 rounded-md capitalize transition-colors ${
                  filter === f ? 'text-brand' : 'text-muted hover:text-text'
                }`}
              >
                {/* Shared layoutId makes the active pill slide between filters
                    instead of blinking on/off. */}
                {filter === f && (
                  <motion.span
                    layoutId="chatFilterPill"
                    transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                    className="absolute inset-0 bg-brand/15 rounded-md"
                  />
                )}
                <span className="relative z-10">{f}</span>
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

        {pinnedConvs.length > 0 && (
          <>
            <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted px-3 py-1.5">
              <span className="opacity-70"><PinIcon filled /></span> Pinned
            </p>
            <div className="space-y-0.5">{pinnedConvs.map(renderConv)}</div>
          </>
        )}

        {todayConvs.length > 0 && (
          <>
            <p className={`text-[10px] font-semibold uppercase tracking-widest text-muted px-3 py-1.5 ${pinnedConvs.length > 0 ? 'mt-3' : ''}`}>Today</p>
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
