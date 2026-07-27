/**
 * The posts.
 *
 * 🚨 EVERY PRICE AND MODEL LIST HERE WAS VERIFIED 2026-07-27 AGAINST PUBLISHED
 * SOURCES, NOT RECALLED. Comparison content is the fastest-rotting thing on a
 * marketing site: a wrong competitor price is checkable in one click and costs
 * the reader for good. `updated` is rendered on the page so a stale post is
 * visibly stale. Re-verify before changing any figure below.
 *
 * MODUS ranks first. The one-line disclosure stays: it is what lets a page rank
 * itself #1 without reading as an ad, which is the whole reason the format works.
 * Competitor strengths are described where they are real, because a comparison
 * that describes rivals as worthless at everything is the standard spam pattern
 * and gets buried rather than ranked. What is NOT here, deliberately, is any
 * volunteering of MODUS weaknesses that no reader asked about.
 *
 * ⛔ DO NOT ADD unverifiable performance claims — "never hallucinates", "most
 * accurate", "beats X on benchmarks". There is no MODUS accuracy benchmark to
 * cite. Those are checkable, they are false-advertising shaped, and one of them
 * discredits every real number on the page. The defensible version of that
 * argument is the cross-checking section: running several models is how a wrong
 * answer gets caught, because one model cannot tell you it is wrong. That claim
 * is true, it is ours alone, and it needs no benchmark.
 */
import type { Post } from './types';

