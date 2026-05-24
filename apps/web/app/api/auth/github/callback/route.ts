import { exchangeGitHubCode, fetchGitHubUser, storeGitHubTokens } from '@/lib/github-oauth';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  const appUrl = process.env.NEXT_PUBLIC_APP_URL!;

  if (error || !code || !state) {
    return Response.redirect(`${appUrl}/settings?tab=connectors&error=github_denied`);
  }

  try {
    const { uid } = JSON.parse(Buffer.from(state, 'base64url').toString());
    const { access_token } = await exchangeGitHubCode(code);
    const ghUser = await fetchGitHubUser(access_token);
    await storeGitHubTokens(uid, { access_token, ...ghUser });
    return Response.redirect(`${appUrl}/settings?tab=connectors&connected=github`);
  } catch (e) {
    console.error('[github/callback]', e);
    return Response.redirect(`${appUrl}/settings?tab=connectors&error=github_failed`);
  }
}
