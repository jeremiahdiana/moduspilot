'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { AnimatedThemeToggler } from '@/components/ui/animated-theme-toggler';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';

interface Props {
  solid?: boolean;
  /** Homepage marketing chrome: renders an in-session theme toggle instead of
   *  the global AnimatedThemeToggler, and picks the logo to match `marketingTheme`. */
  marketingTheme?: 'light' | 'dark';
  onToggleTheme?: () => void;
}

interface NavItem { href: string; label: string; }
interface NavMenu { label: string; items: NavItem[]; }

// Simple text-list dropdowns (Anthropic/Perplexity style). Every destination is a
// real page filled with real content — no placeholders.
const MENUS: NavMenu[] = [
  {
    label: 'Product',
    items: [
      { href: '/features', label: 'Chat' },
      { href: '/product/compare', label: 'Compare models' },
      { href: '/product/integrations', label: 'Integrations' },
      { href: '/download/mac', label: 'Desktop apps' },
    ],
  },
  {
    label: 'Resources',
    items: [
      { href: '/blog', label: 'Blog' },
      { href: '/download/mac', label: 'Download' },
      { href: '/changelog', label: 'Changelog' },
    ],
  },
  {
    label: 'Company',
    items: [
      { href: '/about', label: 'About' },
      { href: '/privacy', label: 'Privacy' },
      { href: '/terms', label: 'Terms' },
    ],
  },
];

const LINKS: NavItem[] = [
  { href: '/use-cases', label: 'Use cases' },
  { href: '/pricing', label: 'Pricing' },
];

