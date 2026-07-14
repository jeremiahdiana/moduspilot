'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * Interactive question card. MODUS asks a multiple-choice question before doing
 * work it would otherwise have to guess at; the answer comes back as a real user
 * turn, so the conversation reads normally and the model gets it as context.
 *
 * Sibling of DraftOptionsCard, not a replacement — that one is specialised to
 * email replies (its own chrome, copy, and prompt contract) and is live.
 *
 * Selection is component state only, so a reload replays a pristine card — same
 * as DraftOptionsCard. Acceptable because the answer is the very next message.
 */
interface Option {
  label: string;
  detail?: string;
}
interface OptionsPayload {
  question: string;
  /** Optional one-line framing shown under the question. */
  context?: string;
  /** Allow picking more than one. Default false. */
  multiple?: boolean;
  options: Option[];
  /** Show the "something else" free-text row. Default true. */
  allowCustom?: boolean;
  customPlaceholder?: string;
  submitLabel?: string;
}

const spring = { type: 'spring', stiffness: 320, damping: 26 } as const;

export default function OptionsCard({
  raw,
  onAppend,
}: {
  raw: string;
  onAppend: (text: string) => void;
}) {
  // Hooks must run unconditionally — parse/validate AFTER them, never before, or
  // a malformed block would change the hook count between renders (rules-of-hooks).
  const [selected, setSelected] = useState<number[]>([]);
  const [custom, setCustom] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [submittedLabel, setSubmittedLabel] = useState('');

  let parsed: OptionsPayload | null = null;
  try {
    const p = JSON.parse(raw) as OptionsPayload;
    // Require a real options array and a question — valid JSON missing either
    // (e.g. `{}`) would otherwise crash the render below.
    if (p && typeof p.question === 'string' && Array.isArray(p.options) && p.options.length > 0) {
      parsed = p;
    }
  } catch { /* malformed block — render nothing */ }
  if (!parsed) return null;
  const data = parsed; // non-null + const → safe inside the handlers/JSX below

  const multiple = data.multiple === true;
  const allowCustom = data.allowCustom !== false;
  // The custom row lives at the index just past the real options — same sentinel
  // trick DraftOptionsCard uses, so there's one selection space, not two.
  const customIndex = data.options.length;
  const isCustomSelected = selected.includes(customIndex);
  const canSubmit = selected.length > 0 && (!isCustomSelected || custom.trim().length > 0);

  function toggle(i: number) {
    setSelected(prev =>
      multiple
        ? (prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i])
        : [i],
    );
  }

  function describe(i: number): string {
    if (i === customIndex) return custom.trim();
    const opt = data.options[i];
    return opt.detail ? `${opt.label} — ${opt.detail}` : opt.label;
  }

  function handleSubmit() {
    if (!canSubmit) return;
    const ordered = [...selected].sort((a, b) => a - b);
    const answer = ordered.map(describe).join('; ');
    const shown = ordered
      .map(i => (i === customIndex ? custom.trim() : data.options[i].label))
      .join(', ');

    setSubmittedLabel(shown);
    setSubmitted(true);
    // Sentinel phrasing the system prompt tells the model to expect, mirroring
    // how draft_options round-trips its answer.
    onAppend(`Answering "${data.question}": ${answer}`);
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
          Going with: <span className="text-text font-medium">{submittedLabel}</span>
        </span>
      </motion.div>
    );
  }

  const rows: { key: number; label: string; detail?: string }[] = [
    ...data.options.map((o, i) => ({ key: i, label: o.label, detail: o.detail })),
    ...(allowCustom ? [{ key: customIndex, label: 'Something else', detail: undefined }] : []),
  ];

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
          <span className="text-[10px] font-bold text-brand uppercase tracking-widest">
            {multiple ? 'Pick any that apply' : 'Quick question'}
          </span>
        </div>
        <p className="text-sm text-text font-medium pl-3.5 leading-snug">{data.question}</p>
        {data.context && (
          <p className="text-xs text-muted pl-3.5 mt-1 leading-relaxed">{data.context}</p>
        )}
      </div>

      {/* Options */}
      <div className="p-3 space-y-2">
        {rows.map(row => {
          const isCustomRow = row.key === customIndex;
          const on = selected.includes(row.key);
          return (
            <motion.div
              key={row.key}
              onClick={() => toggle(row.key)}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              transition={spring}
              className={`w-full text-left px-3.5 py-3 rounded-xl border transition-all duration-150 cursor-pointer ${
                on
                  ? 'border-brand/50 bg-brand/8 shadow-[0_0_0_1px_rgba(124,58,237,0.15)]'
                  : 'border-border/60 bg-bg/50 hover:border-brand/25 hover:bg-brand/4'
              }`}
            >
              <div className="flex items-start gap-2.5">
                {/* Selection indicator — square for multi-select, round for single */}
                <div
                  className={`mt-0.5 w-3.5 h-3.5 border-2 shrink-0 flex items-center justify-center transition-all ${
                    multiple ? 'rounded-[4px]' : 'rounded-full'
                  } ${on ? 'border-brand' : 'border-border'}`}
                >
                  <AnimatePresence>
                    {on && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        exit={{ scale: 0 }}
                        transition={{ type: 'spring', stiffness: 500, damping: 28 }}
                        className={`bg-brand ${multiple ? 'w-1.5 h-1.5 rounded-[1px]' : 'w-1.5 h-1.5 rounded-full'}`}
                      />
                    )}
                  </AnimatePresence>
                </div>
                <div className="flex-1 min-w-0">
                  <p
                    className={`text-sm font-semibold leading-none transition-colors ${
                      on ? 'text-text' : 'text-text/80'
                    } ${row.detail || isCustomRow ? 'mb-1' : ''}`}
                  >
                    {row.label}
                  </p>
                  {row.detail && <p className="text-xs text-muted leading-relaxed">{row.detail}</p>}
                  {isCustomRow && (
                    <>
                      <AnimatePresence>
                        {on && (
                          <motion.textarea
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            autoFocus
                            value={custom}
                            onChange={e => setCustom(e.target.value)}
                            onClick={e => e.stopPropagation()}
                            placeholder={data.customPlaceholder ?? 'Tell MODUS what you want instead…'}
                            rows={2}
                            className="w-full bg-bg border border-border rounded-lg px-2.5 py-2 text-xs text-text outline-none focus:border-brand transition-colors resize-none overflow-hidden"
                          />
                        )}
                      </AnimatePresence>
                      {!on && <p className="text-xs text-muted">Answer in your own words</p>}
                    </>
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Action */}
      <div className="px-3 pb-3">
        <motion.button
          onClick={handleSubmit}
          disabled={!canSubmit}
          whileHover={canSubmit ? { scale: 1.02, y: -1 } : {}}
          whileTap={canSubmit ? { scale: 0.98 } : {}}
          transition={spring}
          className="w-full py-2.5 rounded-xl text-sm font-semibold text-white btn-primary disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
        >
          {data.submitLabel ?? 'Continue'} →
        </motion.button>
      </div>
    </motion.div>
  );
}
