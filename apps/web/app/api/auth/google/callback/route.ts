import { exchangeCode, storeGoogleAccountTokens } from '@/lib/google-oauth';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  const appUrl = process.env.NEXT_PUBLIC_APP_URL!;

  if (error || !code || !state) {
    let origin = 'settings';
    if (state) {
      try { origin = JSON.parse(Buffer.from(state, 'base64url').toString()).origin ?? 'settings'; } catch {}
    }
    if (origin === 'onboarding') {
      return Response.redirect(`${appUrl}/onboarding?error=google_denied`);
    }
    return Response.redirect(`${appUrl}/settings?tab=connectors&error=google_denied`);
  }

  try {
    const decoded = JSON.parse(Buffer.from(state, 'base64url').toString());
    const { uid, origin = 'settings' } = decoded;
    const tokens = await exchangeCode(code);

    // Fetch the email of the account that just authorized
    let email = '';
    try {
      const profileRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });
      if (profileRes.ok) {
        const profile = await profileRes.json();
        email = profile.email ?? '';
      }
    } catch {}

    if (!email) throw new Error('Could not determine account email');

    await storeGoogleAccountTokens(uid, { ...tokens, email });

    if (origin === 'onboarding') {
      return Response.redirect(`${appUrl}/onboarding?connected=${encodeURIComponent(email)}`);
    }
    return Response.redirect(`${appUrl}/settings?tab=connectors&connected=${encodeURIComponent(email)}`);
  } catch (e) {
    console.error('[google/callback]', e);
    const origin = (() => { try { return JSON.parse(Buffer.from(state!, 'base64url').toString()).origin ?? 'settings'; } catch { return 'settings'; } })();
    if (origin === 'onboarding') {
      return Response.redirect(`${appUrl}/onboarding?error=google_failed`);
    }
    return Response.redirect(`${appUrl}/settings?tab=connectors&error=google_failed`);
  }
}
