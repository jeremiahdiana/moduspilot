export interface GitHubWorkItem {
  title: string;
  repo: string;
  url: string;
  kind: 'pr' | 'issue';
  updatedAt: string;
}

export async function getGitHubWorkItems(accessToken: string, login: string, limit = 8): Promise<GitHubWorkItem[]> {
  try {
    const headers = { Authorization: `Bearer ${accessToken}`, Accept: 'application/vnd.github+json' };

    const [prRes, issueRes] = await Promise.all([
      fetch(`https://api.github.com/search/issues?q=is:open+is:pr+author:${login}&sort=updated&per_page=${limit}`, { headers }),
      fetch(`https://api.github.com/search/issues?q=is:open+is:issue+assignee:${login}&sort=updated&per_page=${limit}`, { headers }),
    ]);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const prItems: any[] = prRes.ok ? (await prRes.json()).items ?? [] : [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const issueItems: any[] = issueRes.ok ? (await issueRes.json()).items ?? [] : [];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const map = (items: any[], kind: 'pr' | 'issue'): GitHubWorkItem[] =>
      items.slice(0, limit).map(i => ({
        title: i.title as string,
        repo: (i.repository_url as string)?.split('/').slice(-1)[0] ?? '',
        url: i.html_url as string,
        kind,
        updatedAt: (i.updated_at as string)?.slice(0, 10) ?? '',
      }));

    return [...map(prItems, 'pr'), ...map(issueItems, 'issue')].slice(0, limit);
  } catch {
    return [];
  }
}
