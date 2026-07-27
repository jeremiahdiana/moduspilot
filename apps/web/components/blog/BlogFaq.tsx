import type { Faq } from '@/lib/blog/types';
import { inline } from './BlogContent';

/**
 * The FAQ accordion.
 *
 * 🔑 Built on native <details>/<summary>, NOT useState. This block is an SEO
 * surface first and a UI second: it backs the FAQPage JSON-LD that wins Google's
 * People Also Ask box, and a crawler has to see the answers in the HTML. A
 * client-component accordion that renders answers only after hydration ships a
 * page whose answers are invisible to the exact consumer the block exists for.
 *
 * It also means the whole post page stays a server component with zero JS.
 */
export function BlogFaq({ faq }: { faq: Faq[] }) {
  if (!faq.length) return null;
  return (
    <section aria-labelledby="faq-heading" className="mt-16">
      <h2 id="faq-heading" className="scroll-mt-28 font-serif text-[1.75rem] sm:text-[2rem] leading-[1.2] text-text mb-6">
        Frequently asked questions
      </h2>
      <div className="border-t border-border">
        {faq.map((item, i) => (
          <details key={i} className="group border-b border-border">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-5 text-left [&::-webkit-details-marker]:hidden">
              <span className="font-sans font-medium text-[1.0625rem] text-text">{item.q}</span>
              <svg
                aria-hidden
                viewBox="0 0 20 20"
                className="h-5 w-5 shrink-0 text-muted transition-transform duration-200 group-open:rotate-180"
              >
                <path d="M5 7.5 10 12.5 15 7.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </summary>
            <div className="pb-5 pr-9 text-[1.0625rem] leading-[1.75] text-muted">{inline(item.a, `faq${i}`)}</div>
          </details>
        ))}
      </div>
    </section>
  );
}
