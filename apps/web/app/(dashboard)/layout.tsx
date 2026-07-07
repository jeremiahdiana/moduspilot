'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { AuthProvider, useAuth } from '@/components/providers/AuthProvider';
import { signOut } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { useRef, useState, useEffect, useCallback } from 'react';
import { AnimatedThemeToggler } from '@/components/ui/animated-theme-toggler';
import { collection, query, where, onSnapshot, doc, setDoc, limit } from 'firebase/firestore';
import CommandBar from '@/components/ui/CommandBar';
import { Tooltip } from '@/components/ui/Tooltip';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';

// Minimal inline SVG icons — stroke-based, 24x24 viewBox
function Ico({ d, d2, className }: { d: string; d2?: string; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`w-[18px] h-[18px] shrink-0 ${className ?? ''}`}
    >
      <path d={d} />
      {d2 && <path d={d2} />}
    </svg>
  );
}

const ICONS = {
  dashboard:   'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z',
  briefing:    'M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9',
  briefing2:   'M13.73 21a2 2 0 01-3.46 0',
  chat:        'M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z',
  projects:    'M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z',
  goals:       'M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9',
  reminders:   'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
  notes:       'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8zM14 2v6h6M8 13h8M8 17h5',
  group:       'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 7a4 4 0 100 8 4 4 0 000-8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75',
  connections: 'M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71',
  settings:    'M12 2a10 10 0 110 20A10 10 0 0112 2zm0 5v5l3 3',
} as const;

type NavItem = { key: string; href: string; label: string; icon: keyof typeof ICONS; special?: 'briefing' };

// Primary group — the daily essentials, always visible (no group label).
// Briefing is no longer a destination — it now surfaces at the top of the
// Dashboard (the single "Today" home). The Dashboard item carries the unread
// briefing dot so "you have a new briefing" still has a nav signal. The full
// interactive /briefing page stays reachable via that hero + ⌘K.
const PRIMARY: NavItem[] = [
  { key: 'chat',      href: '/chat',      label: 'Chat',      icon: 'chat'      },
  { key: 'dashboard', href: '/dashboard', label: 'Dashboard', icon: 'dashboard', special: 'briefing' },
  { key: 'projects',  href: '/projects',  label: 'Projects',  icon: 'projects'  },
];

// Workspace group — collapsible, labeled "WORKSPACE".
const WORKSPACE: NavItem[] = [
  { key: 'goals',     href: '/goals',     label: 'Goals',     icon: 'goals'     },
  { key: 'reminders', href: '/reminders', label: 'Reminders', icon: 'reminders' },
  { key: 'notes',     href: '/notes',     label: 'Notes',     icon: 'notes'     },
  { key: 'group',     href: '/group',     label: 'Group',     icon: 'group'     },
];

// Bottom group — pinned above Settings.
const BOTTOM: NavItem[] = [
  { key: 'capabilities', href: '/capabilities', label: 'Capabilities', icon: 'connections' },
];

function NavLink({ item, pathname, onNavClick }: { item: NavItem; pathname: string; onNavClick?: () => void }) {
  const active = pathname === item.href;
  return (
    <Link
      href={item.href}
      onClick={onNavClick}
      className={`relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
        active ? 'text-brand' : 'text-muted hover:text-text hover:bg-panel'
      }`}
    >
      {active && (
        <motion.div
          layoutId="nav-active-pill"
          className="absolute inset-0 rounded-xl bg-brand/10"
          transition={{ type: 'spring', stiffness: 380, damping: 32 }}
        />
      )}
      <Ico d={ICONS[item.icon]} className="relative" /><span className="relative">{item.label}</span>
    </Link>
  );
}

