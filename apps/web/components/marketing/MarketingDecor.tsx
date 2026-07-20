'use client';

/**
 * MarketingDecor — the decorative backdrop behind the hero. In LIGHT mode it
 * offsets the flat white with soft violet blooms and a layered "mountain range"
 * silhouette (Cluely-style, but our own shapes). In DARK mode it becomes a quiet
 * violet aurora. Absolutely positioned at the top of the page so it scrolls away.
 */
export default function MarketingDecor({ dark }: { dark: boolean }) {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[125vh] overflow-hidden" style={{ zIndex: 0 }}>
      {/* Soft blooms */}
      <div
        className="absolute inset-0"
        style={{
          background: dark
            ? 'radial-gradient(ellipse 90% 55% at 50% 2%, rgba(124,58,237,0.20), transparent 60%), radial-gradient(ellipse 60% 40% at 88% 8%, rgba(96,118,240,0.12), transparent 60%)'
            : 'radial-gradient(ellipse 95% 55% at 50% -6%, rgba(124,58,237,0.14), transparent 60%), radial-gradient(ellipse 70% 45% at 90% 2%, rgba(96,118,240,0.12), transparent 60%), radial-gradient(ellipse 75% 45% at 8% 20%, rgba(139,92,246,0.08), transparent 55%)',
        }}
      />

      {/* Layered mountain range near the horizon of the hero */}
      <svg
        className="absolute bottom-0 left-0 w-full"
        style={{ height: '55%' }}
        viewBox="0 0 1440 500"
        preserveAspectRatio="none"
        fill="none"
      >
        <defs>
          <linearGradient id="mtn-back" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={dark ? '#6d3bd4' : '#a78bfa'} stopOpacity={dark ? 0.28 : 0.22} />
            <stop offset="100%" stopColor={dark ? '#6d3bd4' : '#a78bfa'} stopOpacity="0" />
          </linearGradient>
          <linearGradient id="mtn-mid" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={dark ? '#7c3aed' : '#8b5cf6'} stopOpacity={dark ? 0.30 : 0.18} />
            <stop offset="100%" stopColor={dark ? '#7c3aed' : '#8b5cf6'} stopOpacity="0" />
          </linearGradient>
          <linearGradient id="mtn-front" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={dark ? '#4c1d95' : '#7c3aed'} stopOpacity={dark ? 0.34 : 0.14} />
            <stop offset="100%" stopColor={dark ? '#4c1d95' : '#7c3aed'} stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* back range */}
        <path d="M0 250 L180 150 L360 220 L560 120 L760 210 L980 130 L1200 220 L1440 160 L1440 500 L0 500 Z" fill="url(#mtn-back)" />
        {/* mid range */}
        <path d="M0 320 L220 240 L440 310 L640 220 L860 300 L1080 230 L1300 300 L1440 260 L1440 500 L0 500 Z" fill="url(#mtn-mid)" />
        {/* front range */}
        <path d="M0 400 L260 330 L520 390 L780 320 L1040 385 L1280 330 L1440 370 L1440 500 L0 500 Z" fill="url(#mtn-front)" />
      </svg>

      {/* Fade the whole decor into the page background at its base */}
      <div
        className="absolute inset-x-0 bottom-0 h-40"
        style={{ background: `linear-gradient(to bottom, transparent, rgb(var(--color-bg)))` }}
      />
    </div>
  );
}
