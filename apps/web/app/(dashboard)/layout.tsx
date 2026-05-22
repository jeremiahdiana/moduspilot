'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { AuthProvider, useAuth } from '@/components/providers/AuthProvider';
import { signOut } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { useRef, useState, useEffect } from 'react';
import { AnimatedThemeToggler } from '@/components/ui/animated-theme-toggler';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import CommandBar from '@/components/ui/CommandBar';
import { motion, AnimatePresence } from 'framer-motion';

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
  dashboard: 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z',
  briefing:  'M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9',
  briefing2: 'M13.73 21a2 2 0 01-3.46 0',
  chat:      'M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z',
  goals:     'M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9',
  habits:    'M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15',
  tasks:     'M9 11l3 3L22 4M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11',
  settings:  'M12 2a10 10 0 110 20A10 10 0 0112 2zm0 5v5l3 3',
} as const;

const NAV = [
  { href: '/dashboard', label: 'Dashboard', icon: 'dashboard' as const },
  { href: '/chat',      label: 'Chat',      icon: 'chat'      as const },
  { href: '/goals',     label: 'Goals',     icon: 'goals'     as const },
  { href: '/habits',    label: 'Habits',    icon: 'habits'    as const },
  { href: '/tasks',     label: 'Tasks',     icon: 'tasks'     as const },
];

function BriefingNavLink({ pathname }: { pathname: string }) {
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

  const active = pathname === '/briefing';

  return (
    <Link
      href="/briefing"
      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
        active ? 'bg-brand/10 text-brand' : 'text-muted hover:text-text hover:bg-panel'
      }`}
    >
      <Ico d={ICONS.briefing} d2={ICONS.briefing2} />
      <span className="flex-1">Briefing</span>
      {unread && !active && (
        <span className="w-1.5 h-1.5 rounded-full bg-brand shrink-0" />
      )}
    </Link>
  );
}

function SidebarContent({
  pathname,
  user,
  open,
  setOpen,
  onCmdOpen,
  onNavClick,
}: {
  pathname: string;
  user: ReturnType<typeof useAuth>['user'];
  open: boolean;
  setOpen: (v: boolean) => void;
  onCmdOpen: () => void;
  onNavClick?: () => void;
}) {
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
      <div className="mb-5 px-3 flex items-baseline gap-1.5">
        <span className="text-lg font-black tracking-widest text-brand">Modus</span>
        <span className="text-[10px] font-semibold text-muted tracking-widest uppercase">pilot</span>
      </div>

      {/* Ask MODUS button */}
      <button
        onClick={onCmdOpen}
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
      </button>

      {/* Nav */}
      <nav className="flex flex-col gap-0.5 flex-1">
        {NAV.slice(0, 1).map(item => (
          <Link key={item.href} href={item.href} onClick={onNavClick}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
              pathname === item.href ? 'bg-brand/10 text-brand' : 'text-muted hover:text-text hover:bg-panel'
            }`}
          >
            <Ico d={ICONS[item.icon]} />{item.label}
          </Link>
        ))}
        <BriefingNavLink pathname={pathname} />
        {NAV.slice(1).map(item => (
          <Link key={item.href} href={item.href} onClick={onNavClick}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
              pathname === item.href ? 'bg-brand/10 text-brand' : 'text-muted hover:text-text hover:bg-panel'
            }`}
          >
            <Ico d={ICONS[item.icon]} />{item.label}
          </Link>
        ))}
        <div className="mt-2 pt-2 border-t border-border/50">
          <Link href="/settings" onClick={onNavClick}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
              pathname === '/settings' ? 'bg-brand/10 text-brand' : 'text-muted hover:text-text hover:bg-panel'
            }`}
          >
            <Ico d={ICONS.settings} />Settings
          </Link>
        </div>
      </nav>

      {/* User menu */}
      <div className="mt-auto pt-3 border-t border-border" ref={menuRef}>
        <div className="px-2 pb-2 flex justify-end">
          <AnimatedThemeToggler sound={false} />
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
    <div className="flex h-screen overflow-hidden bg-bg">
      {/* Desktop sidebar */}
      <aside
        className="hidden md:flex shrink-0 border-r border-border flex-col relative"
        style={{ width: sidebarWidth }}
      >
        <SidebarContent
          pathname={pathname} user={user} open={open} setOpen={setOpen}
          onCmdOpen={() => setCmdOpen(true)}
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
              />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <main className="flex-1 overflow-hidden flex flex-col">
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
          <span className="text-sm font-bold text-brand tracking-widest">Modus</span>
        </div>

        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={pathname}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="flex-1 min-h-0 flex flex-col overflow-hidden"
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
