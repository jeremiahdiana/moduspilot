export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string;
  webViewLink: string;
}

export async function searchDriveFiles(accessToken: string, query: string, maxResults = 5): Promise<DriveFile[]> {
  try {
    const q = encodeURIComponent(`fullText contains '${query.replace(/'/g, "\\'")}' and trashed = false`);
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
  return ['file', 'doc', 'document', 'sheet', 'spreadsheet', 'slide', 'presentation', 'drive', 'folder', 'pdf', 'report', 'proposal', 'contract', 'deck'].some(k => lower.includes(k));
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