// Live-subscribes to the user's sidebar prefs (hidden items + collapse state),
// stored in Firestore users/{uid}.settings.sidebar so they sync across devices.
function useSidebarPrefs(uid: string | undefined) {
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [workspaceCollapsed, setWorkspaceCollapsed] = useState(false);

  useEffect(() => {
    if (!uid) { setHidden(new Set()); setWorkspaceCollapsed(false); return; }
    const unsub = onSnapshot(doc(db, 'users', uid), snap => {
      const sb = snap.data()?.settings?.sidebar;
      setHidden(new Set(Array.isArray(sb?.hidden) ? sb.hidden : []));
      setWorkspaceCollapsed(!!sb?.workspaceCollapsed);
    });
    return unsub;
  }, [uid]);

  const toggleWorkspace = useCallback(() => {
    if (!uid) return;
    const next = !workspaceCollapsed;
    setWorkspaceCollapsed(next); // optimistic
    // Firestore merge is recursive for nested maps, so this leaves `hidden` intact.
    void setDoc(doc(db, 'users', uid), { settings: { sidebar: { workspaceCollapsed: next } } }, { merge: true });
  }, [uid, workspaceCollapsed]);

  return { hidden, workspaceCollapsed, toggleWorkspace };
}

// A NavLink that also shows an unread-briefing dot. Used for the Dashboard item
// now that the briefing lives on the dashboard (no standalone Briefing nav item).
function NavLinkWithBriefingDot({ item, pathname, onNavClick }: { item: NavItem; pathname: string; onNavClick?: () => void }) {
  const { user } = useAuth();
  const [unread, setUnread] = useState(false);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'users', user.uid, 'conversations'),
      where('briefing', '==', true),
      where('read', '==', false),
    );
    const unsub = onSnapshot(q, snap => setUnread(!snap.empty));
    return unsub;
  }, [user]);

  const active = pathname === item.href;

  return (
    <Link
      href={item.href}
      onClick={onNavClick}
      className={`relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
        active ? 'text-brand' : 'text-muted hover:text-text hover:bg-panel'
      }`}
    >
      {active && (
        <motion.div
          layoutId="nav-active-pill"
          className="absolute inset-0 rounded-xl bg-brand/10"
          transition={{ type: 'spring', stiffness: 380, damping: 32 }}
        />
      )}
      <Ico d={ICONS[item.icon]} className="relative" />
      <span className="relative flex-1">{item.label}</span>
      {unread && !active && (
        <span className="relative w-1.5 h-1.5 rounded-full bg-brand shrink-0" />
      )}
    </Link>
  );
}

// True when the user has at least one synced note. Notes are read-only and only
// populated by the Mac desktop app, so web/iPhone-only users have none — we hide
// the nav item rather than show a permanently empty page.
function useHasNotes(uid: string | undefined) {
  const [hasNotes, setHasNotes] = useState(false);
  useEffect(() => {
    if (!uid) { setHasNotes(false); return; }
    const unsub = onSnapshot(
      query(collection(db, 'users', uid, 'notes'), limit(1)),
      snap => setHasNotes(!snap.empty),
      () => setHasNotes(false),
    );
    return unsub;
  }, [uid]);
  return hasNotes;
}

// True when Group is relevant: the user is in a group, on the group plan, or has
// a pending invite (so an invitee can still reach /group to accept). Reads the
// user doc directly — useUserSettings.plan drops the 'group' value.
function useGroupVisible(uid: string | undefined, email: string | null | undefined) {
  const [inGroup, setInGroup] = useState(false);
  const [invited, setInvited] = useState(false);

  useEffect(() => {
    if (!uid) { setInGroup(false); return; }
    const unsub = onSnapshot(doc(db, 'users', uid), snap => {
      const d = snap.data();
      setInGroup(!!d?.groupId || d?.plan === 'group');
    }, () => setInGroup(false));
    return unsub;
  }, [uid]);

  useEffect(() => {
    if (!email) { setInvited(false); return; }
    const unsub = onSnapshot(
      query(collection(db, 'groupInvites'), where('email', '==', email)),
      snap => setInvited(!snap.empty),
      () => setInvited(false),
    );
    return unsub;
  }, [email]);

  return inGroup || invited;
}

