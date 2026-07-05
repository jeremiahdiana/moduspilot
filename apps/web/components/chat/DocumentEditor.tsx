'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { markdownToHtml, printDocument } from '@/lib/document';

interface Props {
  open: boolean;
  title: string;
  markdown: string;
  saving?: boolean;
  onClose: () => void;
  onSave: (title: string, markdown: string) => void;
}

// Full-screen document workspace — edit the markdown on the left, see the
// rendered document live on the right, export to PDF. Save persists the edits.
export default function DocumentEditor({ open, title, markdown, saving, onClose, onSave }: Props) {
  const [t, setT] = useState(title);
  const [md, setMd] = useState(markdown);

  // Re-sync when a different document opens.
  useEffect(() => { if (open) { setT(title); setMd(markdown); } }, [open, title, markdown]);

  const dirty = t !== title || md !== markdown;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="bg-panel border border-border rounded-2xl w-full max-w-5xl h-[85vh] flex flex-col overflow-hidden shadow-2xl"
            initial={{ opacity: 0, scale: 0.97, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97, y: 12 }}
            transition={{ type: 'spring', stiffness: 260, damping: 26 }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center gap-3 px-5 py-3 border-b border-border">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-4 h-4 text-brand shrink-0">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 4H7a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2z" />
              </svg>
              <input
                value={t}
                onChange={e => setT(e.target.value)}
                className="flex-1 bg-transparent text-text text-sm font-semibold outline-none min-w-0"
                placeholder="Document title"
              />
              <button
                onClick={() => printDocument(t, md)}
                className="text-xs font-semibold text-brand hover:underline shrink-0"
              >
                Download PDF
              </button>
              <button onClick={onClose} className="text-muted hover:text-text shrink-0" aria-label="Close">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {/* Editor + live preview */}
            <div className="flex-1 grid grid-cols-1 md:grid-cols-2 min-h-0 divide-y md:divide-y-0 md:divide-x divide-border">
              <textarea
                value={md}
                onChange={e => setMd(e.target.value)}
                spellCheck
                className="w-full h-full resize-none bg-bg text-text text-sm leading-relaxed p-5 outline-none font-mono min-h-0 overflow-y-auto"
                placeholder="Write in markdown…"
              />
              <div className="overflow-y-auto p-6 min-h-0 bg-panel">
                <div className="modus-doc" dangerouslySetInnerHTML={{ __html: markdownToHtml(md) }} />
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 px-5 py-3 border-t border-border">
              <button onClick={onClose} className="text-xs text-muted hover:text-text transition-colors">Close</button>
              <button
                onClick={() => onSave(t, md)}
                disabled={!dirty || saving}
                className="px-4 py-2 bg-brand text-white text-xs font-semibold rounded-lg hover:bg-brand/90 transition-colors disabled:opacity-40"
              >
                {saving ? 'Saving…' : dirty ? 'Save changes' : 'Saved'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
