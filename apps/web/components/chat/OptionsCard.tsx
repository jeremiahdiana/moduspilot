'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * Interactive question card. MODUS asks for what it needs before doing work it
 * would otherwise guess at; the answer comes back as a real user turn, so the
 * thread reads normally and the model gets the choice as ordinary context.
 *
 * Holds MULTIPLE questions in one card — asking "what topic?" and then "how
 * long?" as two cards in a row is two round trips and two waits for something
 * the model knew it needed up front.
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
interface Question {
  question: string;
  /** Short chip above the question, e.g. "Topic" / "Length". */
  header?: string;
  /** Optional one-line framing. */
  context?: string;
  /** Allow picking more than one. Default false. */
  multiple?: boolean;
  options: Option[];
  /** Show the "something else" free-text row. Default true. */
  allowCustom?: boolean;
  customPlaceholder?: string;
}
interface OptionsPayload {
  /** Multi-question form. */
  questions?: Question[];
  /** Single-question shorthand — the original shape, still supported. */
  question?: string;
  context?: string;
  multiple?: boolean;
  options?: Option[];
  allowCustom?: boolean;
  customPlaceholder?: string;
  submitLabel?: string;
}

const spring = { type: 'spring', stiffness: 320, damping: 26 } as const;
const MAX_QUESTIONS = 4;

/** Accept both the multi-question form and the original single-question one. */
function normalize(p: OptionsPayload): Question[] | null {
  const raw: Question[] = Array.isArray(p.questions)
    ? p.questions
    : (typeof p.question === 'string' && Array.isArray(p.options))
      ? [{ question: p.question, context: p.context, multiple: p.multiple, options: p.options, allowCustom: p.allowCustom, customPlaceholder: p.customPlaceholder }]
      : [];
  const valid = raw.filter(q =>
    q && typeof q.question === 'string' && q.question.trim().length > 0 &&
    Array.isArray(q.options) && q.options.length > 0 &&
    q.options.every(o => o && typeof o.label === 'string'),
  );
  return valid.length > 0 ? valid.slice(0, MAX_QUESTIONS) : null;
}