const PERPLEXITY_ALTERNATIVES: Post = {
  slug: 'best-perplexity-alternatives-2026',
  title: 'The Best Perplexity Alternatives in 2026',
  description:
    'Perplexity locks its 3-model council behind a $200/mo plan. We compare MODUS, Perplexity, ChatGPT and Claude on models, price and transparency.',
  excerpt:
    'Four options, real prices, and the one that runs ten frontier models side by side for less than a third of what the alternatives charge.',
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
      text: 'The hidden model routing, the reasoning effort you cannot see, or a subscription that quietly stopped being the product you bought. Whatever sent you looking, here is the field: **MODUS**, **Perplexity**, **ChatGPT** and **Claude**.',
    },
    {
      type: 'callout',
      tone: 'note',
      title: 'Full disclosure',
      text: 'We build MODUS, which we have placed first. Judge the ranking accordingly. Every price and model list on this page comes from each product\'s own published pricing as of July 2026, so you can check all of it.',
    },
    { type: 'h2', id: 'why-people-leave', text: 'Why people go looking' },
    {
      type: 'p',
      text: 'Almost everyone searching for an alternative is running into one of three walls.',
    },
    {
      type: 'ul',
      items: [
        '**You cannot see which model answered, or at what effort.** Perplexity Pro routes between Sonar, GPT-5.2, Claude Sonnet 4.6 and Gemini 3.1 Pro without telling you which one you got. When an answer is wrong, you cannot tell whether the frontier model failed or you were quietly handed a cheaper one.',
        '**The frontier models are behind the expensive tier.** Claude Opus, o3-Pro and Grok 4 are Perplexity Max features, and Max is $200 a month.',
        '**One model, one opinion.** ChatGPT and Claude each answer from a single lab. When that lab is confidently wrong, nothing in the product tells you.',
      ],
    },
    { type: 'h2', id: 'modus', text: '1. MODUS — every frontier model, side by side' },
    {
      type: 'p',
      text: 'MODUS runs the current frontier model from every major lab under one subscription, names the exact model on every answer, and can run the same question through all of them at once.',
    },
    {
      type: 'table',
      head: ['Plan', 'Price', 'Models'],
      rows: [
        ['MODUS', '$24/mo · $240/yr', 'Llama 3.3, DeepSeek V3.1, GPT-5.6 Terra, Claude Sonnet 5, Gemini 3.5 Flash'],
        ['PILOT', '$59/mo · $588/yr', 'Adds Claude Opus 4.8, Claude Fable 5, GPT-5.6 Sol, Gemini 3.1 Pro, Llama 4 Maverick'],
      ],
    },
    { type: 'h3', text: 'A newer generation than anyone else on this list' },
    {
      type: 'p',
      text: 'This is the part worth checking against the tables further down. MODUS serves **GPT-5.6** where Perplexity serves GPT-5.2. **Claude Sonnet 5 and Opus 4.8** where Perplexity serves Sonnet 4.6 and Opus 4.5. Plus **Claude Fable 5**, which none of the others carry at any price.',
    },
    { type: 'h3', text: 'Ten models on one question, for $59' },
    {
      type: 'p',
      text: 'Compare mode runs the same prompt across up to ten models simultaneously and shows the answers side by side with a verdict on which one served you best. Perplexity\'s equivalent, Model Council, runs **three** models and requires Max at **$200 a month**.',
    },
    {
      type: 'p',
      text: 'That is more than three times the models for less than a third of the price.',
    },
    { type: 'h3', text: 'The exact model, named, every time' },
    {
      type: 'p',
      text: 'Every MODUS answer carries the name of the model that produced it. If a provider fails and the request falls back, the interface says so rather than presenting a substitute as the model you picked. No silent downgrades, and no guessing which engine you actually paid for.',
    },
    { type: 'h2', id: 'cross-check', text: 'Why several models beats one, in practice' },
    {
      type: 'p',
      text: 'A model that is wrong is wrong confidently. It reads exactly like a model that is right, which is why a single answer gives you no way to grade it.',
    },
    {
      type: 'p',
      text: 'Running the same question across several frontier models changes that. **Where they agree, you can move fast. Where they split, you have found the part worth checking**, and you have found it in seconds instead of after acting on it. No single-model product can show you that, because it has nothing to disagree with.',
    },
    { type: 'h2', id: 'perplexity', text: '2. Perplexity — strong at cited search' },
    {
      type: 'p',
      text: 'Perplexity built its own search model, Sonar, and its answers come with sources you can click. If your work is almost entirely literature and link retrieval, that focus shows.',
    },
    {
      type: 'table',
      head: ['Plan', 'Price', 'Models'],
      rows: [
        ['Pro', '$20/mo · $200/yr', 'Sonar, GPT-5.2, Claude Sonnet 4.6, Gemini 3.1 Pro'],
        ['Max', '$200/mo · $2,000/yr', 'Adds Claude Opus 4.5, Sonnet 4.6 Thinking, o3-Pro, Grok 4, and Model Council'],
      ],
    },
    { type: 'h3', text: 'Tradeoffs' },
    {
      type: 'ul',
      items: [
        '**Model transparency.** Pro does not surface which model produced an answer, or at what reasoning effort.',
        '**A generation behind on models.** GPT-5.2 and Sonnet 4.6 against GPT-5.6 and Sonnet 5.',
        '**$200/month for multi-model.** Model Council is Max-only, and it is three models.',
      ],
    },
    { type: 'h2', id: 'chatgpt', text: '3. ChatGPT — the default, and one lab' },
    {
      type: 'p',
      text: 'Plus at $20/month is the most widely used AI subscription and the most polished single product in this list. Pro at $200/month unlocks gpt-5.6, gpt-5.6-sol, gpt-5.4, o3-pro, o4-mini and Codex at 20x the limits.',
    },
    { type: 'h3', text: 'Tradeoffs' },
    {
      type: 'ul',
      items: [
        '**Every answer comes from OpenAI.** No second reading, and no signal when a different lab would have answered differently.',
        '**Usage is not metered visibly.** You find the ceiling by hitting it.',
        '**$200/month** to reach the frontier tier.',
      ],
    },
    { type: 'h2', id: 'claude', text: '4. Claude — excellent writing, one lab' },
    {
      type: 'p',
      text: 'Pro is $20/month, or $17/month billed annually at $200 upfront, and includes the current Claude models plus Claude Code. Max runs $100 to $200/month for higher limits. For long-form writing and code review it is a genuinely strong product.',
    },
    { type: 'h3', text: 'Tradeoffs' },
    {
      type: 'ul',
      items: [
        '**One lab, same as ChatGPT.** One opinion per question.',
        '**No multi-model comparison** at any tier.',
        '**Up to $200/month** for the higher usage plans.',
      ],
    },
    { type: 'h2', id: 'how-to-choose', text: 'How to choose' },
    {
      type: 'ol',
      items: [
        '**Paying for more than one AI subscription right now?** That is the exact problem MODUS was built for. PILOT at $59 costs less than a third of any single $200 tier and carries a newer model from every lab.',
        '**Want to see several models answer the same question?** MODUS runs ten for $59. Perplexity runs three for $200. Nobody else offers it at all.',
        '**Doing almost nothing but cited literature search?** Perplexity\'s Sonar is built narrowly for that, and it is a reasonable pick if it is genuinely all you do.',
        '**Happy inside one lab and never want a second opinion?** ChatGPT Plus or Claude Pro at $20 will do it.',
      ],
    },
    {
      type: 'p',
      text: 'For most people paying real money for AI in 2026, the deciding question is simple: one model\'s opinion, or all of them. **MODUS is the only one on this list that makes the second option affordable.**',
    },
  ],
  faq: [
    {
      q: 'Why do people look for Perplexity alternatives?',
      a: 'The most common reasons are hidden model routing, where you cannot tell which model answered or at what reasoning effort, frontier models like Claude Opus and Grok 4 being locked behind the $200/month Max plan, and features changing during an annual subscription that was already paid for.',
    },
    {
      q: 'Is there a Perplexity alternative that runs several AI models at once?',
      a: 'Yes. MODUS compare mode runs the same prompt across up to ten frontier models and returns a verdict on which answered best, included in MODUS PILOT at $59/month. Perplexity\'s Model Council does something similar with three models but requires the Max plan at $200/month.',
    },
    {
      q: 'What is the cheapest way to get Claude Opus and GPT-5.6 in one subscription?',
      a: 'MODUS PILOT at $59/month, or $49/month billed annually, includes Claude Opus 4.8, Claude Fable 5, GPT-5.6 Sol and Gemini 3.1 Pro together. Buying Claude Max and ChatGPT Pro separately costs $400/month combined, and Perplexity Max is $200/month for an older generation of the same models.',
    },
    {
      q: 'Which AI subscription has the newest models in 2026?',
      a: 'MODUS carries GPT-5.6, Claude Sonnet 5, Claude Opus 4.8, Claude Fable 5 and Gemini 3.1 Pro. Perplexity serves GPT-5.2 and Claude Sonnet 4.6 on Pro, with Claude Opus 4.5 on Max, which is a generation behind on every lab.',
    },
    {
      q: 'How do you know which AI model actually answered your question?',
      a: 'On MODUS the exact model is named on every answer, and if a provider fails and the request falls back the interface says so rather than presenting the substitute as the model you selected. Perplexity Pro does not surface which model produced a given answer, or the reasoning effort applied to it.',
    },
  ],
};

