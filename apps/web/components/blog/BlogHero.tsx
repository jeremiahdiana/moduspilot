import type { Post } from '@/lib/blog/types';

/**
 * Hero art, rendered rather than uploaded.
 *
 * Cluely's blog uses a stock photo with the wordmark burned over it. Same visual
 * job, done in CSS: a tinted gradient, a fine grid, and the label set large in the
 * display face. It stays on-brand automatically, costs no image weight, has no
 * licensing question attached, and cannot end up as a 900KB JPEG that tanks LCP on
 * the one page we are trying to rank.
 *
 * The grid is an inline SVG data URI rather than a file so the whole hero is a
 * single paint with no extra request.
 */
const GRID =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='32' height='32'%3E%3Cpath d='M32 0H0v32' fill='none' stroke='rgba(255,255,255,0.045)' stroke-width='1'/%3E%3C/svg%3E\")";

export function BlogHero({ post, compact = false }: { post: Post; compact?: boolean }) {
  return (
    <div
      className={`relative isolate overflow-hidden rounded-2xl border border-border bg-panel ${
        compact ? 'aspect-[16/9]' : 'aspect-[2/1]'
      }`}
    >
      {/* Inline gradient, not Tailwind classes: the colours live in lib/blog and
          tailwind.config.ts does not scan that directory, so class names written
          there are purged and the hero renders flat black with no error. */}
      <div
        className="absolute inset-0"
        style={{ background: `linear-gradient(135deg, ${post.hero.from} 0%, ${post.hero.via} 45%, transparent 75%)` }}
      />
      <div className="absolute inset-0 opacity-70" style={{ backgroundImage: GRID }} />
      {/* Bottom fade so the label never fights the texture behind it. */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent" />
      <div className="absolute inset-0 flex items-center justify-center p-6">
        <span
          className={`font-display font-medium tracking-tight text-white/90 text-center leading-[1.05] ${
            compact ? 'text-[clamp(1.25rem,5vw,2rem)]' : 'text-[clamp(2rem,7vw,4.5rem)]'
          }`}
        >
          {post.hero.label}
        </span>
      </div>
    </div>
  );
}
