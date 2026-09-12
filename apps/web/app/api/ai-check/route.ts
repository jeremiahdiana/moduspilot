import { requireAuth } from '@/lib/api-auth';

// AI-text detector, proxied to GPTZero so the API key never reaches the client.
// The user triggers this from a chat message's "Check for AI" action. Detectors
// are probabilistic — we return a score + confidence band, never a verdict.
//
// Needs GPTZERO_API_KEY. Until it's set the route returns a clear 503 the UI can
// show, rather than a generic failure.
const GPTZERO_URL = 'https://api.gptzero.me/v2/predict/text';
const MAX_CHARS = 20000; // GPTZero rejects very short/very long docs; keep it sane.

export async function POST(req: Request) {
  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;

  const key = process.env.GPTZERO_API_KEY;
  if (!key) {
    return Response.json(
      { error: 'not_configured', message: 'AI detection is not set up yet (missing API key).' },
      { status: 503 },
    );
  }

  let text = '';
  try {
    const body = (await req.json()) as { text?: string };
    text = (body.text ?? '').trim().slice(0, MAX_CHARS);
  } catch {
    return Response.json({ error: 'bad_request' }, { status: 400 });
  }
  if (text.length < 40) {
    return Response.json(
      { error: 'too_short', message: 'Add more text. Detection needs at least a couple of sentences.' },
      { status: 422 },
    );
  }

  try {
    const res = await fetch(GPTZERO_URL, {
      method: 'POST',
      headers: {
        'x-api-key': key,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ document: text }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      console.error('[ai-check] GPTZero error', res.status, detail.slice(0, 300));
      return Response.json({ error: 'provider_error', status: res.status }, { status: 502 });
    }

    const data = (await res.json()) as {
      documents?: Array<{
        class_probabilities?: { ai?: number; human?: number; mixed?: number };
        predicted_class?: string;
        confidence_category?: string;
      }>;
    };
    const doc = data.documents?.[0];
    if (!doc?.class_probabilities) {
      return Response.json({ error: 'no_result' }, { status: 502 });
    }

    const p = doc.class_probabilities;
    return Response.json({
      ai: p.ai ?? 0,
      human: p.human ?? 0,
      mixed: p.mixed ?? 0,
      predictedClass: doc.predicted_class ?? 'unknown', // 'ai' | 'human' | 'mixed'
      confidence: doc.confidence_category ?? 'low',      // 'high' | 'medium' | 'low'
    });
  } catch (e) {
    console.error('[ai-check] request failed', e);
    return Response.json({ error: 'request_failed' }, { status: 502 });
  }
}
