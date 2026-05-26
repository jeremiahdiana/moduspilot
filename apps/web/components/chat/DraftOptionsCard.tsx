'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface DraftOption {
  label: string;
  detail: string;
}

interface DraftOptionsPayload {
  from?: string;
  subject?: string;
  preview?: string;
  options: DraftOption[];
}

const spring = { type: 'spring', stiffness: 320, damping: 26 } as const;

export default function DraftOptionsCard({
  raw,
  onAppend,
}: {
  raw: string;
  onAppend: (text: string) => void;
}) {
  let data: DraftOptionsPayload;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }

  const [selected, setSelected] = useState<number | null>(null);
  const [custom, setCustom] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [submittedLabel, setSubmittedLabel] = useState('');

  const isCustomSelected = selected === data.options.length;
  const canSubmit = selected !== null && (!isCustomSelected || custom.trim().length > 0);

  function handleGenerate() {
    if (!canSubmit) return;

    let direction: string;
    if (isCustomSelected) {
      direction = custom.trim();
    } else {
      const opt = data.options[selected!];
      direction = `${opt.label} — ${opt.detail}`;
    }

    const label = isCustomSelected ? custom.trim() : data.options[selected!].label;
    setSubmittedLabel(label);
    setSubmitted(true);

    const contextLine = data.from ? ` to ${data.from}` : '';
    onAppend(
      `Draft my reply${contextLine} using this direction: ${direction}. Write the full email body now.`
    );
  }

  if (submitted) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={spring}
        className="border border-brand/20 bg-brand/5 rounded-xl px-4 py-3 flex items-center gap-2.5"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-brand animate-pulse shrink-0" />
        <span className="text-sm text-muted">
          Drafting with: <span className="text-text font-medium">{submittedLabel}</span>
        </span>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 14, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={spring}
      className="border border-brand/20 bg-panel rounded-xl overflow-hidden shadow-[0_0_24px_rgba(124,58,237,0.06)]"
    >
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-border/60">
        <div className="flex items-center gap-2 mb-1">
          <span className="w-1.5 h-1.5 rounded-full bg-brand" />
          <span className="text-[10px] font-bold text-brand uppercase tracking-widest">How do you want to reply?</span>
        </div>
        {(data.from || data.subject) && (
          <p className="text-xs text-muted pl-3.5">
            {data.from && <span className="text-text/70 font-medium">{data.from}</span>}
            {data.from && data.subject && ' · '}
            {data.subject && <span>{data.subject}</span>}
          </p>
        )}
        {data.preview && (
          <p className="text-[11px] text-muted/60 pl-3.5 mt-1 leading-relaxed line-clamp-2 italic">
            "{data.preview}"
          </p>
        )}
      </div>

      {/* Options */}
      <div className="p-3 space-y-2">
        {data.options.map((opt, i) => (
          <motion.button
            key={i}
            onClick={() => setSelected(i)}
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            transition={spring}
            className={`w-full text-left px-3.5 py-3 rounded-xl border transition-all duration-150 ${
              selected === i
                ? 'border-brand/50 bg-brand/8 shadow-[0_0_0_1px_rgba(124,58,237,0.15)]'
                : 'border-border/60 bg-bg/50 hover:border-brand/25 hover:bg-brand/4'
            }`}
          >
            <div className="flex items-start gap-2.5">
              {/* Radio dot */}
              <div className={`mt-0.5 w-3.5 h-3.5 rounded-full border-2 shrink-0 flex items-center justify-center transition-all ${
                selected === i ? 'border-brand' : 'border-border'
              }`}>
                <AnimatePresence>
                  {selected === i && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      exit={{ scale: 0 }}
                      transition={{ type: 'spring', stiffness: 500, damping: 28 }}
                      className="w-1.5 h-1.5 rounded-full bg-brand"
                    />
                  )}
                </AnimatePresence>
              </div>
              <div className="min-w-0">
                <p className={`text-sm font-semibold leading-none mb-0.5 transition-colors ${
                  selected === i ? 'text-text' : 'text-text/80'
                }`}>
                  {opt.label}
                </p>
                <p className="text-xs text-muted leading-relaxed">{opt.detail}</p>
              </div>
            </div>
          </motion.button>
        ))}

        {/* Custom option */}
        <motion.div
          onClick={() => setSelected(data.options.length)}
          whileHover={{ scale: 1.01 }}
          transition={spring}
          className={`w-full text-left px-3.5 py-3 rounded-xl border transition-all duration-150 cursor-pointer ${
            isCustomSelected
              ? 'border-brand/50 bg-brand/8 shadow-[0_0_0_1px_rgba(124,58,237,0.15)]'
              : 'border-border/60 bg-bg/50 hover:border-brand/25 hover:bg-brand/4'
          }`}
        >
          <div className="flex items-start gap-2.5">
            <div className={`mt-0.5 w-3.5 h-3.5 rounded-full border-2 shrink-0 flex items-center justify-center transition-all ${
              isCustomSelected ? 'border-brand' : 'border-border'
            }`}>
              <AnimatePresence>
                {isCustomSelected && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 28 }}
                    className="w-1.5 h-1.5 rounded-full bg-brand"
                  />
                )}
              </AnimatePresence>
            </div>
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-semibold leading-none mb-1.5 transition-colors ${
                isCustomSelected ? 'text-text' : 'text-text/80'
              }`}>
                Specify your own direction
              </p>
              <AnimatePresence>
                {isCustomSelected && (
                  <motion.textarea
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    autoFocus
                    value={custom}
                    onChange={e => setCustom(e.target.value)}
                    onClick={e => e.stopPropagation()}
                    placeholder="e.g. Warm but professional, mention the Austin meeting..."
                    rows={2}
                    className="w-full bg-bg border border-border rounded-lg px-2.5 py-2 text-xs text-text outline-none focus:border-brand transition-colors resize-none overflow-hidden"
                  />
                )}
              </AnimatePresence>
              {!isCustomSelected && (
                <p className="text-xs text-muted">Write your own tone or instructions</p>
              )}
            </div>
          </div>
        </motion.div>
      </div>

      {/* Action */}
      <div className="px-3 pb-3">
        <motion.button
          onClick={handleGenerate}
          disabled={!canSubmit}
          whileHover={canSubmit ? { scale: 1.02, y: -1 } : {}}
          whileTap={canSubmit ? { scale: 0.98 } : {}}
          transition={spring}
          className="w-full py-2.5 rounded-xl text-sm font-semibold text-white btn-primary disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
        >
          Generate Draft →
        </motion.button>
      </div>
    </motion.div>
  );
}
