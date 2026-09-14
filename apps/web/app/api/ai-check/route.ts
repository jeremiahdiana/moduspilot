import { requireAuth } from '@/lib/api-auth';
import { AI_CHECK_TIMEOUT_MS, parseCheckResult, validateCheckText } from '@/lib/ai-check';

export async function POST(req: Request) {
  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;

  let body: { text?: unknown } | null;
  try { body = await req.json(); }
  catch { return Response.json({ error: 'bad_request', message: 'Enter text to check.' }, { status: 400 }); }
  const checked = validateCheckText(body?.text);
  if ('error' in checked) return Response.json(checked, { status: checked.status });

  const key = process.env.ZEROGPT_API_KEY;
  if (!key) return Response.json({ error: 'not_configured', message: 'AI detection is currently unavailable.' }, { status: 503 });

  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AI_CHECK_TIMEOUT_MS);
  const cancel = () => controller.abort();
  req.signal.addEventListener('abort', cancel, { once: true });
  if (req.signal.aborted) cancel();
  let outcome = 'request_failed';
  try {
    const res = await fetch('https://api.zerogpt.com/api/detect/detectText', {
      method: 'POST',
      headers: { ApiKey: key, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ input_text: checked.text }),
      signal: controller.signal,
    });
    if (!res.ok) {
      outcome = `provider_${res.status}`;
      return Response.json({ error: 'provider_error', message: 'The checker is unavailable. Try again shortly.' }, { status: 502 });
    }
    const result = parseCheckResult(await res.json());
    if (!result) {
      outcome = 'no_result';
      return Response.json({ error: 'no_result', message: 'The checker returned no valid result. Try again.' }, { status: 502 });
    }
    outcome = 'success';
    return Response.json(result);
  } catch {
    outcome = controller.signal.aborted ? 'timeout' : 'request_failed';
    return Response.json({ error: outcome, message: outcome === 'timeout' ? 'The checker took too long. Please retry.' : 'Could not reach the checker. Please retry.' }, { status: outcome === 'timeout' ? 504 : 502 });
  } finally {
    clearTimeout(timer);
    req.signal.removeEventListener('abort', cancel);
    console.info('[ai-check]', { outcome, durationMs: Date.now() - started });
  }
}
