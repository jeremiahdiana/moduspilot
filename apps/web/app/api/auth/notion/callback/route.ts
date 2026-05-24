import { exchangeNotionCode, storeNotionTokens } from '@/lib/notion-oauth';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  const appUrl = process.env.NEXT_PUBLIC_APP_URL!;

  if (error || !code || !state) {
    return Response.redirect(`${appUrl}/settings?tab=connectors&error=notion_denied`);
  }

  try {
    const { uid, origin = 'settings' } = JSON.parse(Buffer.from(state, 'base64url').toString());
    const tokens = await exchangeNotionCode(code);
    await storeNotionTokens(uid, tokens);
    if (origin === 'chat') {
      return Response.redirect(`${appUrl}/chat?connected=notion`);
    }
    return Response.redirect(`${appUrl}/settings?tab=connectors&connected=notion`);
  } catch (e) {
    console.error('[notion/callback]', e);
    return Response.redirect(`${appUrl}/settings?tab=connectors&error=notion_failed`);
  }
}
