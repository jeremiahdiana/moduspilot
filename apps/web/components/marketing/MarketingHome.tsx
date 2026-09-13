'use client';

import { useEffect, useState } from 'react';
import Navbar from './Navbar';
import HomepageShell from './HomepageShell';

/**
 * MarketingHome — client shell that owns the homepage light/dark state so the
 * navbar toggle and the sections share one source of truth. The choice is saved
 * to the shared `modus-theme` key (also read pre-paint in app/layout.tsx and by
 * the app/login toggler), so login and the software inherit whatever mode the
 * visitor last used here. Default is LIGHT. The stored value is read after mount
 * to avoid a hydration mismatch — the server always renders the light markup.
 * The wrapper carries `.marketing` + the matching token class so the whole
 * subtree re-declares its color tokens regardless of the app's global `.dark`.
 */
export default function MarketingHome() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    try {
      setDark(localStorage.getItem('modus-theme') === 'dark');
    } catch { /* storage blocked — stay light */ }
  }, []);

  const toggleTheme = () => {
    setDark(prev => {
      const next = !prev;
      try {
        localStorage.setItem('modus-theme', next ? 'dark' : 'light');
      } catch { /* storage blocked — still flips in-session */ }
      // Mirror onto the global class so login and the app inherit the choice.
      document.documentElement.classList.toggle('dark', next);
      return next;
    });
  };

  return (
    <div className={`marketing ${dark ? 'marketing-dark-tokens' : 'marketing-light-tokens'}`}>
      <Navbar marketingTheme={dark ? 'dark' : 'light'} onToggleTheme={toggleTheme} />
      <HomepageShell dark={dark} />
    </div>
  );
}
