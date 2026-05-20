import { createOpenAI } from '@ai-sdk/openai';
import { generateText } from 'ai';
import { adminAuth } from '@/lib/firebase-admin';

export async function POST(req: Request) {
  try {
    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (token) {
      try { await adminAuth.verifyIdToken(token); } catch { /* allow anyway */ }
    }

    const { title, description, timeframe } = await req.json() as {
      title: string;
      description?: string;
      timeframe?: string;
    };

    if (!title?.trim()) return Response.json({ suggestions: [] });

    const key = process.env.GROQ_API_KEY;
    if (!key) return Response.json({ suggestions: [] });

    const groq = createOpenAI({ baseURL: 'https://api.groq.com/openai/v1', apiKey: key });

    const tfLabel = timeframe === 'short' ? 'under 1 year' : timeframe === 'long' ? 'more than 1 year' : '';

    const prompt = `Someone has a goal: "${title}"${description ? `. Context: ${description}` : ''}${tfLabel ? `. Timeframe: ${tfLabel}` : ''}.

Generate exactly 5 ultra-specific research questions or exploration prompts to help them deeply pursue this goal. These must be highly specific to THIS exact goal — reference real people, methods, paths, or breakdowns where relevant. Not generic self-help questions.

Examples of the specificity level wanted:
- Goal "be a pro soccer player" → "How did Cristiano Ronaldo structure his development from age 12–18?" or "What's the difference between MLS vs European academy paths for youth players?"
- Goal "build a million dollar business" → "How did Shopify go from $0 to $1M ARR and what made it click?" or "What business models produce the fastest path to $1M revenue?"

Output ONLY a valid JSON array of exactly 5 strings. No explanation, no markdown, no extra text. Just the array.`;

    const { text } = await generateText({
      model: groq('llama-3.3-70b-versatile'),
      prompt,
      maxTokens: 512,
    });

    const clean = text.trim().replace(/^```json?\s*/i, '').replace(/```\s*$/, '').trim();
    const suggestions = JSON.parse(clean) as string[];
    return Response.json({ suggestions: suggestions.slice(0, 5) });
  } catch {
    return Response.json({ suggestions: [] });
  }
}
