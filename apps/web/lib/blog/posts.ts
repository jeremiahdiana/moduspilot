/**
 * The posts.
 *
 * 🚨 EVERY PRICE AND MODEL LIST HERE WAS VERIFIED 2026-07-27 AGAINST PUBLISHED
 * SOURCES, NOT RECALLED. Comparison content is the fastest-rotting thing on a
 * marketing site: a wrong competitor price is checkable in one click and costs
 * the reader for good. `updated` is rendered on the page so a stale post is
 * visibly stale. Re-verify before changing any figure below.
 *
 * On being fair to competitors: the disclosure callout and the honest "where they
 * win" sections are not politeness. "Our product wins every category" is the most
 * common spam signal in commercial comparison content and Google's helpful-content
 * system is tuned for it — the boastful version does not outrank a competitor's
 * own brand pages, it gets buried. Conceding search to Perplexity costs nothing,
 * because a reader googling "Perplexity alternatives" already has Perplexity for
 * search. Claiming otherwise gets caught in forty seconds.
 */
import type { Post } from './types';

const PERPLEXITY_ALTERNATIVES: Post = {
  slug: 'best-perplexity-alternatives-2026',
  title: 'The Best Perplexity Alternatives in 2026',
  description:
    'Perplexity Pro is $20/mo and Max is $200/mo. We compare it against ChatGPT, Claude and MODUS on models, price and what each is actually best at.',
  excerpt:
    'Four honest options for people leaving Perplexity, with real prices and a clear note on which one each is actually for.',
  tags: ['Guides', 'Comparisons'],
  published: '2026-07-28',
  updated: '2026-07-28',
  readMinutes: 8,
  author: 'Jeremiah Diana',
  hero: { kind: 'wordmark', label: 'Alternatives', from: 'rgba(124,58,237,0.55)', via: 'rgba(217,70,239,0.18)' },
  related: ['modus-vs-perplexity'],
  body: [
    {
      type: 'p',
      text: 'The hidden model routing, the reasoning effort you cannot see, or a subscription that quietly stopped being the product you bought. Whatever sent you looking, here is the honest field: **Perplexity**, **ChatGPT**, **Claude** and **MODUS**.',
    },
    {
      type: 'callout',
      tone: 'note',
      title: 'Full disclosure',
      text: 'We build MODUS, which is fourth on this list. Judge our ranking accordingly. Every price and model list here comes from each product\'s own published pricing as of July 2026, and we have said plainly which tool each reader should pick, including when that is not us.',
    },
    { type: 'h2', id: 'why-people-leave', text: 'Why people leave Perplexity' },
    {
      type: 'p',
      text: 'Perplexity is genuinely good at the thing it was built for: search with citations. Most people who go looking for an alternative are not unhappy with search. They are unhappy with one of three things.',
    },
    {
      type: 'ul',
      items: [
        '**You cannot see which model answered, or at what effort.** Pro routes between Sonar, GPT-5.2, Claude Sonnet 4.6 and Gemini 3.1 Pro, and the reasoning effort applied is not surfaced. When an answer is wrong you cannot tell whether you got the frontier model or a cheap fallback.',
        '**The frontier models sit behind Max.** Claude Opus, o3-Pro and Grok 4 are Max features, and Max is $200/month.',
        '**The product changed under an annual subscription.** This is the most common complaint on r/perplexity_ai, and it is the one no comparison table captures.',
      ],
    },
    { type: 'h2', id: 'perplexity', text: '1. Perplexity — the search engine, still the best at search' },
    {
      type: 'p',
      text: 'Worth being clear: if what you want is a researched answer with sources you can click, Perplexity is still the strongest option here and none of the alternatives below beat it at that. Sonar is built for it and the others are not.',
    },
    {
      type: 'table',
      head: ['Plan', 'Price', 'Models'],
      rows: [
        ['Pro', '$20/mo · $200/yr', 'Sonar, GPT-5.2, Claude Sonnet 4.6, Gemini 3.1 Pro'],
        ['Max', '$200/mo · $2,000/yr', 'Adds Claude Opus 4.5, Sonnet 4.6 Thinking, o3-Pro, Grok 4, and Model Council'],
      ],
    },
    {
      type: 'p',
      text: '**Model Council** is Perplexity\'s multi-model feature: it runs GPT-5.4, Claude Opus and Gemini 3.1 Pro in parallel and synthesises where they agree and disagree. It is genuinely good, and it is Max-only, which means the entry price for it is $200 a month.',
    },
    { type: 'h3', text: 'Tradeoffs' },
    {
      type: 'p',
      text: 'Model transparency is the weak point. On Pro you cannot pin a model per message with confidence, and reasoning effort is not exposed at all.',
    },
    { type: 'h2', id: 'chatgpt', text: '2. ChatGPT — the default, and the deepest single ecosystem' },
    {
      type: 'p',
      text: 'Plus at $20/month is the most widely used AI subscription, and for good reason: it is the most polished product in this list with the largest ecosystem around it. Pro at $200/month unlocks gpt-5.6, gpt-5.6-sol, gpt-5.4, o3-pro, o4-mini and Codex with 20x the limits.',
    },
    { type: 'h3', text: 'Tradeoffs' },
    {
      type: 'p',
      text: 'One lab. Every answer comes from an OpenAI model, so when GPT is wrong about something in a way Claude would not have been, nothing in the product tells you. Usage limits are also not metered visibly, which is a recurring complaint.',
    },
    { type: 'h2', id: 'claude', text: '3. Claude — the best writing, and the same single-lab limit' },
    {
      type: 'p',
      text: 'Pro is $20/month, or $17/month on annual billing at $200 upfront, and unlocks the current Claude models plus Claude Code at no extra cost. Max runs $100 to $200/month for higher limits.',
    },
    {
      type: 'p',
      text: 'For long-form writing, code review and anything where being told "I am not sure" matters more than confidence, most people who use both prefer Claude. That is a taste judgement and it is worth trusting your own.',
    },
    { type: 'h3', text: 'Tradeoffs' },
    {
      type: 'p',
      text: 'Same structural limit as ChatGPT: one lab, one opinion, no second reading. Search is also weaker than Perplexity.',
    },
    { type: 'h2', id: 'modus', text: '4. MODUS — every lab in one place, and the models side by side' },
    {
      type: 'p',
      text: 'This is ours, so read it with that in mind. MODUS exists for one specific person: someone paying for two or three of the subscriptions above at the same time because no single one is enough.',
    },
    {
      type: 'table',
      head: ['Plan', 'Price', 'Models'],
      rows: [
        ['MODUS', '$24/mo · $240/yr', 'Llama 3.3, DeepSeek V3.1, GPT-5.6 Terra, Claude Sonnet 5, Gemini 3.5 Flash'],
        ['PILOT', '$59/mo · $588/yr', 'Adds Claude Opus 4.8, Claude Fable 5, GPT-5.6 Sol, Gemini 3.1 Pro, Llama 4 Maverick'],
      ],
    },
    {
      type: 'p',
      text: 'Two things are genuinely different here. **The model generation is newer**: GPT-5.6 against Perplexity\'s GPT-5.2, Claude Sonnet 5 and Opus 4.8 against Sonnet 4.6 and Opus 4.5. And **compare mode runs the same prompt across up to ten models at once**, showing the answers side by side with a verdict on which served you best.',
    },
    {
      type: 'p',
      text: 'That second feature is the direct equivalent of Perplexity\'s Model Council. The difference is the price and the count: **Model Council is 3 models and requires Max at $200/month. Compare mode is up to 10 models on PILOT at $59.**',
    },
    {
      type: 'p',
      text: 'MODUS also names the exact model on every single answer and refuses to silently substitute a cheaper one. That sounds like a small thing. It is the complaint that comes up most often about every wrapper in this category.',
    },
    { type: 'h3', text: 'Tradeoffs, and they are real' },
    {
      type: 'ul',
      items: [
        '**Search is not our product.** Perplexity is better at researched, cited answers and it is not close. If that is your main use, stay where you are.',
        '**No Grok 4 and no o3-Pro.** Perplexity Max has both. We do not.',
        '**MODUS is newer and smaller.** Fewer users, a shorter track record, and a mobile app that is still behind the web experience.',
        '**There is no free tier.** A card is required to start, which is a higher bar than every other product on this list.',
      ],
    },
    { type: 'h2', id: 'how-to-choose', text: 'How to choose' },
    {
      type: 'p',
      text: 'Decide on two questions, in this order.',
    },
    {
      type: 'ol',
      items: [
        '**Is search with citations your main job?** If yes, keep Perplexity. Nothing here beats it and price is not the deciding factor.',
        '**Are you currently paying for more than one AI subscription?** If no, pick the single lab whose voice you prefer, which is ChatGPT or Claude at $20, and stop there. If yes, that is the case MODUS was built for, and PILOT at $59 is cheaper than any two of the $200 tiers.',
      ],
    },
    {
      type: 'p',
      text: 'The honest summary: three of the four options on this page are better than the fourth at something specific. Pick the one whose specific thing is the thing you actually do all day.',
    },
  ],
  faq: [
    {
      q: 'Why do people look for Perplexity alternatives?',
      a: 'The most common reasons are hidden model routing, where you cannot tell which model answered or at what reasoning effort, frontier models like Claude Opus and Grok 4 being locked behind the $200/month Max plan, and features changing during an annual subscription that was already paid for.',
    },
    {
      q: 'Is there a Perplexity alternative that runs several AI models at once?',
      a: 'Yes. Perplexity\'s own Model Council runs three models in parallel and synthesises the result, but it requires Max at $200/month. MODUS compare mode runs the same prompt across up to ten models with a verdict, on PILOT at $59/month.',
    },
    {
      q: 'What is the cheapest way to get Claude Opus and GPT-5.6 in one subscription?',
      a: 'Buying Claude Max and ChatGPT Pro separately is $400/month combined. Perplexity Max includes Claude Opus 4.5 and o3-Pro at $200/month. MODUS PILOT includes Claude Opus 4.8, Claude Fable 5, GPT-5.6 Sol and Gemini 3.1 Pro at $59/month, but does not include Grok 4 or o3-Pro.',
    },
    {
      q: 'Which Perplexity alternative is best for research with citations?',
      a: 'Perplexity itself. Sonar is purpose-built for cited search and the alternatives in this list, MODUS included, are not better at it. If cited research is your main use case, switching is likely a downgrade.',
    },
    {
      q: 'Does MODUS have a free trial?',
      a: 'There is a 3-day trial, but a card is required up front and there is no free tier. That is a higher bar to entry than Perplexity, ChatGPT or Claude, all of which have free plans.',
    },
  ],
};