export default function OptionsCard({
  raw,
  onAppend,
}: {
  raw: string;
  onAppend: (text: string) => void;
}) {
  // Hooks must run unconditionally — parse/validate AFTER them, never before, or
  // a malformed block would change the hook count between renders (rules-of-hooks).
  // Keyed by question index so each question owns its own selection.
  const [selected, setSelected] = useState<Record<number, number[]>>({});
  const [custom, setCustom] = useState<Record<number, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [submittedLabel, setSubmittedLabel] = useState('');

  let parsed: OptionsPayload | null = null;
  try { parsed = JSON.parse(raw) as OptionsPayload; } catch { /* malformed — render nothing */ }
  const questions = parsed ? normalize(parsed) : null;
  if (!questions) return null;
  const qs = questions; // non-null + const → safe in handlers/JSX below

  // The custom row sits at the index just past the real options — one selection
  // space per question rather than two competing ones.
  const customIndexOf = (qi: number) => qs[qi].options.length;
  const picked = (qi: number) => selected[qi] ?? [];
  const isCustomOn = (qi: number) => picked(qi).includes(customIndexOf(qi));
  const answered = (qi: number) =>
    picked(qi).length > 0 && (!isCustomOn(qi) || (custom[qi] ?? '').trim().length > 0);
  // Every question must be answered — a half-filled card would send the model a
  // partial answer and it would just ask again.
  const canSubmit = qs.every((_, qi) => answered(qi));

  function toggle(qi: number, oi: number) {
    setSelected(prev => {
      const cur = prev[qi] ?? [];
      const next = qs[qi].multiple === true
        ? (cur.includes(oi) ? cur.filter(x => x !== oi) : [...cur, oi])
        : [oi];
      return { ...prev, [qi]: next };
    });
  }

  function describe(qi: number, oi: number): string {
    if (oi === customIndexOf(qi)) return (custom[qi] ?? '').trim();
    const opt = qs[qi].options[oi];
    return opt.detail ? `${opt.label} — ${opt.detail}` : opt.label;
  }
  function shortLabel(qi: number, oi: number): string {
    return oi === customIndexOf(qi) ? (custom[qi] ?? '').trim() : qs[qi].options[oi].label;
  }

  function handleSubmit() {
    if (!canSubmit) return;
    // One "Answering …" line per question — the same sentinel the system prompt
    // tells the model to expect, repeated rather than reinvented.
    const lines = qs.map((q, qi) => {
      const ordered = [...picked(qi)].sort((a, b) => a - b);
      return `Answering "${q.question}": ${ordered.map(oi => describe(qi, oi)).join('; ')}`;
    });
    setSubmittedLabel(
      qs.map((_, qi) => [...picked(qi)].sort((a, b) => a - b).map(oi => shortLabel(qi, oi)).join(', ')).join(' · '),
    );
    setSubmitted(true);
    onAppend(lines.join('\n'));
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

  return (
    <motion.div
      initial={{ opacity: 0, y: 14, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={spring}
      className="border border-brand/20 bg-panel rounded-xl overflow-hidden shadow-[0_0_24px_rgba(124,58,237,0.06)]"
    >
      {qs.map((q, qi) => {
        const customIndex = customIndexOf(qi);
        const rows: { key: number; label: string; detail?: string }[] = [
          ...q.options.map((o, i) => ({ key: i, label: o.label, detail: o.detail })),
          ...(q.allowCustom !== false ? [{ key: customIndex, label: 'Something else', detail: undefined }] : []),
        ];
        return (
          <div key={qi} className={qi > 0 ? 'border-t border-border/60' : ''}>
            {/* Question header */}
            <div className="px-4 pt-4 pb-3">
              <div className="flex items-center gap-2 mb-1">
                <span className="w-1.5 h-1.5 rounded-full bg-brand shrink-0" />
                <span className="text-[10px] font-bold text-brand uppercase tracking-widest">
                  {q.header ?? (q.multiple ? 'Pick any that apply' : qs.length > 1 ? `Question ${qi + 1} of ${qs.length}` : 'Quick question')}
                </span>
                {qs.length > 1 && (
                  <span className={`ml-auto text-[10px] font-medium transition-colors ${answered(qi) ? 'text-brand' : 'text-muted/50'}`}>
                    {answered(qi) ? 'answered' : 'needs an answer'}
                  </span>
                )}
              </div>
              <p className="text-sm text-text font-medium pl-3.5 leading-snug">{q.question}</p>
              {q.context && <p className="text-xs text-muted pl-3.5 mt-1 leading-relaxed">{q.context}</p>}
            </div>

            {/* Options */}
            <div className="px-3 pb-3 space-y-2">
              {rows.map(row => {
                const isCustomRow = row.key === customIndex;
                const on = picked(qi).includes(row.key);
                return (
                  <motion.div
                    key={row.key}
                    onClick={() => toggle(qi, row.key)}
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
                      <div
                        className={`mt-0.5 w-3.5 h-3.5 border-2 shrink-0 flex items-center justify-center transition-all ${
                          q.multiple ? 'rounded-[4px]' : 'rounded-full'
                        } ${on ? 'border-brand' : 'border-border'}`}
                      >
                        <AnimatePresence>
                          {on && (
                            <motion.div
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              exit={{ scale: 0 }}
                              transition={{ type: 'spring', stiffness: 500, damping: 28 }}
                              className={`bg-brand w-1.5 h-1.5 ${q.multiple ? 'rounded-[1px]' : 'rounded-full'}`}
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
                                  value={custom[qi] ?? ''}
                                  onChange={e => setCustom(prev => ({ ...prev, [qi]: e.target.value }))}
                                  onClick={e => e.stopPropagation()}
                                  placeholder={q.customPlaceholder ?? 'Tell MODUS what you want instead…'}
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
          </div>
        );
      })}

      {/* Action */}
      <div className="px-3 pb-3 pt-0">
        <motion.button
          onClick={handleSubmit}
          disabled={!canSubmit}
          whileHover={canSubmit ? { scale: 1.02, y: -1 } : {}}
          whileTap={canSubmit ? { scale: 0.98 } : {}}
          transition={spring}
          className="w-full py-2.5 rounded-xl text-sm font-semibold text-white btn-primary disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
        >
          {parsed?.submitLabel ?? 'Continue'} →
        </motion.button>
      </div>
    </motion.div>
  );
}
