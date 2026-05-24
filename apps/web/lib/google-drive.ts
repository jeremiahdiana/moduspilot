export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string;
  webViewLink: string;
}

function extractDriveKeywords(query: string): string {
  const stopWords = new Set(['can', 'u', 'i', 'the', 'a', 'an', 'and', 'or', 'for', 'to', 'in', 'my', 'is', 'it', 'of', 'do', 'you', 'me', 'at', 'on', 'with', 'find', 'access', 'open', 'show', 'get', 'look', 'file', 'doc', 'document', 'drive', 'something', 'about', 'there', 'any', 'have', 'are', 'see', 'please', 'help', 'need']);
  return query
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !stopWords.has(w))
    .slice(0, 5)
    .join(' ')
    .trim();
}

export async function searchDriveFiles(accessToken: string, query: string, maxResults = 5): Promise<DriveFile[]> {
  try {
    const keywords = extractDriveKeywords(query) || query.slice(0, 50);
    const safe = keywords.replace(/'/g, "\\'");
    const fields = encodeURIComponent('files(id,name,mimeType,modifiedTime,webViewLink)');

    // Search by file name first (more reliable than fullText for conversational queries)
    const nameQuery = encodeURIComponent(`name contains '${safe}' and trashed = false`);
    const nameRes = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${nameQuery}&pageSize=${maxResults}&fields=${fields}&orderBy=modifiedTime+desc`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const nameData = nameRes.ok ? await nameRes.json() : { files: [] };
    const nameFiles = (nameData.files ?? []) as DriveFile[];

    if (nameFiles.length > 0) return nameFiles;

    // Fall back to full-text search if name search returned nothing
    const ftQuery = encodeURIComponent(`fullText contains '${safe}' and trashed = false`);
    const ftRes = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${ftQuery}&pageSize=${maxResults}&fields=${fields}&orderBy=modifiedTime+desc`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!ftRes.ok) return [];
    const ftData = await ftRes.json();
    return (ftData.files ?? []) as DriveFile[];
  } catch {
    return [];
  }
}

export async function getRecentFiles(accessToken: string, maxResults = 8): Promise<DriveFile[]> {
  try {
    const q = encodeURIComponent('trashed = false');
    const fields = encodeURIComponent('files(id,name,mimeType,modifiedTime,webViewLink)');
    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${q}&pageSize=${maxResults}&fields=${fields}&orderBy=modifiedTime+desc`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return (data.files ?? []) as DriveFile[];
  } catch {
    return [];
  }
}

export function shouldSearchDrive(query: string): boolean {
  const lower = query.toLowerCase();
  return ['file', 'doc', 'document', 'sheet', 'spreadsheet', 'slide', 'presentation', 'drive', 'folder', 'pdf', 'report', 'proposal', 'contract', 'deck', 'find', 'access', 'open', 'look for', 'search for', 'onboarding', 'brief', 'notes', 'template'].some(k => lower.includes(k));
}

export function mimeLabel(mime: string): string {
  const map: Record<string, string> = {
    'application/vnd.google-apps.document': 'Doc',
    'application/vnd.google-apps.spreadsheet': 'Sheet',
    'application/vnd.google-apps.presentation': 'Slides',
    'application/vnd.google-apps.folder': 'Folder',
    'application/pdf': 'PDF',
  };
  return map[mime] ?? 'File';
}
