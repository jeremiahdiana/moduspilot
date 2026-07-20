'use client';

import { useState } from 'react';
import Navbar from './Navbar';
import HomepageShell from './HomepageShell';

/**
 * MarketingHome — client shell that owns the homepage light/dark state so the
 * navbar toggle and the sections share one source of truth. Defaults to LIGHT
 * (the Cluely-style look), toggles to dark in-session. The wrapper carries
 * `.marketing` + the matching token class so the whole subtree re-declares its
 * color tokens regardless of the app's global forced `.dark`.
 */
export default function MarketingHome() {
  const [dark, setDark] = useState(false);

  return (
    <div className={`marketing ${dark ? 'marketing-dark-tokens' : 'marketing-light-tokens'}`}>
      <Navbar marketingTheme={dark ? 'dark' : 'light'} onToggleTheme={() => setDark(d => !d)} />
      <HomepageShell dark={dark} />
    </div>
  );
}
