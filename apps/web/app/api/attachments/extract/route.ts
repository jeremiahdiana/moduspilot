import { adminAuth } from '@/lib/firebase-admin';
import { extractText, getDocumentProxy } from 'unpdf';

// Extracts text from an uploaded PDF so MODUS can read it in chat. Text-based
// files (.txt/.md/.csv/code) are read client-side; only PDFs come here.
export const runtime = 'nodejs';
export const maxDuration = 30;

const MAX_CHARS = 24000; // keep the injected context bounded

export async function POST(req: Request) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    await adminAuth.verifyIdToken(token);
  } catch {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const form = await req.formData();
  const file = form.get('file');
  if (!(file instanceof File)) return Response.json({ error: 'No file provided' }, { status: 400 });
  if (file.size > 15 * 1024 * 1024) return Response.json({ error: 'File too large (max 15MB)' }, { status: 413 });

  const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
  if (!isPdf) return Response.json({ error: 'Only PDF files are supported here' }, { status: 415 });

  try {
    const buf = new Uint8Array(await file.arrayBuffer());
    const pdf = await getDocumentProxy(buf);
    const { text } = await extractText(pdf, { mergePages: true });
    const clean = (typeof text === 'string' ? text : (text as string[]).join('\n')).replace(/[ \t]+\n/g, '\n').trim();
    if (!clean) return Response.json({ error: 'No readable text found (is it a scanned image?)' }, { status: 422 });
    return Response.json({ name: file.name, text: clean.slice(0, MAX_CHARS), truncated: clean.length > MAX_CHARS });
  } catch (e) {
    console.error('[attachments/extract] pdf parse failed:', e);
    return Response.json({ error: 'Could not read this PDF' }, { status: 422 });
  }
}
