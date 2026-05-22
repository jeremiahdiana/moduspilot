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

Generate exactly 5 short, personal conversation starters that help them think through their own situation with a trusted advisor. These should prompt reflection or planning — not external research. They're starting a coaching conversation, not a Google search.

Good examples:
- "What's the biggest thing blocking me right now?"
- "Break this into 90-day milestones"
- "What would 50% progress actually look like?"
- "What do I need to stop doing to make room for this?"
- "What's one move I can make this week?"

Bad examples (too specific / research-y):
- "How did [famous person] achieve X?"
- "What strategies do experts recommend for..."

Keep each under 8 words. Output ONLY a valid JSON array of exactly 5 strings. No explanation, no markdown.`;

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
