import { exchangeSlackCode, storeSlackTokens } from '@/lib/slack-oauth';
import { verifyOAuthState } from '@/lib/oauth-state';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  const appUrl = process.env.NEXT_PUBLIC_APP_URL!;

  if (error || !code || !state) {
    return Response.redirect(`${appUrl}/settings?tab=connectors&error=slack_denied`);
  }

  try {
    const verified = verifyOAuthState(state);
    if (!verified) throw new Error('Invalid OAuth state');
    const { uid, origin = 'settings' } = verified;
    const tokens = await exchangeSlackCode(code);
    await storeSlackTokens(uid, tokens);
    if (origin === 'chat') {
      return Response.redirect(`${appUrl}/chat?connected=slack`);
    }
    return Response.redirect(`${appUrl}/settings?tab=connectors&connected=slack`);
  } catch (e) {
    console.error('[slack/callback]', e);
    return Response.redirect(`${appUrl}/settings?tab=connectors&error=slack_failed`);
  }
}
