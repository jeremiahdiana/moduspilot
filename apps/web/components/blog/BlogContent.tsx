import Link from 'next/link';
import type { Block } from '@/lib/blog/types';

/**
 * Inline formatting: **bold**, [text](url), `code`.
 *
 * Hand-rolled rather than a markdown dependency because the surface is three
 * constructs on a page that is otherwise fully typed. It returns React nodes, so
 * nothing here is ever passed to dangerouslySetInnerHTML — post copy is authored
 * in-repo today, but a renderer that interpolates raw HTML is a trap waiting for
 * the day any of it comes from somewhere else.
 */
export function inline(text: string, keyPrefix = ''): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  const pattern = /(\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\)|`[^`]+`)/g;
  const parts = text.split(pattern);

  parts.forEach((part, i) => {
    if (!part) return;
    const key = `${keyPrefix}-${i}`;
    if (part.startsWith('**') && part.endsWith('**')) {
      out.push(<strong key={key} className="font-semibold text-text">{part.slice(2, -2)}</strong>);
      return;
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      out.push(
        <code key={key} className="rounded bg-panel border border-border px-1.5 py-0.5 text-[0.85em] font-mono text-text">
          {part.slice(1, -1)}
        </code>,
      );
      return;
    }
    const link = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (link) {
      const [, label, href] = link;
      const external = /^https?:\/\//.test(href);
      out.push(
        <Link
          key={key}
          href={href}
          className="text-brand-light underline underline-offset-4 decoration-brand/40 hover:decoration-brand-light transition-colors"
          {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
        >
          {label}
        </Link>,
      );
      return;
    }
    out.push(<span key={key}>{part}</span>);
  });

  return out;
}

/** Plain text of a block's inline markup, for JSON-LD and meta where markup is invalid. */
export function stripInline(text: string): string {
  return text
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/`([^`]+)`/g, '$1');
}

export function BlogBlock({ block, index }: { block: Block; index: number }) {
  switch (block.type) {
    case 'h2':
      return (
        // scroll-mt clears the fixed navbar when the TOC jumps to an anchor.
        <h2 id={block.id} className="scroll-mt-28 font-serif text-[1.75rem] sm:text-[2rem] leading-[1.2] text-text mt-14 mb-5">
          {block.text}
        </h2>
      );
    case 'h3':
      return <h3 className="font-sans font-semibold text-lg text-text mt-9 mb-3">{block.text}</h3>;
    case 'p':
      return <p className="text-[1.0625rem] leading-[1.75] text-muted mb-5">{inline(block.text, `b${index}`)}</p>;
    case 'ul':
      return (
        <ul className="mb-6 space-y-3">
          {block.items.map((item, i) => (
            <li key={i} className="relative pl-6 text-[1.0625rem] leading-[1.7] text-muted">
              <span aria-hidden className="absolute left-0 top-[0.7em] h-1.5 w-1.5 rounded-full bg-brand/60" />
              {inline(item, `b${index}-${i}`)}
            </li>
          ))}
        </ul>
      );
    case 'ol':
      return (
        <ol className="mb-6 space-y-3 counter-reset">
          {block.items.map((item, i) => (
            <li key={i} className="relative pl-9 text-[1.0625rem] leading-[1.7] text-muted">
              <span aria-hidden className="absolute left-0 top-[0.15em] flex h-6 w-6 items-center justify-center rounded-full bg-brand/15 text-xs font-semibold text-brand-light">
                {i + 1}
              </span>
              {inline(item, `b${index}-${i}`)}
            </li>
          ))}
        </ol>
      );
    case 'table':
      return (
        // 🔑 The wrapper scrolls, not the page. A 3-column comparison table at
        // 375px would otherwise push the whole document sideways on mobile.
        <div className="mb-7 -mx-4 sm:mx-0 overflow-x-auto">
          <div className="min-w-full px-4 sm:px-0">
            <table className="w-full border-collapse text-[0.9375rem]">
              {block.caption && <caption className="text-left text-sm text-muted mb-2">{block.caption}</caption>}
              <thead>
                <tr className="border-b border-border">
                  {block.head.map((h, i) => (
                    <th key={i} className="py-3 pr-6 text-left font-semibold text-text whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {block.rows.map((row, r) => (
                  <tr key={r} className="border-b border-border/60 last:border-0">
                    {row.map((cell, c) => (
                      <td key={c} className="py-3 pr-6 align-top text-muted">{inline(cell, `t${index}-${r}-${c}`)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      );
    case 'callout':
      return (
        <div className={`mb-7 rounded-xl border p-5 ${
          block.tone === 'warn'
            ? 'border-amber-500/30 bg-amber-500/[0.06]'
            : 'border-border bg-panel'
        }`}>
          <p className="font-sans font-semibold text-sm text-text mb-1.5">{block.title}</p>
          <p className="text-[0.9375rem] leading-[1.7] text-muted">{inline(block.text, `c${index}`)}</p>
        </div>
      );
    case 'quote':
      return (
        <figure className="mb-7 border-l-2 border-brand/50 pl-5">
          <blockquote className="font-serif text-[1.125rem] leading-[1.6] text-text/90">
            {inline(block.text, `q${index}`)}
          </blockquote>
          {block.cite && <figcaption className="mt-2 text-sm text-muted">{block.cite}</figcaption>}
        </figure>
      );
  }
}
