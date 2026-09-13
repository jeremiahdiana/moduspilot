import { requireAuth } from '@/lib/api-auth';

// AI-text detector, proxied to ZeroGPT so the API key never reaches the client.
// The user triggers this from a chat message's "Check for AI" action. Detectors
// are probabilistic, so we return a likelihood, never a verdict. ZeroGPT gives a
// single AI percentage, so we report AI% and derive human = 1 - ai.
//
// Needs ZEROGPT_API_KEY. Until it's set the route returns a clear 503 the UI can
// show, rather than a generic failure.
const ZEROGPT_URL = 'https://api.zerogpt.com/api/detect/detectText';
const MAX_CHARS = 20000; // Keep documents to a sane size for the detector.

export async function POST(req: Request) {
  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;

  const key = process.env.ZEROGPT_API_KEY;
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
    const res = await fetch(ZEROGPT_URL, {
      method: 'POST',
      headers: {
        ApiKey: key,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ input_text: text }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      console.error('[ai-check] ZeroGPT error', res.status, detail.slice(0, 300));
      return Response.json({ error: 'provider_error', status: res.status }, { status: 502 });
    }

    // ZeroGPT nests the result under `data` and reports the AI likelihood as a
    // 0-100 percentage in `fakePercentage`. We normalise it to 0..1 and derive
    // human = 1 - ai.
    const data = (await res.json()) as {
      data?: { fakePercentage?: number };
    };
    const pct = data.data?.fakePercentage;
    if (typeof pct !== 'number' || Number.isNaN(pct)) {
      return Response.json({ error: 'no_result' }, { status: 502 });
    }

    const ai = Math.min(1, Math.max(0, pct / 100));
    return Response.json({ ai, human: 1 - ai });
  } catch (e) {
    console.error('[ai-check] request failed', e);
    return Response.json({ error: 'request_failed' }, { status: 502 });
  }
}
