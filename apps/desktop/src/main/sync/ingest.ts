import log from 'electron-log';
import { getMainWindow } from '../windows';
import type { NoteRecord, ConversationRecord, ReminderRecord } from '../../shared/types';

const INGEST_URL = 'https://moduspilot.com/api/desktop/ingest';

// Pull a fresh Firebase ID token from the signed-in web app window. The web
// app exposes window.__modusGetToken__ only when it detects the desktop user
// agent; getIdToken() auto-refreshes if the token is near expiry. Returns null
// if the page isn't loaded/signed-in yet.
export async function getIdToken(): Promise<string | null> {
  const win = getMainWindow();
  if (!win) return null;
  try {
    const token = await win.webContents.executeJavaScript(
      'window.__modusGetToken__ ? window.__modusGetToken__() : null'
    );
    return typeof token === 'string' && token.length > 0 ? token : null;
  } catch (err) {
    log.error('[ingest] failed to read token from window', err);
    return null;
  }
}

function decodeEmail(jwt: string): string | null {
  try {
    const payload = JSON.parse(Buffer.from(jwt.split('.')[1], 'base64').toString('utf8'));
    return typeof payload.email === 'string' ? payload.email : null;
  } catch {
    return null;
  }
}

export async function getAuthState(): Promise<{ signedIn: boolean; email: string | null }> {
  const token = await getIdToken();
  if (!token) return { signedIn: false, email: null };
  return { signedIn: true, email: decodeEmail(token) };
}

export interface IngestResult { notesWritten: number; messagesWritten: number; remindersWritten?: number }

// Uploads local notes/messages/reminders to the web backend, authenticated with
// the signed-in window's ID token. Returns null if not signed in or the request
// fails (sync stays a no-op until the user signs in via the MODUS window).
export async function ingest(payload: {
  notes?: NoteRecord[];
  messages?: ConversationRecord[];
  reminders?: ReminderRecord[];
}): Promise<IngestResult | null> {
  const token = await getIdToken();
  if (!token) {
    log.info('[ingest] no auth token yet — open MODUS and sign in');
    return null;
  }
  try {
    const res = await fetch(INGEST_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      log.error('[ingest] POST failed', res.status, await res.text().catch(() => ''));
      return null;
    }
    return (await res.json()) as IngestResult;
  } catch (err) {
    log.error('[ingest] request error', err);
    return null;
  }
}
