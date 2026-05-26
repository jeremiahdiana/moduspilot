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
    if (!gh) { console.warn('[projects/resources] GitHub: no token found for uid', uid); return []; }
    const res = await fetch('https://api.github.com/user/repos?sort=updated&per_page=50&visibility=all', {
      headers: { Authorization: `Bearer ${gh.token}`, Accept: 'application/vnd.github+json' },
    });
    if (!res.ok) {
      console.error('[projects/resources] GitHub API error', res.status, await res.text());
      return [];
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const repos: any = await res.json();
    if (!Array.isArray(repos)) {
      console.error('[projects/resources] GitHub returned non-array:', repos);
      return [];
    }
    return repos.map((r: { id: number; full_name: string; description?: string; private?: boolean; html_url: string }) => ({
      id: String(r.id),
      name: r.full_name,
      sub: r.description || (r.private ? 'Private' : 'Public'),
      url: r.html_url,
      repo: r.full_name,
    }));
  } catch (err) {
    console.error('[projects/resources] GitHub exception', err);
    return [];
  }
}

async function getNotionPages(uid: string): Promise<AvailableResource[]> {
  try {
    const snap = await adminDb.collection('users').doc(uid).collection('notion_accounts').limit(1).get();
    if (snap.empty) return [];
    const token = snap.docs[0].data().accessToken as string | undefined;
    if (!token) return [];
    const pages = await getRecentNotionPages(token, 20);
    return pages.map(p => ({
      id: p.id,
      name: p.title,
      sub: `${p.type} · edited ${p.lastEdited}`,
      url: p.url,
      pageId: p.id,  // use the API-provided ID, not parsed from URL
    }));
  } catch {
    return [];
  }
}

async function getSlackChannels(uid: string): Promise<AvailableResource[]> {
  try {
    const sl = await getFirstSlackToken(uid);
    if (!sl) { console.warn('[projects/resources] Slack: no token found for uid', uid); return []; }
    const res = await fetch(
      'https://slack.com/api/conversations.list?limit=100&types=public_channel,private_channel&exclude_archived=true',
      { headers: { Authorization: `Bearer ${sl.token}` } }
    );
    if (!res.ok) { console.error('[projects/resources] Slack API error', res.status); return []; }
    const data = await res.json() as { ok: boolean; error?: string; channels?: { id: string; name: string; is_member: boolean; num_members?: number }[] };
    if (!data.ok) { console.error('[projects/resources] Slack API not ok:', data.error); return []; }
    const all = data.channels ?? [];
    const joined = all.filter(c => c.is_member);
    // If bot is not in any channels, return all public channels so they can still see options
    const channels = joined.length > 0 ? joined : all.filter(c => !c.name.startsWith('_'));
    return channels.map(c => ({
      id: c.id,
      name: `#${c.name}`,
      sub: c.num_members != null ? `${c.num_members} members · ${sl.teamName}` : sl.teamName,
      channelId: c.id,
    }));
  } catch (err) {
    console.error('[projects/resources] Slack exception', err);
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
