// Shared document helpers for the MODUS document canvas — markdown→HTML for the
// inline render + live editor preview, the branded printable PDF document, and a
// stable key used to persist edits. All AI/user text is HTML-escaped before any
// formatting is applied, so the HTML is safe to render.

export function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function inline(s: string): string {
  return escapeHtml(s)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*(?!\s)(.+?)\*/g, '$1<em>$2</em>')
    .replace(/`(.+?)`/g, '<code>$1</code>');
}

export function markdownToHtml(md: string): string {
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  const out: string[] = [];
  let listType: 'ul' | 'ol' | null = null;
  const closeList = () => { if (listType) { out.push(`</${listType}>`); listType = null; } };

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) { closeList(); continue; }

    const h = line.match(/^(#{1,4})\s+(.*)$/);
    if (h) { closeList(); const lvl = h[1].length; out.push(`<h${lvl}>${inline(h[2])}</h${lvl}>`); continue; }

    if (/^(-{3,}|\*{3,}|_{3,})$/.test(line)) { closeList(); out.push('<hr/>'); continue; }

    const ul = line.match(/^\s*[-*+]\s+(.*)$/);
    if (ul) { if (listType !== 'ul') { closeList(); out.push('<ul>'); listType = 'ul'; } out.push(`<li>${inline(ul[1])}</li>`); continue; }

    const ol = line.match(/^\s*\d+[.)]\s+(.*)$/);
    if (ol) { if (listType !== 'ol') { closeList(); out.push('<ol>'); listType = 'ol'; } out.push(`<li>${inline(ol[1])}</li>`); continue; }

    closeList();
    out.push(`<p>${inline(line)}</p>`);
  }
  closeList();
  return out.join('\n');
}

export function buildPrintDoc(title: string, markdown: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
<style>
  @page { margin: 20mm; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; color: #16121f; line-height: 1.6; max-width: 720px; margin: 0 auto; padding: 32px 24px; }
  .brand { display:flex; align-items:center; gap:8px; font-size:12px; letter-spacing:.14em; text-transform:uppercase; color:#7C3AED; font-weight:700; margin-bottom:24px; }
  h1 { font-size: 26px; margin: 0 0 18px; line-height:1.25; }
  h2 { font-size: 19px; margin: 26px 0 10px; }
  h3 { font-size: 16px; margin: 20px 0 8px; }
  h4 { font-size: 14px; margin: 16px 0 6px; }
  p { margin: 0 0 12px; }
  ul, ol { margin: 0 0 14px; padding-left: 22px; }
  li { margin: 4px 0; }
  hr { border: none; border-top: 1px solid #e2dcf4; margin: 22px 0; }
  code { background:#f3f0fb; padding:1px 5px; border-radius:4px; font-size:.9em; }
  strong { font-weight: 700; }
  @media print { body { padding: 0; } }
</style></head>
<body>
  <div class="brand">MODUS</div>
  <h1>${escapeHtml(title)}</h1>
  ${markdownToHtml(markdown)}
</body></html>`;
}

export function printDocument(title: string, markdown: string): void {
  const w = window.open('', '_blank');
  if (!w) return;
  w.document.write(buildPrintDoc(title, markdown));
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 250);
}

/** Stable per-document key (djb2) from the original block content — used to
 *  persist edits under users/{uid}/documents/{key} so they survive reloads. */
export function docKey(title: string, markdown: string): string {
  const s = `${title}\n${markdown}`;
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return `d${(h >>> 0).toString(36)}`;
}
