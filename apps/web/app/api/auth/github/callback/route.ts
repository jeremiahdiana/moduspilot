import { exchangeGitHubCode, fetchGitHubUser, storeGitHubTokens } from '@/lib/github-oauth';
import { verifyOAuthState } from '@/lib/oauth-state';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  const appUrl = process.env.NEXT_PUBLIC_APP_URL!;

  if (error || !code || !state) {
    return Response.redirect(`${appUrl}/connections&error=github_denied`);
  }

  try {
    const verified = verifyOAuthState(state);
    if (!verified) throw new Error('Invalid OAuth state');
    const { uid, origin = 'settings' } = verified;
    const { access_token } = await exchangeGitHubCode(code);
    const ghUser = await fetchGitHubUser(access_token);
    await storeGitHubTokens(uid, { access_token, ...ghUser });
    if (origin === 'chat') {
      return Response.redirect(`${appUrl}/chat?connected=github`);
    }
    return Response.redirect(`${appUrl}/connections&connected=github`);
  } catch (e) {
    console.error('[github/callback]', e);
    return Response.redirect(`${appUrl}/connections&error=github_failed`);
  }
}
