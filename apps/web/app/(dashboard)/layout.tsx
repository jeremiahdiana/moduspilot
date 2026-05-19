'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { AuthProvider, useAuth } from '@/components/providers/AuthProvider';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useRef, useState, useEffect } from 'react';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: '⊞' },
  { href: '/chat', label: 'Chat', icon: '◎' },
  { href: '/goals', label: 'Goals', icon: '◈' },
  { href: '/habits', label: 'Habits', icon: '◉' },
  { href: '/tasks', label: 'Tasks', icon: '☑' },
];

function DashboardLayoutInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div className="flex h-screen overflow-hidden bg-bg">
      <aside className="w-56 shrink-0 border-r border-border flex flex-col py-6 px-4">
        <div className="mb-8 px-2 flex items-baseline gap-1.5">
          <span className="text-xl font-black tracking-widest text-brand">Modus</span>
          <span className="text-xs font-medium text-muted tracking-widest">pilot</span>
        </div>

        <nav className="flex flex-col gap-1 flex-1">
          {navItems.map(item => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                pathname === item.href
                  ? 'bg-brand/10 text-brand'
                  : 'text-muted hover:text-text hover:bg-panel'
              }`}
            >
              <span className="text-base">{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>

        {/* User menu */}
        <div className="mt-auto pt-4 border-t border-border" ref={menuRef}>
          {/* Dropup */}
          {open && user && (
            <div className="mb-2 bg-panel border border-border rounded-xl overflow-hidden shadow-lg">
              <Link
                href="/settings"
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 px-4 py-3 text-sm text-muted hover:text-text hover:bg-bg transition-colors"
              >
                <span>⊙</span> Settings
              </Link>
              <Link
                href="/settings?tab=billing"
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 px-4 py-3 text-sm text-muted hover:text-text hover:bg-bg transition-colors border-t border-border"
              >
                <span>◆</span> Upgrade Plan
              </Link>
              <Link
                href="/how-it-works"
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 px-4 py-3 text-sm text-muted hover:text-text hover:bg-bg transition-colors border-t border-border"
              >
                <span>→</span> Learn More
              </Link>
              <button
                onClick={() => { signOut(auth); setOpen(false); }}
                className="flex items-center gap-3 w-full text-left px-4 py-3 text-sm text-muted hover:text-text hover:bg-bg transition-colors border-t border-border"
              >
                <span>↩</span> Sign Out
              </button>
            </div>
          )}

          {/* Trigger */}
          {user ? (
            <button
              onClick={() => setOpen(o => !o)}
              className="flex items-center gap-2 w-full px-2 py-2 rounded-lg hover:bg-panel transition-colors"
            >
              {user.photoURL ? (
                <img src={user.photoURL} alt="" className="w-7 h-7 rounded-full shrink-0" />
              ) : (
                <div className="w-7 h-7 rounded-full bg-brand/20 flex items-center justify-center shrink-0">
                  <span className="text-xs text-brand font-semibold">
                    {(user.displayName || user.email || '?')[0].toUpperCase()}
                  </span>
                </div>
              )}
              <div className="flex-1 min-w-0 text-left">
                <p className="text-xs text-text font-medium truncate">{user.displayName || user.email}</p>
                <p className="text-[10px] text-muted">Account</p>
              </div>
              <span className="text-muted text-xs">{open ? '▾' : '▴'}</span>
            </button>
          ) : (
            <Link
              href="/login"
              className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium text-muted hover:text-text hover:bg-panel transition-colors"
            >
              <span className="text-base">→</span>
              Sign in to save
            </Link>
          )}
        </div>
      </aside>

      <main className="flex-1 overflow-hidden flex flex-col">
        {children}
      </main>
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
