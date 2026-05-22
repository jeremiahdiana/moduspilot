import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';

function cleanSnippet(text: string): string {
  return text
    .replace(/<[^>]+>/g, ' ')
    .replace(/#{1,6}\s*/g, '')
    .replace(/\*{1,3}([^*]*)\*{1,3}/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\n+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .slice(0, 160);
}

export async function GET(req: NextRequest) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '');
  const urlTopic = new URL(req.url).searchParams.get('topic');

  let industry = 'business and entrepreneurship';
  if (urlTopic) {
    industry = urlTopic;
  } else if (token) {
    try {
      const decoded = await adminAuth.verifyIdToken(token);
      const userDoc = await adminDb.collection('users').doc(decoded.uid).get();
      const data = userDoc.data();
      industry = data?.settings?.newsIndustry || data?.onboardingAnswers?.industry || industry;
    } catch {}
  }

  const key = process.env.TAVILY_API_KEY;
  if (!key) return NextResponse.json({ items: [], industry });

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
        include_images: true,
      }),
      next: { revalidate: 1800 },
    });

    if (!res.ok) return NextResponse.json({ items: [], industry });
    const data = await res.json();

    const topImages: string[] = data.images ?? [];
    const items = (data.results ?? []).map((r: {
      title: string; url: string; content: string; images?: string[];
    }, i: number) => ({
      title: r.title,
      url: r.url,
      snippet: cleanSnippet(r.content ?? ''),
      image: r.images?.[0] ?? topImages[i] ?? null,
    }));

    return NextResponse.json({ items, industry });
  } catch {
    return NextResponse.json({ items: [], industry });
  }
}
