import { adminAuth } from '@/lib/firebase-admin';
import { extractText, getDocumentProxy } from 'unpdf';
import mammoth from 'mammoth';

// Extracts text from an uploaded PDF or Word (.docx) file so MODUS can read it
// in chat. Text-based files (.txt/.md/.csv/code) are read client-side; only
// binary docs (PDF, DOCX) come here.
export const runtime = 'nodejs';
export const maxDuration = 30;

const MAX_CHARS = 24000; // keep the injected context bounded
const DOCX_TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

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

  const name = file.name.toLowerCase();
  const isPdf = file.type === 'application/pdf' || name.endsWith('.pdf');
  const isDocx = file.type === DOCX_TYPE || name.endsWith('.docx');
  if (!isPdf && !isDocx) return Response.json({ error: 'Only PDF and Word (.docx) files are supported here' }, { status: 415 });

  try {
    let raw: string;
    if (isPdf) {
      const buf = new Uint8Array(await file.arrayBuffer());
      const pdf = await getDocumentProxy(buf);
      const { text } = await extractText(pdf, { mergePages: true });
      raw = typeof text === 'string' ? text : (text as string[]).join('\n');
    } else {
      const buffer = Buffer.from(await file.arrayBuffer());
      const { value } = await mammoth.extractRawText({ buffer });
      raw = value;
    }
    const clean = raw.replace(/[ \t]+\n/g, '\n').trim();
    if (!clean) return Response.json({ error: 'No readable text found (is it a scanned or empty document?)' }, { status: 422 });
    return Response.json({ name: file.name, text: clean.slice(0, MAX_CHARS), truncated: clean.length > MAX_CHARS });
  } catch (e) {
    console.error('[attachments/extract] parse failed:', e);
    return Response.json({ error: `Could not read this ${isPdf ? 'PDF' : 'document'}` }, { status: 422 });
  }
}
