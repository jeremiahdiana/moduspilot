// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractTitle(page: any): string {
  const props = page.properties ?? {};
  for (const key of Object.keys(props)) {
    const prop = props[key];
    if (prop.type === 'title' && Array.isArray(prop.title) && prop.title.length > 0) {
      return prop.title.map((t: { plain_text: string }) => t.plain_text).join('').trim() || 'Untitled';
    }
  }
  return page.title?.[0]?.plain_text ?? 'Untitled';
}

export interface NotionPage {
  id: string;
  title: string;
  url: string;
  lastEdited: string;
  type: 'page' | 'database';
}

export async function getRecentNotionPages(accessToken: string, limit = 5): Promise<NotionPage[]> {
  try {
    const res = await fetch('https://api.notion.com/v1/search', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sort: { direction: 'descending', timestamp: 'last_edited_time' },
        page_size: limit,
      }),
    });
    if (!res.ok) return [];
    const data = await res.json();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (data.results ?? []).slice(0, limit).map((item: any) => ({
      id: item.id as string,
      title: item.object === 'database'
        ? (item.title?.[0]?.plain_text ?? 'Untitled database')
        : extractTitle(item),
      url: item.url ?? '',
      lastEdited: item.last_edited_time?.slice(0, 10) ?? '',
      type: item.object === 'database' ? 'database' : 'page',
    }));
  } catch {
    return [];
  }
}
