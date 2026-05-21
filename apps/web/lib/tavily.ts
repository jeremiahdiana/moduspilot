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
  const personal = ['my goal', 'my task', 'my habit', 'my email', 'my calendar', 'my schedule', 'briefing', 'how am i', 'my progress', 'add task', 'add goal', 'add habit'];
  if (personal.some(p => lower.includes(p))) return false;
  // Search for external info
  const external = ['search', 'look up', 'find out', 'what is', 'what are', 'who is', 'how to', 'how do', 'latest', 'current', 'news', 'price', 'weather', 'when is', 'where is', 'tell me about', 'explain', 'definition', 'vs ', 'compare', 'best ', 'cost of', 'how much'];
  return external.some(p => lower.includes(p)) || lower.trimEnd().endsWith('?');
}
