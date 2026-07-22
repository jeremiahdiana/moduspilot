import { generateText } from 'ai';
import { adminAuth } from '@/lib/firebase-admin';
import { backgroundModel } from '@/lib/chat/model';

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
    // Either key is enough to answer: backgroundModel falls over to gpt-4o-mini on a
    // direct vendor key when the Gateway is rate-limited. Gating on the Gateway key
    // alone used to return an empty list whenever the Gateway was the problem.
    if (!key && !process.env.OPENAI_API_KEY?.trim()) return Response.json({ milestones: [] });

    const tfLabel = timeframe === 'long' ? 'long-term (1+ years)' : 'short-term (under 1 year)';

    const { text } = await generateText({
      model: backgroundModel('meta/llama-3.3-70b', 'goals-plan'),
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
