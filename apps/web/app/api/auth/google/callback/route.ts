import { exchangeCode, storeGoogleAccountTokens } from '@/lib/google-oauth';
import { adminAuth } from '@/lib/firebase-admin';
import { verifyOAuthState, originFromState } from '@/lib/oauth-state';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  const appUrl = process.env.NEXT_PUBLIC_APP_URL!;

  if (error || !code || !state) {
    const origin = originFromState(state);
    if (origin === 'onboarding') {
      return Response.redirect(`${appUrl}/onboarding?error=google_denied`);
    }
    return Response.redirect(`${appUrl}/connections&error=google_denied`);
  }

  try {
    // Only trust a uid that came back inside a state WE signed — otherwise an
    // attacker could forge a state with a victim's uid and have us mint a custom
    // token for them (account takeover).
    const verified = verifyOAuthState(state);
    if (!verified) throw new Error('Invalid OAuth state');
    const { uid, origin = 'settings' } = verified;
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

    if (!email) throw new Error('Could not determine account email');

    await storeGoogleAccountTokens(uid, { ...tokens, email });

    // Issue a custom token so the client can re-establish the Firebase session
    // after the OAuth redirect. Without this, onAuthStateChanged can fire with
    // null on return and the user appears "signed out".
    let customToken = '';
    try { customToken = await adminAuth.createCustomToken(uid); } catch {}

    if (customToken) {
      const p = new URLSearchParams({ token: customToken, email, origin });
      return Response.redirect(`${appUrl}/auth/google-return?${p}`);
    }

    // Fallback if custom token creation failed
    if (origin === 'onboarding') {
      return Response.redirect(`${appUrl}/onboarding?connected=${encodeURIComponent(email)}`);
    }
    return Response.redirect(`${appUrl}/connections&connected=${encodeURIComponent(email)}`);
  } catch (e) {
    console.error('[google/callback]', e);
    const origin = originFromState(state);
    if (origin === 'onboarding') {
      return Response.redirect(`${appUrl}/onboarding?error=google_failed`);
    }
    return Response.redirect(`${appUrl}/connections&error=google_failed`);
  }
}
