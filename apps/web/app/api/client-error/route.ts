// Receives errors caught by the app's error boundary (app/error.tsx) and logs
// them server-side so they land in Vercel logs. This is how we diagnose the
// intermittent "500 / something went wrong" crashes on fast navigation without
// needing the browser console open when it happens. No auth: errors can occur
// pre-login, and this only writes to logs (never reads/writes user data).
export const runtime = 'nodejs';

const MAX = 8000; // cap each field so a runaway stack can't blow up the log line

function clip(v: unknown): string {
  return typeof v === 'string' ? v.slice(0, MAX) : '';
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    console.error('[modus:client-error]', JSON.stringify({
      message: clip(body.message),
      stack: clip(body.stack),
      digest: clip(body.digest),
      url: clip(body.url),
      ua: clip(req.headers.get('user-agent')),
      at: new Date().toISOString(),
    }));
  } catch {
    // never let the reporter itself throw
  }
  return Response.json({ ok: true });
}
