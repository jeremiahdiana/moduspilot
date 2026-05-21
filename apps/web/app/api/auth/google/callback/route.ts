import { exchangeCode, storeGoogleTokens } from '@/lib/google-oauth';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  const appUrl = process.env.NEXT_PUBLIC_APP_URL!;

  if (error || !code || !state) {
    return Response.redirect(`${appUrl}/settings?error=google_denied`);
  }

  try {
    const { uid } = JSON.parse(Buffer.from(state, 'base64url').toString());
    const tokens = await exchangeCode(code);

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

    await storeGoogleTokens(uid, { ...tokens, email });
    return Response.redirect(`${appUrl}/settings?connected=google`);
  } catch (e) {
    console.error('[google/callback]', e);
    return Response.redirect(`${appUrl}/settings?error=google_failed`);
  }
}
