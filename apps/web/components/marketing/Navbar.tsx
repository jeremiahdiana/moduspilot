'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface Props {
  /** Always show solid background — use on inner pages (how-it-works, pricing) */
  solid?: boolean;
}

export default function Navbar({ solid = false }: Props) {
  const [scrolled, setScrolled] = useState(false);
  const pathname = usePathname();

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
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        showBg ? 'bg-bg/90 backdrop-blur-xl border-b border-border/60' : 'bg-transparent'
      }`}
    >
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-baseline gap-1.5">
          <span className="text-xl font-black tracking-widest text-brand">Modus</span>
          <span className="text-xs font-medium text-muted tracking-widest">pilot</span>
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
          <Link href="/login" className="text-sm text-muted hover:text-text transition-colors">
            Sign In
          </Link>
          <Link
            href="/login"
            className="px-4 py-2 bg-brand text-white text-sm font-semibold rounded-lg hover:bg-brand/90 transition-colors"
          >
            Get Started
          </Link>
        </div>
      </div>
    </motion.nav>
  );
}