export default function Navbar({ solid = false, marketingTheme, onToggleTheme }: Props) {
  const isMarketing = !!marketingTheme;
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [authedUser, setAuthedUser] = useState<{ name: string | null; email: string | null } | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const pathname = usePathname();
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setAuthedUser(u ? { name: u.displayName, email: u.email } : null);
      setAuthLoading(false);
    });
    return unsub;
  }, []);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, []);

  useEffect(() => { setMenuOpen(false); setOpenMenu(null); }, [pathname]);

  const showBg = solid || scrolled || menuOpen || !!openMenu;

  // Hover intent: a small close delay lets the pointer travel from the trigger
  // into the panel without the menu snapping shut.
  const openNow = (label: string) => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setOpenMenu(label);
  };
  const closeSoon = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setOpenMenu(null), 120);
  };

  const linkActive = (href: string) => pathname === href;

  return (
    <motion.nav
      initial={{ opacity: 0, y: -16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className={`fixed top-0 left-0 right-0 z-50 transition-colors duration-300 ${
        showBg ? 'bg-bg/85 backdrop-blur-xl border-b border-border' : 'bg-transparent border-b border-transparent'
      }`}
    >
      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-2">
        <Link href="/" className="flex items-center gap-1.5 shrink-0">
          {isMarketing ? (
            <Image src={marketingTheme === 'dark' ? '/logo-dark.png' : '/logo.png'} alt="MODUS" width={52} height={40} className="object-contain" />
          ) : (
            <>
              <Image src="/logo.png" alt="MODUS" width={52} height={40} className="object-contain block dark:hidden" />
              <Image src="/logo-dark.png" alt="MODUS" width={52} height={40} className="object-contain hidden dark:block" />
            </>
          )}
          <div className="flex flex-col leading-none">
            <span className="text-sm font-bold tracking-widest text-text">MODUS</span>
            <span className="text-[8px] font-semibold text-muted tracking-widest uppercase">pilot</span>
          </div>
        </Link>

        {/* Desktop nav: dropdown menus + flat links */}
        <div className="hidden md:flex items-center gap-1">
          {MENUS.map(menu => (
            <div
              key={menu.label}
              className="relative"
              onMouseEnter={() => openNow(menu.label)}
              onMouseLeave={closeSoon}
            >
              <button
                onClick={() => setOpenMenu(o => (o === menu.label ? null : menu.label))}
                className={`flex items-center gap-1 px-3 py-2 text-sm rounded-md transition-colors ${
                  openMenu === menu.label ? 'text-text' : 'text-muted hover:text-text'
                }`}
                aria-expanded={openMenu === menu.label}
              >
                {menu.label}
                <svg viewBox="0 0 12 12" className={`w-2.5 h-2.5 transition-transform ${openMenu === menu.label ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth={1.6}>
                  <path d="M2.5 4.5 6 8l3.5-3.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              <AnimatePresence>
                {openMenu === menu.label && (
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 6 }}
                    transition={{ duration: 0.14, ease: 'easeOut' }}
                    className="absolute left-0 top-full pt-2 min-w-[200px]"
                  >
                    <div className="rounded-xl border border-border bg-panel shadow-[0_12px_40px_-16px_rgba(0,0,0,0.25)] p-1.5">
                      {menu.items.map(item => (
                        <Link
                          key={item.href + item.label}
                          href={item.href}
                          className={`block px-3 py-2 rounded-lg text-sm transition-colors ${
                            linkActive(item.href) ? 'text-text bg-text/[0.06]' : 'text-muted hover:text-text hover:bg-text/[0.05]'
                          }`}
                        >
                          {item.label}
                        </Link>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
          {LINKS.map(link => (
            <Link
              key={link.href}
              href={link.href}
              className={`px-3 py-2 text-sm rounded-md transition-colors ${
                linkActive(link.href) ? 'text-text' : 'text-muted hover:text-text'
              }`}
            >
              {link.label}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          {isMarketing ? (
            <button
              onClick={onToggleTheme}
              aria-label="Toggle theme"
              className="w-8 h-8 rounded-lg flex items-center justify-center text-muted hover:text-text hover:bg-text/[0.06] transition-colors"
            >
              {marketingTheme === 'dark' ? (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-4 h-4">
                  <circle cx="12" cy="12" r="4" />
                  <path strokeLinecap="round" d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
                </svg>
              )}
            </button>
          ) : (
            <AnimatedThemeToggler />
          )}
          <AnimatePresence mode="wait">
            {authLoading ? (
              <motion.div
                key="auth-skeleton"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="flex items-center gap-2"
              >
                <div className="w-7 h-7 rounded-full bg-text/10 animate-pulse" />
                <div className="hidden sm:block w-16 h-4 rounded bg-text/10 animate-pulse" />
              </motion.div>
            ) : authedUser ? (
              <motion.div
                key="auth-user"
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25, ease: 'easeOut' }}
                className="flex items-center gap-2.5"
              >
                <div className="hidden sm:flex items-center gap-2 text-sm text-muted">
                  <div className="w-7 h-7 rounded-full bg-text/10 flex items-center justify-center text-xs font-semibold text-text">
                    {(authedUser.name || authedUser.email || '?')[0].toUpperCase()}
                  </div>
                  <span className="text-text font-medium">
                    {authedUser.name?.split(' ')[0] ?? 'You'}
                  </span>
                </div>
                <Link
                  href="/dashboard"
                  className="btn-ink px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm shrink-0 whitespace-nowrap"
                >
                  <span className="hidden sm:inline">Go to&nbsp;</span>Dashboard
                </Link>
              </motion.div>
            ) : (
              <motion.div
                key="auth-guest"
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25, ease: 'easeOut' }}
                className="flex items-center gap-1 sm:gap-3"
              >
                <Link href="/login" className="hidden sm:block px-2 text-sm text-muted hover:text-text transition-colors shrink-0">
                  Sign in
                </Link>
                <Link
                  href="/login"
                  className="hidden md:inline-flex btn-ink px-4 py-2 text-sm shrink-0 whitespace-nowrap"
                >
                  Start free
                </Link>
                <button
                  onClick={() => setMenuOpen(o => !o)}
                  className="md:hidden flex flex-col justify-center items-center w-8 h-8 gap-1.5"
                  aria-label="Toggle menu"
                >
                  <span className={`block w-5 h-0.5 bg-text transition-all duration-200 ${menuOpen ? 'rotate-45 translate-y-2' : ''}`} />
                  <span className={`block w-5 h-0.5 bg-text transition-all duration-200 ${menuOpen ? 'opacity-0' : ''}`} />
                  <span className={`block w-5 h-0.5 bg-text transition-all duration-200 ${menuOpen ? '-rotate-45 -translate-y-2' : ''}`} />
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Mobile menu — mirrors the desktop dropdown groups as flat sections */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="relative md:hidden overflow-hidden bg-bg border-t border-border"
          >
            <div className="px-4 py-4 flex flex-col gap-4 max-h-[70vh] overflow-y-auto">
              {MENUS.map(menu => (
                <div key={menu.label}>
                  <div className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted">{menu.label}</div>
                  {menu.items.map(item => (
                    <Link
                      key={item.href + item.label}
                      href={item.href}
                      onClick={() => setMenuOpen(false)}
                      className="block px-3 py-2 rounded-lg text-sm text-muted hover:text-text hover:bg-text/[0.05] transition-colors"
                    >
                      {item.label}
                    </Link>
                  ))}
                </div>
              ))}
              <div>
                {LINKS.map(link => (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setMenuOpen(false)}
                    className="block px-3 py-2 rounded-lg text-sm text-muted hover:text-text hover:bg-text/[0.05] transition-colors"
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
              <Link
                href="/login"
                onClick={() => setMenuOpen(false)}
                className="btn-ink w-full py-2.5 text-sm"
              >
                Start free
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.nav>
  );
}
