'use client';

import { useEffect, useState } from 'react';
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

export default function Navbar({ solid = false, marketingTheme, onToggleTheme }: Props) {
  const isMarketing = !!marketingTheme;
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [authedUser, setAuthedUser] = useState<{ name: string | null; email: string | null } | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const pathname = usePathname();

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

  useEffect(() => { setMenuOpen(false); }, [pathname]);

  const showBg = solid || scrolled || menuOpen;

  // Blog lives in the footer under Company, not up here — see components/marketing/Footer.tsx.
  const navLinks = [
    { href: '/', label: 'Home' },
    { href: '/pricing', label: 'Pricing' },
  ];

  return (
    <motion.nav
      initial={{ opacity: 0, y: -16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className={`fixed top-0 left-0 right-0 z-50 overflow-hidden transition-all duration-500 ${
        showBg ? `backdrop-blur-2xl ${marketingTheme === 'light' ? 'shadow-[0_4px_32px_rgba(30,20,60,0.08)]' : 'shadow-[0_4px_32px_rgba(0,0,0,0.14)]'}` : 'bg-transparent'
      }`}
    >
      {/* Glass gradient background */}
      <AnimatePresence>
        {showBg && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35 }}
            className="absolute inset-0 pointer-events-none overflow-hidden"
          >
            {/* Base glass fill */}
            <div className="absolute inset-0 bg-bg/80" />
            {/* Subtle top-to-bottom depth */}
            <div className="absolute inset-0 bg-gradient-to-b from-black/10 to-transparent dark:from-black/20" />
            {/* Top highlight line */}
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/12 to-transparent" />
            {/* Bottom edge definition */}
            <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
          </motion.div>
        )}
      </AnimatePresence>
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
            <span className="text-sm font-black tracking-widest text-brand">MODUS</span>
            <span className="text-[8px] font-semibold text-muted tracking-widest uppercase">pilot</span>
          </div>
        </Link>

        <div className="hidden md:flex items-center gap-8">
          {navLinks.map(link => (
            <Link
              key={link.href}
              href={link.href}
              className={`text-sm transition-colors ${
                pathname === link.href
                  ? 'text-text font-medium'
                  : 'text-muted hover:text-text'
              }`}
            >
              {link.label}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-3">
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
                className="flex items-center gap-2"
              >
                <div className="flex items-center gap-2 text-sm text-muted">
                  <div className="w-7 h-7 rounded-full bg-brand/20 flex items-center justify-center text-xs font-bold text-brand">
                    {(authedUser.name || authedUser.email || '?')[0].toUpperCase()}
                  </div>
                  <span className="hidden sm:block text-text font-medium">
                    {authedUser.name?.split(' ')[0] ?? 'You'}
                  </span>
                </div>
                <Link
                  href="/dashboard"
                  className="btn-primary group flex items-center gap-1.5 px-3 sm:px-4 py-1.5 sm:py-2 bg-brand text-white text-xs sm:text-sm font-semibold rounded-lg hover:shadow-[0_0_24px_rgba(124,58,237,0.5)] hover:scale-[1.03] active:scale-100 transition-all shrink-0 whitespace-nowrap"
                >
                  <span className="hidden sm:inline">Go to </span>Dashboard
                  <span className="group-hover:translate-x-0.5 transition-transform duration-200 hidden sm:inline">→</span>
                </Link>
              </motion.div>
            ) : (
              <motion.div
                key="auth-guest"
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25, ease: 'easeOut' }}
                className="flex items-center gap-2"
              >
                <Link href="/login" className="hidden sm:block text-sm text-muted hover:text-text transition-colors shrink-0">
                  Sign In
                </Link>
                <Link
                  href="/login"
                  className="hidden md:block btn-primary px-3 sm:px-4 py-1.5 sm:py-2 bg-brand text-white text-xs sm:text-sm font-semibold rounded-lg hover:shadow-[0_0_24px_rgba(124,58,237,0.5)] hover:scale-[1.03] active:scale-100 transition-all shrink-0 whitespace-nowrap"
                >
                  {/* "trial" implied a card. The first thing a stranger gets is
                      FREE_MESSAGE_LIMIT messages without one, and this button is
                      on every marketing page — it should promise what they
                      actually meet. The trial is the second rung, not the first. */}
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

      {/* Mobile menu */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="relative md:hidden overflow-hidden bg-bg/80"
          >
            <div className="px-4 py-4 flex flex-col gap-1">
              {navLinks.map(link => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMenuOpen(false)}
                  className={`px-3 py-2.5 rounded-lg text-sm transition-colors ${
                    pathname === link.href
                      ? 'bg-brand/10 text-text font-medium'
                      : 'text-muted hover:text-text hover:bg-panel'
                  }`}
                >
                  {link.label}
                </Link>
              ))}
              <div className="mt-2 pt-2">
                <Link
                  href="/login"
                  onClick={() => setMenuOpen(false)}
                  className="btn-primary flex items-center justify-center w-full py-2.5 text-white text-sm font-semibold rounded-lg"
                >
                  Get started free
                </Link>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.nav>
  );
}
