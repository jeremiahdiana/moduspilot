'use client';

import { useRef } from 'react';
import Link from 'next/link';
import { motion, useScroll, useTransform } from 'framer-motion';

/**
 * LatestReleaseCard — the Anthropic "Claude Fable 5.1" hero card: a large rounded,
 * full-bleed image with an elegant SERIF headline, subtitle and CTA overlaid. The
 * image scales down slightly as it enters the viewport (the one scroll animation we
 * keep), giving the subtle zoom Anthropic uses.
 */
export default function LatestReleaseCard({
  eyebrow,
  title,
  subtitle,
  href = '/login',
  cta = 'Read more',
  image,
  align = 'center',
  height = 'tall',
}: {
  eyebrow?: string;
  title: React.ReactNode;
  subtitle?: string;
  href?: string;
  cta?: string;
  image: string;
  align?: 'center' | 'left';
  height?: 'tall' | 'medium';
}) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] });
  // Gentle scale as the card travels through the viewport.
  const scale = useTransform(scrollYProgress, [0, 0.5, 1], [1.12, 1, 1.12]);

  const alignCls = align === 'left' ? 'items-start text-left' : 'items-center text-center';
  const heightCls = height === 'tall' ? 'min-h-[520px] sm:min-h-[620px]' : 'min-h-[360px] sm:min-h-[420px]';

  return (
    <div ref={ref} className={`relative overflow-hidden rounded-3xl ${heightCls}`}>
      {/* Full-bleed image, scroll-scaled */}
      <motion.div style={{ scale }} className="absolute inset-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={image} alt="" className="w-full h-full object-cover" />
      </motion.div>
      {/* Readability wash */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/25 via-black/10 to-black/45" />

      <div className={`relative h-full flex flex-col justify-center ${alignCls} px-8 sm:px-14 py-16`}>
        {eyebrow && (
          <p className="text-xs uppercase tracking-[0.22em] text-white/80 mb-5">{eyebrow}</p>
        )}
        <h2 className="text-white [font-family:var(--font-serif)] font-medium tracking-tight leading-[1.05] text-4xl sm:text-6xl max-w-3xl">
          {title}
        </h2>
        {subtitle && (
          <p className="mt-5 text-white/85 text-base sm:text-lg leading-relaxed max-w-md">{subtitle}</p>
        )}
        <Link
          href={href}
          className="mt-8 inline-flex items-center gap-2 rounded-full bg-white text-black px-6 py-3 text-sm font-semibold hover:opacity-90 transition-opacity"
        >
          {cta}
          <span aria-hidden>&rarr;</span>
        </Link>
      </div>
    </div>
  );
}
