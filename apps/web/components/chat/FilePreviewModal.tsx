'use client';

import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// Attachment chips used to show only a filename, so there was no way to tell a
// wrong file from the right one before sending. This shows the text MODUS will
// actually receive — the extracted text, not the original binary.

export default function FilePreviewModal({
  file, onClose, onRemove,
}: {
  file: { name: string; text: string } | null;
  onClose: () => void;
  onRemove?: () => void;
}) {
  useEffect(() => {
    if (!file) return;
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [file, onClose]);

  const chars = file?.text.length ?? 0;
  const words = file ? file.text.trim().split(/\s+/).filter(Boolean).length : 0;

  return (
    <AnimatePresence>
      {file && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onClick={onClose}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 6 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            onClick={e => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={`Preview of ${file.name}`}
            className="w-full max-w-2xl max-h-[80vh] flex flex-col bg-panel border border-border rounded-2xl shadow-2xl overflow-hidden"
          >
            <div className="flex items-start justify-between gap-3 px-4 py-3 border-b border-border/60">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-text truncate">{file.name}</p>
                <p className="text-[11px] text-muted mt-0.5">
                  {words.toLocaleString()} words · {chars.toLocaleString()} characters extracted
                </p>
              </div>
              <button
                onClick={onClose}
                aria-label="Close preview"
                className="shrink-0 p-1 rounded-md text-muted hover:text-text hover:bg-bg transition-colors"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
                  <path strokeLinecap="round" d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-3">
              <pre className="text-xs text-muted whitespace-pre-wrap break-words font-mono leading-relaxed">
                {file.text.trim() || 'No text could be extracted from this file.'}
              </pre>
            </div>

            <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-border/60">
              <p className="text-[11px] text-muted">This is the text MODUS will read.</p>
              <div className="flex gap-2">
                {onRemove && (
                  <button
                    onClick={() => { onRemove(); onClose(); }}
                    className="px-3 py-1.5 text-xs rounded-lg text-muted hover:text-red-400 border border-border hover:border-red-400/30 transition-colors"
                  >
                    Remove file
                  </button>
                )}
                <button
                  onClick={onClose}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg bg-brand text-white hover:bg-brand/90 transition-colors"
                >
                  Looks right
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
