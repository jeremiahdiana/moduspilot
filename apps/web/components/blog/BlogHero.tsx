import type { Post } from '@/lib/blog/types';

/**
 * Hero art, rendered rather than uploaded.
 *
 * Same visual job as a stock photo with the wordmark burned over it, done in CSS:
 * a tinted gradient, a fine grid, and the label set large in the display face. It
 * stays on-brand automatically, costs no image weight, has no licensing question,
 * and cannot end up as a 900KB JPEG that tanks LCP on the page we want to rank.
 *
 * ## variant
 * `standalone` — the label is the subject. Used on the post page and list cards.
 * `watermark`  — the art sits BEHIND real text (the featured card on /blog). The
 *   label drops to a faint watermark and a dark scrim is laid over the whole
 *   thing, because white type over a pale gradient is unreadable and the first
 *   version shipped exactly that: the headline collided with a full-brightness
 *   wordmark on a gradient that faded to near-white at the bottom right.
 *
 * The grid is an inline SVG data URI rather than a file so the whole hero is a
 * single paint with no extra request.
 */
const GRID =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='32' height='32'%3E%3Cpath d='M32 0H0v32' fill='none' stroke='rgba(255,255,255,0.045)' stroke-width='1'/%3E%3C/svg%3E\")";

export function BlogHero({
  post,
  compact = false,
  variant = 'standalone',
}: {
  post: Post;
  compact?: boolean;
  variant?: 'standalone' | 'watermark';
}) {
  const watermark = variant === 'watermark';

  return (
    <div
      className={`relative isolate overflow-hidden rounded-2xl ${
        watermark ? 'bg-neutral-900' : 'border border-border bg-panel'
      } ${compact ? 'aspect-[16/9]' : 'aspect-[2/1]'}`}
    >
      {/* Inline gradient, not Tailwind classes: the colours live in lib/blog and
          tailwind.config.ts does not scan that directory, so class names written
          there are purged and the hero renders flat black with no error. */}
      <div
        className="absolute inset-0"
        style={{ background: `linear-gradient(135deg, ${post.hero.from} 0%, ${post.hero.via} 45%, transparent 75%)` }}
      />
      <div className="absolute inset-0 opacity-70" style={{ backgroundImage: GRID }} />

      <div className="absolute inset-0 flex items-center justify-center p-6">
        <span
          className={`font-display font-medium tracking-tight text-center leading-[1.05] ${
            watermark ? 'text-white/[0.13] blur-[1px]' : 'text-white/90'
          } ${compact ? 'text-[clamp(1.25rem,5vw,2rem)]' : 'text-[clamp(2rem,7vw,4.5rem)]'}`}
        >
          {post.hero.label}
        </span>
      </div>

      {/* Scrim. Heavier and directional under real text so the headline and the
          tag row both clear WCAG contrast at every card size. */}
      <div
        className={`absolute inset-0 ${
          watermark
            ? 'bg-gradient-to-tr from-black/85 via-black/55 to-black/35'
            : 'bg-gradient-to-t from-black/45 via-transparent to-transparent'
        }`}
      />
    </div>
  );
}
