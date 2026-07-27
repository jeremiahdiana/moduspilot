'use client';

import { useState } from 'react';
import Navbar from '@/components/marketing/Navbar';
import MarketingDecor from '@/components/marketing/MarketingDecor';

/**
 * The light-by-default marketing shell, as a wrapper so the post page itself can
 * stay a SERVER component.
 *
 * The theme toggle needs useState, but the post page has to keep
 * generateStaticParams, generateMetadata and the JSON-LD script — making the whole
 * page a client component would give up static prerendering on the pages whose
 * entire purpose is being crawled. So the interactive chrome lives here and the
 * content is passed through as children, which stay server-rendered.
 */
export function BlogPostShell({ children }: { children: React.ReactNode }) {
  const [dark, setDark] = useState(false);

  return (
    <div className={`marketing ${dark ? 'marketing-dark-tokens' : 'marketing-light-tokens'}`}>
      <Navbar marketingTheme={dark ? 'dark' : 'light'} onToggleTheme={() => setDark(d => !d)} />
      {/* 🪤 `overflow-x-clip`, NOT `overflow-x-hidden`. The other marketing
          pages use `hidden`, and copying it here silently re-broke the sticky
          CTA rail on the post page: `hidden` makes this a scroll container and
          a scroll container disables `position: sticky` for every descendant.
          Same trap as the html/body rule in globals.css, one layer down. */}
      <main className="bg-bg text-text min-h-screen overflow-x-clip relative">
        <MarketingDecor dark={dark} />
        <div className="relative" style={{ zIndex: 2 }}>{children}</div>
      </main>
    </div>
  );
}
