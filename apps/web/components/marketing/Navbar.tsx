'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { AnimatedThemeToggler } from '@/components/ui/animated-theme-toggler';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';

interface Props {
  solid?: boolean;
}

export default function Navbar({ solid = false }: Props) {
  const [scrolled, setScrolled] = useState(false);
  const [authedUser, setAuthedUser] = useState<{ name: string | null; email: string | null } | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setAuthedUser(u ? { name: u.displayName, email: u.email } : null);
    });
    return unsub;
  }, []);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, []);

  const showBg = solid || scrolled;

  const navLinks = [
    { href: '/', label: 'Home' },
    { href: '/how-it-works', label: 'How It Works' },
    { href: '/pricing', label: 'Pricing' },
  ];

  return (
    <motion.nav
      initial={{ opacity: 0, y: -16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className={`fixed top-0 left-0 right-0 z-50 overflow-hidden transition-all duration-300 ${
        showBg ? 'bg-bg/90 backdrop-blur-xl border-b border-border/60' : 'bg-transparent'
      }`}
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-2">
        <Link href="/" className="flex items-center gap-1.5 shrink-0">
          <Image src="/logo.png" alt="MODUS" width={52} height={40} className="object-contain block dark:hidden" />
          <Image src="/logo-dark.png" alt="MODUS" width={52} height={40} className="object-contain hidden dark:block" />
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
          <AnimatedThemeToggler />
          {authedUser ? (
            <>
              <div className="flex items-center gap-2 text-sm text-muted">
                <div className="w-7 h-7 rounded-full bg-brand/20 border border-brand/30 flex items-center justify-center text-xs font-bold text-brand">
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
            </>
          ) : (
            <>
              <Link href="/login" className="hidden sm:block text-sm text-muted hover:text-text transition-colors shrink-0">
                Sign In
              </Link>
              <Link
                href="/login"
                className="btn-primary px-3 sm:px-4 py-1.5 sm:py-2 bg-brand text-white text-xs sm:text-sm font-semibold rounded-lg hover:shadow-[0_0_24px_rgba(124,58,237,0.5)] hover:scale-[1.03] active:scale-100 transition-all shrink-0 whitespace-nowrap"
              >
                Get Started
              </Link>
            </>
          )}
        </div>
      </div>
    </motion.nav>
  );
}
