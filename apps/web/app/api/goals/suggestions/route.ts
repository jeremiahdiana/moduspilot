import { generateText } from 'ai';
import { adminAuth } from '@/lib/firebase-admin';
import { enforceAuxHourlyLimit } from '@/lib/chat/aux-limit';
import { backgroundModel } from '@/lib/chat/model';

export async function POST(req: Request) {
  try {
    // 🚨 THIS ROUTE USED TO RUN A MODEL FOR ANYONE. The token was optional and a
    // failed verify fell through with "allow anyway", so an unauthenticated caller
    // could spend inference on our key, unbounded, forever. Its only caller is the
    // authenticated goals page, so requiring a token costs nothing and closes an
    // open door.
    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return Response.json({ suggestions: [] }, { status: 401 });
    let uid: string;
    try { uid = (await adminAuth.verifyIdToken(token)).uid; }
    catch { return Response.json({ suggestions: [] }, { status: 401 }); }

    const limited = await enforceAuxHourlyLimit(uid, 'goalSuggest', 30);
    if (limited) return limited;

    const { title, description, timeframe } = await req.json() as {
      title: string;
      description?: string;
      timeframe?: string;
    };

    if (!title?.trim()) return Response.json({ suggestions: [] });

    const key = process.env.AI_GATEWAY_API_KEY;
    // Either key is enough to answer: backgroundModel falls over to gpt-4o-mini on a
    // direct vendor key when the Gateway is rate-limited. Gating on the Gateway key
    // alone used to return an empty list whenever the Gateway was the problem.
    if (!key && !process.env.OPENAI_API_KEY?.trim()) return Response.json({ suggestions: [] });


    const tfLabel = timeframe === 'short' ? 'under 1 year' : timeframe === 'long' ? 'more than 1 year' : '';

    const prompt = `Someone has a goal: "${title}"${description ? `. Context: ${description}` : ''}${tfLabel ? `. Timeframe: ${tfLabel}` : ''}.

Generate exactly 5 short conversation starters specifically about THIS goal. Each should feel like a natural thing to say to a trusted advisor who knows the goal — not a generic coaching question that could apply to anything.

Rules:
- Reference the actual goal or its domain directly (don't say "this goal", say what it is)
- Personal and reflective — about their own situation, blockers, next steps
- NOT external research (no "how did X person do Y", no "what do experts say")
- Under 10 words each
- Varied: mix planning, blockers, reflection, next actions

Example for goal "Launch my Shopify store by August":
["What's left before the store goes live?", "Which product should I launch with first?", "What's stopping me from setting the launch date?", "Walk me through my first week of marketing", "What's realistic revenue in month one?"]

Output ONLY a valid JSON array of exactly 5 strings. No explanation, no markdown.`;

    const { text } = await generateText({
      model: backgroundModel('meta/llama-3.3-70b', 'goals-suggestions'),
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
