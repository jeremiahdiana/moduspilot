'use client';

/**
 * MarketingDecor — the backdrop behind the hero. Deliberately quiet now
 * (Anthropic / Perplexity reference): the canvas is the warm ivory token itself,
 * with only a barely-there neutral wash at the very top for a little depth. No
 * violet blooms, no mountain range. Color is reserved for interactive elements.
 */
export default function MarketingDecor({ dark }: { dark: boolean }) {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[80vh] overflow-hidden" style={{ zIndex: 0 }}>
      <div
        className="absolute inset-0"
        style={{
          background: dark
            ? 'radial-gradient(ellipse 90% 50% at 50% -10%, rgba(255,255,255,0.04), transparent 60%)'
            : 'radial-gradient(ellipse 90% 50% at 50% -10%, rgba(255,255,255,0.6), transparent 60%)',
        }}
      />
    </div>
  );
}