const MODUS_VS_PERPLEXITY: Post = {
  slug: 'modus-vs-perplexity',
  title: 'MODUS vs Perplexity: Ten Models for $59, or Three for $200',
  description:
    'A direct comparison of MODUS and Perplexity on models, multi-model comparison, price and transparency, with published pricing for both.',
  excerpt:
    'Perplexity charges $200/mo for a three-model council. MODUS runs ten for $59, on a newer generation from every lab.',
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
      text: 'These two products look similar from the outside and are built on opposite bets. Perplexity bet that the interface to AI is **search**. MODUS bet that it is **which model you are talking to** — and that you should not have to pick just one.',
    },
    {
      type: 'callout',
      tone: 'note',
      title: 'Full disclosure',
      text: 'We build MODUS. Every Perplexity figure below comes from their own published pricing as of July 2026, so all of it is checkable.',
    },
    { type: 'h2', id: 'price', text: 'Price, and what it takes to unlock multi-model' },
    {
      type: 'table',
      head: ['', 'MODUS', 'Perplexity'],
      rows: [
        ['Entry plan', '$24/mo', '$20/mo · Pro'],
        ['Top plan', '**$59/mo**', '$200/mo · Max'],
        ['Annual top plan', '**$588/yr ($49/mo)**', '$2,000/yr ($167/mo)'],
        ['Multi-model', '**Up to 10 models**, on PILOT', 'Model Council, 3 models, Max only'],
      ],
    },
    {
      type: 'p',
      text: 'The headline is one line: **the multi-model feature costs $59/month on MODUS and $200/month on Perplexity, and ours runs more than three times as many models.**',
    },
    { type: 'h2', id: 'models', text: 'Model generation' },
    {
      type: 'table',
      head: ['Lab', 'MODUS', 'Perplexity'],
      rows: [
        ['OpenAI', '**GPT-5.6 Terra, GPT-5.6 Sol**', 'GPT-5.2 (Pro), GPT-5.4 (Council)'],
        ['Anthropic', '**Sonnet 5, Opus 4.8, Fable 5**', 'Sonnet 4.6, Opus 4.5 (Max)'],
        ['Google', '**Gemini 3.1 Pro, Gemini 3.5 Flash**', 'Gemini 3.1 Pro'],
        ['Meta', '**Llama 4 Maverick, Llama 3.3**', 'Not available'],
        ['DeepSeek', '**DeepSeek V3.1**', 'Not available'],
      ],
    },
    {
      type: 'p',
      text: 'MODUS runs a newer generation from each of the three biggest labs, and carries two more labs Perplexity does not offer at any tier.',
    },
    { type: 'h2', id: 'transparency', text: 'Knowing which model answered' },
    {
      type: 'p',
      text: 'MODUS names the exact model on every answer. If a provider fails and the request falls back, the interface says so rather than presenting the substitute as the model you picked. Perplexity Pro\'s routing does not surface which model produced an answer, or at what reasoning effort.',
    },
    {
      type: 'p',
      text: 'That matters most exactly when it is hardest to notice: when the answer is wrong and you have no way to tell whether the frontier model failed or you were quietly served something cheaper.',
    },
    {
      type: 'quote',
      text: 'It has been getting things wrong a lot. I exclusively use reasoning models and switch between GPT 5.4 Thinking and Claude Sonnet 4.6 Thinking. Recently it started getting a lot of questions wrong.',
      cite: 'r/perplexity_ai, June 2026',
    },
    { type: 'h2', id: 'cross-check', text: 'Catching an answer that is wrong' },
    {
      type: 'p',
      text: 'Every model in this category can produce something confident and incorrect, and none of them will flag it for you. A single answer, from any product, gives you nothing to grade it against.',
    },
    {
      type: 'p',
      text: 'Compare mode is the practical answer to that. Ask ten frontier models the same question at once: **where they agree, move fast. Where they split, that is the part worth checking**, surfaced in seconds rather than discovered after you have acted on it. It is the one thing a single-model product structurally cannot do.',
    },
    { type: 'h2', id: 'verdict', text: 'Who should pick which' },
    {
      type: 'p',
      text: '**Pick MODUS** if you are paying for more than one AI subscription, if you want the newest frontier model from every lab in one place, or if you want several models on the same question without paying $200 a month for three of them.',
    },
    {
      type: 'p',
      text: '**Pick Perplexity** if your work is almost entirely cited literature search and you have no interest in choosing models. That is what Sonar is built for, and it is a narrower job than most people are actually paying for.',
    },
  ],
  faq: [
    {
      q: 'Is MODUS cheaper than Perplexity?',
      a: 'For multi-model access, substantially. MODUS PILOT is $59/month, or $49/month billed annually, and runs up to ten models. Perplexity Max is $200/month, or $167/month annually, and its Model Council runs three. The entry tiers are close: MODUS at $24/month against Perplexity Pro at $20.',
    },
    {
      q: 'What is the difference between Model Council and MODUS compare mode?',
      a: 'Both run several models on the same prompt and summarise the result. MODUS compare mode runs up to ten models with a verdict on which answered best, included in PILOT at $59/month. Perplexity Model Council runs three models and requires Max at $200/month.',
    },
    {
      q: 'Does MODUS have newer models than Perplexity?',
      a: 'Yes. MODUS serves GPT-5.6, Claude Sonnet 5, Claude Opus 4.8 and Claude Fable 5. Perplexity serves GPT-5.2 and Claude Sonnet 4.6 on Pro, with Claude Opus 4.5 on Max, which is a generation behind on both OpenAI and Anthropic.',
    },
    {
      q: 'Can you tell which model answered on Perplexity?',
      a: 'Perplexity Pro does not surface which model produced a given answer or the reasoning effort applied. MODUS names the exact model on every answer and states explicitly when a request has fallen back to a different one.',
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
