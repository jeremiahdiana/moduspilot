// Shared input rules keep the client and provider proxy in agreement.
export const AI_CHECK_MIN_CHARS = 40;
export const AI_CHECK_MAX_CHARS = 20_000;
export const AI_CHECK_TIMEOUT_MS = 10_000;

export function validateCheckText(input: unknown): { text: string } | { error: string; message: string; status: number } {
  if (typeof input !== 'string') return { error: 'bad_request', message: 'Enter text to check.', status: 400 };
  const text = input.trim();
  if (text.length < AI_CHECK_MIN_CHARS) return { error: 'too_short', message: 'Add more text. Detection needs at least 40 characters and works better with longer passages.', status: 422 };
  if (text.length > AI_CHECK_MAX_CHARS) return { error: 'too_long', message: 'Check up to 20,000 characters at a time.', status: 422 };
  return { text };
}

export function parseCheckResult(input: unknown): { ai: number; human: number } | null {
  const pct = (input as { data?: { fakePercentage?: unknown } } | null)?.data?.fakePercentage;
  if (typeof pct !== 'number' || !Number.isFinite(pct) || pct < 0 || pct > 100) return null;
  const ai = pct / 100;
  return { ai, human: 1 - ai };
}
