import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';

export async function GET(req: NextRequest) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '');

  let industry = 'business and entrepreneurship';
  if (token) {
    try {
      const decoded = await adminAuth.verifyIdToken(token);
      const userDoc = await adminDb.collection('users').doc(decoded.uid).get();
      const ind = userDoc.data()?.onboardingAnswers?.industry;
      if (ind) industry = ind;
    } catch {}
  }

  const key = process.env.TAVILY_API_KEY;
  if (!key) return NextResponse.json({ items: [] });

  try {
    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: key,
        query: `${industry} news`,
        topic: 'news',
        days: 1,
        max_results: 5,
        include_answer: false,
      }),
      next: { revalidate: 1800 },
    });

    if (!res.ok) return NextResponse.json({ items: [] });
    const data = await res.json();

    const items = (data.results ?? []).map((r: { title: string; url: string; content: string }) => ({
      title: r.title,
      url: r.url,
      snippet: (r.content ?? '').slice(0, 140),
    }));

    return NextResponse.json({ items, industry });
  } catch {
    return NextResponse.json({ items: [] });
  }
}
