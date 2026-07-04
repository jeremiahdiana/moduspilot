'use client';

import { motion } from 'framer-motion';

interface DocPayload {
  title?: string;
  markdown?: string;
}

// Minimal, dependency-free markdown → HTML for the printable document. Covers
// headings, bold/italic, unordered/ordered lists, horizontal rules, and
// paragraphs — enough for reports, briefs, and letters MODUS produces.
function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function inline(s: string): string {
  return escapeHtml(s)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*(?!\s)(.+?)\*/g, '$1<em>$2</em>')
    .replace(/`(.+?)`/g, '<code>$1</code>');
}

function markdownToHtml(md: string): string {
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

function buildPrintDoc(title: string, markdown: string): string {
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

// Renders MODUS-generated documents. MODUS emits a
// ```document {"title","markdown"}``` block; this card previews it and produces
// a real vector PDF through the browser's print pipeline (no server rendering).
export default function DocumentCard({ raw }: { raw: string }) {
  let data: DocPayload;
  try { data = JSON.parse(raw); } catch { data = { markdown: raw }; }
  const title = (data.title ?? 'Document').trim();
  const markdown = (data.markdown ?? '').trim();

  function downloadPdf() {
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(buildPrintDoc(title, markdown));
    w.document.close();
    w.focus();
    // Let the new document lay out before invoking the print dialog.
    setTimeout(() => w.print(), 250);
  }

  const preview = markdown.replace(/[#*`_>-]/g, '').split('\n').filter(Boolean).slice(0, 3).join(' ');

  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 220, damping: 24 }}
      className="border border-border rounded-2xl overflow-hidden bg-panel max-w-sm"
    >
      <div className="px-4 py-3 flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg bg-brand/10 border border-brand/20 flex items-center justify-center shrink-0">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-4 h-4 text-brand">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 4H7a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2z" />
          </svg>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-text truncate">{title}</p>
          <p className="text-xs text-muted line-clamp-2 mt-0.5">{preview || 'MODUS document'}</p>
        </div>
      </div>
      <div className="px-4 py-2.5 flex items-center gap-3 border-t border-border">
        <button onClick={downloadPdf} className="text-xs font-semibold text-brand hover:underline">
          Download PDF
        </button>
        <button
          onClick={() => navigator.clipboard?.writeText(markdown)}
          className="text-xs text-muted hover:text-text transition-colors"
        >
          Copy text
        </button>
      </div>
    </motion.div>
  );
}
