/**
 * The blog's content model.
 *
 * Posts are typed TypeScript, not markdown files or a CMS. Three reasons, in
 * order of how much they matter:
 *
 * 1. The FAQ block and the table of contents are both SEO surfaces, not
 *    decoration — the FAQ feeds FAQPage JSON-LD which is what wins Google's
 *    People Also Ask box. A markdown body would mean parsing headings back out
 *    of rendered HTML to build either one, and silently shipping a post with no
 *    schema the day a heading is formatted slightly differently.
 * 2. A missing `description`, `faq` or `updated` is then a type error at build
 *    time rather than a page that quietly ranks for nothing.
 * 3. No markdown runtime in the bundle for pages that are entirely static.
 *
 * Inline formatting is deliberately tiny: **bold**, [text](url), and `code`.
 * Anything richer belongs in a `table` or `callout` block instead of being
 * smuggled into a paragraph.
 */

export type Block =
  | { type: 'p'; text: string }
  | { type: 'h2'; id: string; text: string }
  | { type: 'h3'; text: string }
  | { type: 'ul'; items: string[] }
  | { type: 'ol'; items: string[] }
  | { type: 'table'; caption?: string; head: string[]; rows: string[][] }
  /** The disclosure box. Used once per comparison post, near the top, on purpose. */
  | { type: 'callout'; tone: 'note' | 'warn'; title: string; text: string }
  | { type: 'quote'; text: string; cite?: string };

export interface Faq {
  q: string;
  a: string;
}

export interface Post {
  slug: string;
  title: string;
  /** Meta description. Google truncates around 155 chars — keep it under that. */
  description: string;
  /** Shown on the card and under the title. One sentence. */
  excerpt: string;
  tags: string[];
  published: string;   // YYYY-MM-DD
  updated: string;     // YYYY-MM-DD — comparison posts go stale fast, so this is shown
  readMinutes: number;
  author: string;
  /**
   * Hero art. `wordmark` renders the branded gradient card, no image file needed.
   *
   * 🪤 `from`/`via` are REAL CSS COLOURS, not Tailwind class names, and that is
   * deliberate. tailwind.config.ts only scans ./app and ./components, so a class
   * written in this file is purged from the stylesheet and the hero renders flat
   * black. It fails silently — no error, no warning, just a missing gradient.
   * Inline colours cannot be purged.
   */
  hero: { kind: 'wordmark'; label: string; from: string; via: string };
  body: Block[];
  faq: Faq[];
  /** Slugs of related posts, rendered as cards at the bottom. */
  related: string[];
}

/** Headings become the table of contents, so it can never drift from the body. */
export function tableOfContents(post: Post): { id: string; text: string }[] {
  return post.body.filter((b): b is Extract<Block, { type: 'h2' }> => b.type === 'h2')
    .map(b => ({ id: b.id, text: b.text }));
}
