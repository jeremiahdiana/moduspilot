import { isSelfQuery } from '@/lib/chat/self-query';

export interface TavilyResult {
  title: string;
  url: string;
  content: string;
  score: number;
}

export async function webSearch(query: string, maxResults = 5): Promise<TavilyResult[]> {
  const key = process.env.TAVILY_API_KEY;
  if (!key) return [];
  try {
    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: key,
        query,
        search_depth: 'basic',
        max_results: maxResults,
        include_answer: false,
      }),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.results ?? []) as TavilyResult[];
  } catch {
    return [];
  }
}

// Decide whether the query warrants a web search
export function shouldWebSearch(query: string): boolean {
  if (query.length < 8) return false;
  const lower = query.toLowerCase();
  // Skip clearly personal/internal queries
  const personal = ['my goal', 'my task', 'my habit', 'my email', 'my calendar', 'my schedule', 'briefing', 'how am i', 'my progress', 'add task', 'add goal', 'add habit', 'did i miss', 'have i missed', 'i missed', 'anything important', 'what did i', 'catch me up', 'update me', 'remind me', 'what should i'];
  if (personal.some(p => lower.includes(p))) return false;
  // Questions about MODUS itself are answered from the system prompt's own model
  // catalog, never from the web. Without this, "how do u route ur models?" trips
  // the 'how do' keyword below, MODUS searches the public web for a question about
  // MODUS, and answers it by citing a stranger's blog post about model routing in
  // general. See lib/chat/self-query.ts for the full account.
  if (isSelfQuery(query)) return false;
  // Search for external info — require an explicit external keyword, never trigger on ? alone
  const external = ['search', 'look up', 'find out', 'what is', 'what are', 'who is', 'how to', 'how do', 'latest', 'current', 'news', 'price', 'weather', 'when is', 'where is', 'tell me about', 'explain', 'definition', 'vs ', 'compare', 'best ', 'cost of', 'how much'];
  return external.some(p => lower.includes(p));
}
