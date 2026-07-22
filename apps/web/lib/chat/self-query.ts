// "Is the user asking about MODUS itself?" — its models, routing, plans, limits,
// memory, or what it can do.
//
// Two consumers, and they MUST agree:
//   lib/tavily.ts          — never web-search a question about our own product.
//   lib/chat/auto-route.ts — never answer one on the weakest model.
//
// This is the exact query that produced the bug this file exists for:
//
//   "how do u route ur models?"
//
// It contains "how do", which shouldWebSearch() counts as an external-lookup
// keyword. So MODUS searched the public web for a question about MODUS, was
// handed a stranger's blog post about model routing in general, and — following
// the WEB SEARCH RESULTS block's own instruction to "cite sources naturally" —
// cited it back as though it were describing itself ("According to Dapto..."),
// while the routing chip said Llama 3.3. Every clause of that answer was about
// somebody else's product.
//
// HIGH PRECISION, NOT HIGH RECALL. Every pattern binds a self-reference to a
// product noun. A bare "you"/"your" is deliberately never enough — "write a post
// about your favourite models" is not a product question, and misfiring here
// silently disables web search on a query that wanted it.

const SELF_QUERY_PATTERNS: RegExp[] = [
  // Possessive bound to a product noun: "your models", "ur routing", "MODUS's plans".
  /\b(your|ur|yr|modus'?s?)\s+(own\s+|internal\s+)?(model|models|routing|router|brain|brains|plan|plans|pricing|tier|tiers|limit|limits|quota|memory|briefing|briefings|context window)\b/i,
  // "how do you route ... models", "how does MODUS choose which model".
  // The trailing model/brain noun is required: "can you pick a restaurant" also
  // matches "you pick", and that one genuinely wants a web search.
  /\b(you|u|modus)\s+(route|routes|pick|picks|choose|chooses|select|selects|decide|decides)\b[\s\S]{0,30}\b(model|models|brain|brains)\b/i,
  // "which model is this", "what model are you", "what model answered that".
  /\b(what|which)\s+(model|brain)\s+(is|are|am|was|did|does|do)\b/i,
  // "how many models do I get on this plan".
  /\bhow many (models|brains)\b/i,
  // The classic capability probe.
  /\bwhat (can|could) (you|u|modus) do\b/i,
  // MODUS named next to the product surface being asked about.
  /\bmodus\b[\s\S]{0,40}\b(model|models|routing|router|plan|plans|pricing|subscription|tier|feature|features|capabilit\w*)\b/i,
];

/** True when the question is about MODUS itself rather than about the world. */
export function isSelfQuery(q: string): boolean {
  if (!q) return false;
  return SELF_QUERY_PATTERNS.some(re => re.test(q));
}
