'use client';

import { useState } from 'react';
import Navbar from './Navbar';
import Footer from './Footer';

/**
 * MarketingShell — the standard chrome for a marketing content page: the marketing
 * color tokens (light by default, toggled in-session), the Navbar with its
 * dropdowns and the Footer. New pages (Compare, Integrations, Changelog, About,
 * Use cases) render their body inside this so the look is identical everywhere and
 * defined in one place.
 */
export default function MarketingShell({
  children,
  footer = true,
}: {
  children: React.ReactNode;
  footer?: boolean;
}) {
  const [dark, setDark] = useState(false);

  return (
    <div className={`marketing ${dark ? 'marketing-dark-tokens' : 'marketing-light-tokens'}`}>
      <Navbar marketingTheme={dark ? 'dark' : 'light'} onToggleTheme={() => setDark(d => !d)} />
      <main className="bg-bg text-text min-h-screen overflow-x-hidden">
        {children}
        {footer && <Footer />}
      </main>
    </div>
  );
}