const MODUS_VS_PERPLEXITY: Post = {
  slug: 'modus-vs-perplexity',
  title: 'MODUS vs Perplexity: Ten Models Side by Side vs the Best Search Engine',
  description:
    'A direct comparison of MODUS and Perplexity on models, multi-model comparison, price and transparency. Written by the team that builds MODUS.',
  excerpt:
    'Perplexity charges $200/mo for a three-model council. We charge $59 for ten. It also beats us at search, and that matters more than the price.',
  tags: ['Comparisons'],
  published: '2026-07-28',
  updated: '2026-07-28',
  readMinutes: 6,
  author: 'Jeremiah Diana',
  hero: { kind: 'wordmark', label: 'MODUS vs Perplexity', from: 'rgba(14,165,233,0.50)', via: 'rgba(124,58,237,0.20)' },
  related: ['best-perplexity-alternatives-2026'],
  body: [
    {
      type: 'p',
      text: 'These two products look similar from the outside and are built around opposite bets. Perplexity bet that the interface to AI is **search**. MODUS bet that it is **which model you are talking to**.',
    },
    {
      type: 'callout',
      tone: 'note',
      title: 'Full disclosure',
      text: 'We build MODUS. Every Perplexity figure below comes from their published pricing as of July 2026, and the section on where Perplexity wins is not a courtesy — it is the honest answer for most readers.',
    },
    { type: 'h2', id: 'price', text: 'Price and what unlocks the multi-model feature' },
    {
      type: 'table',
      head: ['', 'Perplexity', 'MODUS'],
      rows: [
        ['Entry plan', '$20/mo · Pro', '$24/mo · MODUS'],
        ['Top plan', '$200/mo · Max', '$59/mo · PILOT'],
        ['Annual top plan', '$2,000/yr ($167/mo)', '$588/yr ($49/mo)'],
        ['Multi-model feature', 'Model Council, 3 models, Max only', 'Compare mode, up to 10 models, PILOT'],
      ],
    },
    {
      type: 'p',
      text: 'The single clearest difference on this page: **the multi-model feature costs $200/month on Perplexity and $59/month on MODUS**, and ours runs more than three times as many models.',
    },
    { type: 'h2', id: 'models', text: 'Model generation' },
    {
      type: 'table',
      head: ['Lab', 'Perplexity', 'MODUS'],
      rows: [
        ['OpenAI', 'GPT-5.2 (Pro), GPT-5.4 (Council)', 'GPT-5.6 Terra, GPT-5.6 Sol'],
        ['Anthropic', 'Sonnet 4.6, Opus 4.5 (Max)', 'Sonnet 5, Opus 4.8, Fable 5'],
        ['Google', 'Gemini 3.1 Pro', 'Gemini 3.1 Pro, Gemini 3.5 Flash'],
        ['xAI', 'Grok 4 (Max)', 'Not available'],
        ['In-house search', 'Sonar', 'Not available'],
      ],
    },
    {
      type: 'p',
      text: 'MODUS runs a newer generation from each of the three big labs. Perplexity has two things we do not: **Grok 4** and **Sonar**.',
    },
    { type: 'h2', id: 'transparency', text: 'Knowing which model answered' },
    {
      type: 'p',
      text: 'MODUS names the exact model on every answer, and if a provider fails and the request falls back, the interface says so rather than presenting the substitute as the model you picked. Perplexity\'s Pro routing does not surface which model produced an answer, or at what reasoning effort.',
    },
    {
      type: 'quote',
      text: 'It has been getting things wrong a lot. I exclusively use reasoning models and switch between GPT 5.4 Thinking and Claude Sonnet 4.6 Thinking. Recently it started getting a lot of questions wrong.',
      cite: 'r/perplexity_ai, June 2026',
    },
    { type: 'h2', id: 'where-perplexity-wins', text: 'Where Perplexity wins, plainly' },
    {
      type: 'ul',
      items: [
        '**Search and citations.** Sonar is built for it. We are not better at this and we are not close.',
        '**Grok 4 and o3-Pro.** Available on Max. Not available on MODUS at all.',
        '**Maturity.** Millions of users, a long track record, a mature mobile app. MODUS is new and small.',
        '**A free tier.** Perplexity has one. MODUS requires a card to start.',
      ],
    },
    { type: 'h2', id: 'verdict', text: 'Who should pick which' },
    {
      type: 'p',
      text: '**Pick Perplexity** if researched answers with clickable sources are the main thing you do, or if you want Grok 4. That is a large share of people reading this, and switching would be a downgrade.',
    },
    {
      type: 'p',
      text: '**Pick MODUS** if you are already paying for two or more AI subscriptions, if you want the newest frontier model from each lab in one place, or if you want to see several models answer the same question without paying $200 a month for the privilege.',
    },
  ],
  faq: [
    {
      q: 'Is MODUS cheaper than Perplexity?',
      a: 'At the entry tier, no: Perplexity Pro is $20/month against MODUS at $24. At the top tier, substantially yes: Perplexity Max is $200/month against MODUS PILOT at $59, or $49/month billed annually.',
    },
    {
      q: 'Does MODUS replace Perplexity for search?',
      a: 'No. Perplexity\'s Sonar is purpose-built for cited search and is better at it. MODUS is built around choosing and comparing models, not around search.',
    },
    {
      q: 'What is the difference between Model Council and MODUS compare mode?',
      a: 'Both run several models on the same prompt and summarise the result. Model Council runs three models and requires Perplexity Max at $200/month. Compare mode runs up to ten models with a verdict and is included in MODUS PILOT at $59/month.',
    },
    {
      q: 'Does MODUS have Grok?',
      a: 'No. Grok 4 is available on Perplexity Max and is not currently available on MODUS.',
    },
  ],
};

export const POSTS: Post[] = [PERPLEXITY_ALTERNATIVES, MODUS_VS_PERPLEXITY];

export function getPost(slug: string): Post | undefined {
  return POSTS.find(p => p.slug === slug);
}

/** Newest first. `published` is an ISO date so a string sort is a date sort. */
export function sortedPosts(): Post[] {
  return [...POSTS].sort((a, b) => b.published.localeCompare(a.published));
}
