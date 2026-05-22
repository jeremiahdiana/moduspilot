import { adminAuth } from '@/lib/firebase-admin';
import { getAllGoogleAccounts } from '@/lib/google-oauth';

export async function GET(req: Request) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return Response.json({ accounts: [] });

  try {
    const { uid } = await adminAuth.verifyIdToken(token);
    const accounts = await getAllGoogleAccounts(uid);
    return Response.json({ accounts, connected: accounts.length > 0 });
  } catch {
    return Response.json({ accounts: [], connected: false });
  }
}
