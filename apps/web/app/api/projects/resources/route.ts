import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase-admin';
import { getFirstGitHubToken } from '@/lib/github-oauth';
import { getFirstSlackToken } from '@/lib/slack-oauth';
import { getValidAccessToken } from '@/lib/google-oauth';
import { getRecentNotionPages } from '@/lib/notion-data';
import { getRecentFiles } from '@/lib/google-drive';
import { adminDb } from '@/lib/firebase-admin';

export interface AvailableResource {
  id: string;
  name: string;
  sub?: string;
  url?: string;
  // type-specific fields
  repo?: string;       // github
  pageId?: string;     // notion
  channelId?: string;  // slack
  fileId?: string;     // drive
}

async function getGitHubRepos(uid: string): Promise<AvailableResource[]> {
  try {
    const gh = await getFirstGitHubToken(uid);
    if (!gh) return [];
    const res = await fetch('https://api.github.com/user/repos?sort=updated&per_page=30&affiliation=owner,collaborator', {
      headers: { Authorization: `Bearer ${gh.token}`, Accept: 'application/vnd.github+json' },
    });
    if (!res.ok) return [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const repos: any[] = await res.json();
    return repos.map(r => ({
      id: String(r.id),
      name: r.full_name,
      sub: r.description || (r.private ? 'Private' : 'Public'),
      url: r.html_url,
      repo: r.full_name,
    }));
  } catch {
    return [];
  }
}

async function getNotionPages(uid: string): Promise<AvailableResource[]> {
  try {
    const snap = await adminDb.collection('users').doc(uid).collection('notion_accounts').limit(1).get();
    if (snap.empty) return [];
    const token = snap.docs[0].data().access_token as string | undefined;
    if (!token) return [];
    const pages = await getRecentNotionPages(token, 20);
    return pages.map(p => ({
      id: p.url,
      name: p.title,
      sub: `${p.type} · edited ${p.lastEdited}`,
      url: p.url,
      pageId: p.url.split('/').pop() ?? p.url,
    }));
  } catch {
    return [];
  }
}

async function getSlackChannels(uid: string): Promise<AvailableResource[]> {
  try {
    const sl = await getFirstSlackToken(uid);
    if (!sl) return [];
    const res = await fetch(
      'https://slack.com/api/conversations.list?limit=50&types=public_channel,private_channel&exclude_archived=true',
      { headers: { Authorization: `Bearer ${sl.token}` } }
    );
    if (!res.ok) return [];
    const data = await res.json() as { ok: boolean; channels?: { id: string; name: string; is_member: boolean; num_members?: number }[] };
    if (!data.ok) return [];
    return (data.channels ?? [])
      .filter(c => c.is_member)
      .map(c => ({
        id: c.id,
        name: `#${c.name}`,
        sub: c.num_members ? `${c.num_members} members · ${sl.teamName}` : sl.teamName,
        channelId: c.id,
      }));
  } catch {
    return [];
  }
}

async function getDriveFiles(uid: string): Promise<AvailableResource[]> {
  try {
    const token = await getValidAccessToken(uid);
    if (!token) return [];
    const files = await getRecentFiles(token, 20);
    return files.map(f => ({
      id: f.id,
      name: f.name,
      sub: `${f.mimeType.split('.').pop() ?? 'file'} · modified ${f.modifiedTime.slice(0, 10)}`,
      url: f.webViewLink,
      fileId: f.id,
    }));
  } catch {
    return [];
  }
}

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const token = authHeader.slice(7);
    const decoded = await adminAuth.verifyIdToken(token);
    const uid = decoded.uid;

    const type = req.nextUrl.searchParams.get('type');

    let items: AvailableResource[] = [];
    if (type === 'github') items = await getGitHubRepos(uid);
    else if (type === 'notion') items = await getNotionPages(uid);
    else if (type === 'slack') items = await getSlackChannels(uid);
    else if (type === 'drive') items = await getDriveFiles(uid);

    return NextResponse.json({ items });
  } catch (err) {
    console.error('[projects/resources]', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