function SidebarContent({
  pathname,
  user,
  open,
  setOpen,
  onCmdOpen,
  onNavClick,
  hidden,
  hasNotes,
  groupVisible,
  workspaceCollapsed,
  onToggleWorkspace,
}: {
  pathname: string;
  user: ReturnType<typeof useAuth>['user'];
  open: boolean;
  setOpen: (v: boolean) => void;
  onCmdOpen: () => void;
  onNavClick?: () => void;
  hidden: Set<string>;
  hasNotes: boolean;
  groupVisible: boolean;
  workspaceCollapsed: boolean;
  onToggleWorkspace: () => void;
}) {
  const visibleWorkspace = WORKSPACE.filter(i =>
    !hidden.has(i.key)
    && (i.key !== 'notes' || hasNotes)     // Notes only when synced notes exist
    && (i.key !== 'group' || groupVisible)  // Group only when relevant
  );
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [setOpen]);

  return (
    <div className="flex flex-col h-full py-5 px-3">
      {/* Logo */}
      <div className="mb-5 px-3 flex items-center gap-2">
        <Image src="/logo.png" alt="MODUS" width={64} height={48} className="object-contain shrink-0 block dark:hidden" />
        <Image src="/logo-dark.png" alt="MODUS" width={64} height={48} className="object-contain shrink-0 hidden dark:block" />
        <div className="flex flex-col leading-none">
          <span className="text-sm font-black tracking-widest text-brand">MODUS</span>
          <span className="text-[9px] font-semibold text-muted tracking-widest uppercase">pilot</span>
        </div>
      </div>

      {/* Ask MODUS button */}
      <motion.button
        onClick={onCmdOpen}
        whileHover={{ scale: 1.015, y: -1 }}
        whileTap={{ scale: 0.98 }}
        transition={{ type: 'spring', stiffness: 400, damping: 25 }}
        className="flex items-center gap-2 mx-1 mb-4 px-3 py-2 rounded-xl border border-dashed border-border text-muted hover:border-brand/40 hover:text-brand hover:bg-brand/5 transition-all group"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5 shrink-0">
          <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
        </svg>
        <span className="flex-1 text-xs font-medium">Ask MODUS</span>
        <div className="flex items-center gap-0.5">
          <kbd className="text-[9px] bg-bg border border-border/60 rounded px-1 py-0.5 font-mono leading-none">⌘</kbd>
          <kbd className="text-[9px] bg-bg border border-border/60 rounded px-1 py-0.5 font-mono leading-none">K</kbd>
        </div>
      </motion.button>

      {/* Nav */}
      <LayoutGroup>
        <nav className="group/nav flex flex-col gap-0.5 flex-1">
          {/* Primary group — daily essentials */}
          {PRIMARY.filter(i => i.key === 'chat' || !hidden.has(i.key)).map(item =>
            item.special === 'briefing'
              ? <NavLinkWithBriefingDot key={item.key} item={item} pathname={pathname} onNavClick={onNavClick} />
              : <NavLink key={item.key} item={item} pathname={pathname} onNavClick={onNavClick} />
          )}

          {/* Workspace group — collapsible */}
          {visibleWorkspace.length > 0 && (
            <div className="mt-3">
              <button
                onClick={onToggleWorkspace}
                className="flex items-center gap-1.5 w-full px-3 mb-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted/70 hover:text-muted transition-colors"
              >
                <span className="flex-1 text-left">Workspace</span>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.25} strokeLinecap="round" strokeLinejoin="round"
                  className={`w-3 h-3 shrink-0 transition-transform ${workspaceCollapsed ? '-rotate-90' : ''}`}>
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </button>
              <AnimatePresence initial={false}>
                {!workspaceCollapsed && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                    className="overflow-hidden flex flex-col gap-0.5"
                  >
                    {visibleWorkspace.map(item => (
                      <NavLink key={item.key} item={item} pathname={pathname} onNavClick={onNavClick} />
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* Bottom group — Capabilities + Settings */}
          <div className="mt-2 pt-2 border-t border-border/50 flex flex-col gap-0.5">
            {BOTTOM.filter(i => !hidden.has(i.key)).map(item => (
              <NavLink key={item.key} item={item} pathname={pathname} onNavClick={onNavClick} />
            ))}
            <Link href="/settings" onClick={onNavClick}
              className={`relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                pathname === '/settings' ? 'text-brand' : 'text-muted hover:text-text hover:bg-panel'
              }`}
            >
              {pathname === '/settings' && (
                <motion.div
                  layoutId="nav-active-pill"
                  className="absolute inset-0 rounded-xl bg-brand/10"
                  transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                />
              )}
              <Ico d={ICONS.settings} className="relative" /><span className="relative">Settings</span>
            </Link>
            {/* Customize — subtle, revealed on sidebar hover */}
            <Link href="/settings?tab=sidebar" onClick={onNavClick}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-[11px] font-medium text-muted/50 hover:text-muted opacity-0 group-hover/nav:opacity-100 focus:opacity-100 transition-opacity"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3 shrink-0">
                <path d="M12 2a10 10 0 110 20A10 10 0 0112 2z" /><path d="M12 8v4l2.5 2.5" />
              </svg>
              Customize sidebar
            </Link>
          </div>
        </nav>
      </LayoutGroup>

      {/* User menu */}
      <div className="mt-auto pt-3 border-t border-border" ref={menuRef}>
        <div className="px-2 pb-2 flex justify-end">
          <Tooltip label="Toggle theme" side="left">
            <AnimatedThemeToggler sound={false} />
          </Tooltip>
        </div>
        {open && user && (
          <div className="mb-2 bg-panel border border-border rounded-xl overflow-hidden shadow-lg">
            <Link href="/settings?tab=billing" onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-4 py-3 text-sm text-muted hover:text-text hover:bg-bg transition-colors">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5"><path d="M21 4H3a2 2 0 00-2 2v12a2 2 0 002 2h18a2 2 0 002-2V6a2 2 0 00-2-2zM1 10h22" /></svg>
              Upgrade Plan
            </Link>
            <button onClick={() => { signOut(auth); setOpen(false); }}
              className="flex items-center gap-3 w-full text-left px-4 py-3 text-sm text-red-400 hover:bg-red-900/10 transition-colors border-t border-border">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" /></svg>
              Sign Out
            </button>
          </div>
        )}
        {user ? (
          <button onClick={() => setOpen(!open)}
            className="flex items-center gap-2.5 w-full px-2 py-2 rounded-xl hover:bg-panel transition-colors">
            {user.photoURL ? (
              <img src={user.photoURL} alt="" className="w-7 h-7 rounded-full shrink-0 ring-1 ring-border" />
            ) : (
              <div className="w-7 h-7 rounded-full bg-brand/20 flex items-center justify-center shrink-0">
                <span className="text-xs text-brand font-semibold">{(user.displayName || user.email || '?')[0].toUpperCase()}</span>
              </div>
            )}
            <div className="flex-1 min-w-0 text-left">
              <p className="text-xs text-text font-medium truncate">{user.displayName || user.email}</p>
              <p className="text-[10px] text-muted">Account</p>
            </div>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3 text-muted">
              <path d={open ? 'M18 15l-6-6-6 6' : 'M6 9l6 6 6-6'} />
            </svg>
          </button>
        ) : (
          <Link href="/login"
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-muted hover:text-text hover:bg-panel transition-colors">
            <Ico d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4M10 17l5-5-5-5M15 12H3" />Sign in
          </Link>
        )}
      </div>
    </div>
  );
}

const SIDEBAR_MIN = 180;
const SIDEBAR_MAX = 320;
const SIDEBAR_DEFAULT = 224;

function DashboardLayoutInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user } = useAuth();
  const { hidden, workspaceCollapsed, toggleWorkspace } = useSidebarPrefs(user?.uid);
  const hasNotes = useHasNotes(user?.uid);
  const groupVisible = useGroupVisible(user?.uid, user?.email);
  const [open, setOpen] = useState(false);
  const [cmdOpen, setCmdOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(SIDEBAR_DEFAULT);
  const dragStartX = useRef(0);
  const dragStartWidth = useRef(SIDEBAR_DEFAULT);
  const dragCurrentWidth = useRef(SIDEBAR_DEFAULT);

  // Load persisted width
  useEffect(() => {
    const saved = localStorage.getItem('sidebar-width');
    if (saved) {
      const w = Number(saved);
      if (w >= SIDEBAR_MIN && w <= SIDEBAR_MAX) {
        setSidebarWidth(w);
        dragCurrentWidth.current = w;
      }
    }
  }, []);

  // Close mobile sidebar on route change
  useEffect(() => { setMobileOpen(false); }, [pathname]);

  // Global Cmd+K / Ctrl+K listener
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCmdOpen(o => !o);
      }
      if (e.key === 'Escape') { setCmdOpen(false); setMobileOpen(false); }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  function startSidebarDrag(e: React.MouseEvent) {
    dragStartX.current = e.clientX;
    dragStartWidth.current = sidebarWidth;
    dragCurrentWidth.current = sidebarWidth;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    function onMove(ev: MouseEvent) {
      const w = Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, dragStartWidth.current + ev.clientX - dragStartX.current));
      setSidebarWidth(w);
      dragCurrentWidth.current = w;
    }

    function onUp() {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      localStorage.setItem('sidebar-width', String(dragCurrentWidth.current));
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    }

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }

  return (
    <div className="flex h-screen overflow-hidden bg-bg max-w-[100vw]">
      {/* Desktop sidebar */}
      <aside
        className="hidden md:flex shrink-0 border-r border-border flex-col relative"
        style={{ width: sidebarWidth }}
      >
        <SidebarContent
          pathname={pathname} user={user} open={open} setOpen={setOpen}
          onCmdOpen={() => setCmdOpen(true)}
          hidden={hidden} hasNotes={hasNotes} groupVisible={groupVisible}
          workspaceCollapsed={workspaceCollapsed} onToggleWorkspace={toggleWorkspace}
        />
        {/* Drag handle */}
        <div
          className="absolute inset-y-0 right-0 w-1 cursor-col-resize hover:bg-brand/40 active:bg-brand/60 transition-colors z-10"
          onMouseDown={startSidebarDrag}
        />
      </aside>

      {/* Mobile drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-40 bg-black/50 md:hidden"
              onClick={() => setMobileOpen(false)}
            />
            <motion.div
              initial={{ x: -224 }}
              animate={{ x: 0 }}
              exit={{ x: -224 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              className="fixed inset-y-0 left-0 z-50 w-56 bg-bg border-r border-border md:hidden"
            >
              <SidebarContent
                pathname={pathname} user={user} open={open} setOpen={setOpen}
                onCmdOpen={() => { setCmdOpen(true); setMobileOpen(false); }}
                onNavClick={() => setMobileOpen(false)}
                hidden={hidden} hasNotes={hasNotes} groupVisible={groupVisible}
                workspaceCollapsed={workspaceCollapsed} onToggleWorkspace={toggleWorkspace}
              />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <main className="flex-1 overflow-hidden overflow-x-hidden flex flex-col min-w-0">
        {/* Mobile header bar */}
        <div className="md:hidden flex items-center gap-3 px-4 py-3 border-b border-border shrink-0">
          <button
            onClick={() => setMobileOpen(true)}
            className="w-8 h-8 flex items-center justify-center text-muted hover:text-text transition-colors rounded-lg hover:bg-panel"
            aria-label="Open menu"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
          <div className="flex items-center gap-1.5">
            <Image src="/logo.png" alt="MODUS" width={48} height={36} className="object-contain block dark:hidden" />
            <Image src="/logo-dark.png" alt="MODUS" width={48} height={36} className="object-contain hidden dark:block" />
            <span className="text-xs font-black tracking-widest text-brand">MODUS</span>
          </div>
        </div>

        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={pathname}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ type: 'spring', stiffness: 340, damping: 32 }}
            className="flex-1 min-h-0 flex flex-col overflow-hidden overflow-x-hidden"
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </main>

      <CommandBar open={cmdOpen} onClose={() => setCmdOpen(false)} user={user} />
    </div>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <DashboardLayoutInner>{children}</DashboardLayoutInner>
    </AuthProvider>
  );
}
