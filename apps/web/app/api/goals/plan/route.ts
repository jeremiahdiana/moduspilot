import { createOpenAI } from '@ai-sdk/openai';
import { generateText } from 'ai';
import { adminAuth } from '@/lib/firebase-admin';

export async function POST(req: Request) {
  try {
    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return Response.json({ milestones: [] }, { status: 401 });
    try { await adminAuth.verifyIdToken(token); } catch { return Response.json({ milestones: [] }, { status: 401 }); }

    const { title, description, timeframe } = await req.json() as {
      title: string;
      description?: string;
      timeframe?: string;
    };
    if (!title?.trim()) return Response.json({ milestones: [] });

    const key = process.env.AI_GATEWAY_API_KEY;
    if (!key) return Response.json({ milestones: [] });

    const gateway = createOpenAI({ baseURL: 'https://ai-gateway.vercel.sh/v1', apiKey: key });
    const tfLabel = timeframe === 'long' ? 'long-term (1+ years)' : 'short-term (under 1 year)';

    const { text } = await generateText({
      model: gateway('meta/llama-3.3-70b'),
      prompt: `Goal: "${title}"${description ? `\nContext: ${description}` : ''}\nTimeframe: ${tfLabel}

Generate 5–7 concrete milestones that take this goal from 0% to 100% complete. Each should be a clear, definitively completable checkpoint — not a vague phase.

Rules:
- Specific to THIS goal (not generic like "do research" or "take action")
- In logical order — each unlocks the next
- Start with a past-tense or action verb where possible ("Identify...", "Complete...", "Launch...")
- Under 10 words each

Output ONLY a valid JSON array of 5–7 strings. No markdown, no explanation.`,
      maxTokens: 400,
    });

    const clean = text.trim().replace(/^```json?\s*/i, '').replace(/```\s*$/, '').trim();
    const milestones = JSON.parse(clean) as string[];
    return Response.json({ milestones: milestones.slice(0, 7) });
  } catch {
    return Response.json({ milestones: [] });
  }
}
