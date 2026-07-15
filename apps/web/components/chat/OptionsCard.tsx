'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * Interactive question card. MODUS asks for what it needs before doing work it
 * would otherwise guess at; the answer comes back as a real user turn, so the
 * thread reads normally and the model gets the choice as ordinary context.
 *
 * Presents as a STEPPER: one question on screen at a time with a "1 of 2"
 * counter, the next sliding in once the current one is answered. The model still
 * sends every question up front in one block — batching is what stops it firing
 * a second card a round trip later — but showing all of them stacked turns a
 * quick tap into a form to fill in. One decision at a time.
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
/** Long enough to see the row light up, short enough not to feel like a wait. */
const ADVANCE_MS = 260;

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
  const [step, setStep] = useState(0);
  const [selected, setSelected] = useState<Record<number, number[]>>({});
  const [custom, setCustom] = useState<Record<number, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [submittedLabel, setSubmittedLabel] = useState('');

  let parsed: OptionsPayload | null = null;
  try { parsed = JSON.parse(raw) as OptionsPayload; } catch { /* malformed — render nothing */ }
  const questions = parsed ? normalize(parsed) : null;
  if (!questions) return null;
  const qs = questions; // non-null + const → safe in handlers/JSX below

  const qi = Math.min(step, qs.length - 1);
  const q = qs[qi];
  const isLast = qi === qs.length - 1;
  // The custom row sits at the index just past the real options — one selection
  // space per question rather than two competing ones.
  const customIndex = q.options.length;
  const picked = (i: number) => selected[i] ?? [];
  const isCustomOn = picked(qi).includes(customIndex);
  const answered = (i: number) =>
    picked(i).length > 0 && (!picked(i).includes(qs[i].options.length) || (custom[i] ?? '').trim().length > 0);

  function describe(i: number, oi: number): string {
    if (oi === qs[i].options.length) return (custom[i] ?? '').trim();
    const opt = qs[i].options[oi];
    return opt.detail ? `${opt.label} — ${opt.detail}` : opt.label;
  }
  function shortLabel(i: number, oi: number): string {
    return oi === qs[i].options.length ? (custom[i] ?? '').trim() : qs[i].options[oi].label;
  }

  function finish(finalSelected: Record<number, number[]>) {
    // One "Answering …" line per question — the same sentinel the system prompt
    // tells the model to expect, repeated rather than reinvented.
    const lines = qs.map((qq, i) => {
      const ordered = [...(finalSelected[i] ?? [])].sort((a, b) => a - b);
      return `Answering "${qq.question}": ${ordered.map(oi => describe(i, oi)).join('; ')}`;
    });
    setSubmittedLabel(
      qs.map((_, i) => [...(finalSelected[i] ?? [])].sort((a, b) => a - b).map(oi => shortLabel(i, oi)).join(', ')).join(' · '),
    );
    setSubmitted(true);
    onAppend(lines.join('\n'));
  }

  function choose(oi: number) {
    const isCustomRow = oi === customIndex;
    const next = q.multiple === true
      ? (picked(qi).includes(oi) ? picked(qi).filter(x => x !== oi) : [...picked(qi), oi])
      : [oi];
    const updated = { ...selected, [qi]: next };
    setSelected(updated);

    // Multi-select and free text both need a confirm step — the user isn't done
    // clicking yet. A single option, though, IS the answer: advance for them.
    if (q.multiple === true || isCustomRow) return;
    setTimeout(() => {
      if (isLast) finish(updated);
      else setStep(s => s + 1);
    }, ADVANCE_MS);
  }

  /** Confirm button: only needed for multi-select / free-text / a re-picked last step. */
  const canConfirm = picked(qi).length > 0 && (!isCustomOn || (custom[qi] ?? '').trim().length > 0);
  const needsConfirm = q.multiple === true || isCustomOn;

  function confirm() {
    if (!canConfirm) return;
    if (isLast) finish(selected);
    else setStep(s => s + 1);
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
    ...q.options.map((o, i) => ({ key: i, label: o.label, detail: o.detail })),
    ...(q.allowCustom !== false ? [{ key: customIndex, label: 'Something else', detail: undefined }] : []),
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 14, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={spring}
      className="border border-brand/20 bg-panel rounded-xl overflow-hidden shadow-[0_0_24px_rgba(124,58,237,0.06)]"
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={qi}
          initial={{ opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -12 }}
          transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
        >
          {/* Question */}
          <div className="px-4 pt-4 pb-3">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-brand shrink-0" />
              <span className="text-[10px] font-bold text-brand uppercase tracking-widest">
                {q.header ?? (q.multiple ? 'Pick any that apply' : 'Quick question')}
              </span>
              {qs.length > 1 && (
                <span className="ml-auto text-[10px] font-medium text-muted/60 tabular-nums">
                  {qi + 1} of {qs.length}
                </span>
              )}
            </div>
            <p className="text-sm text-text font-medium pl-3.5 leading-snug">{q.question}</p>
            {q.context && <p className="text-xs text-muted pl-3.5 mt-1 leading-relaxed">{q.context}</p>}

            {/* Progress — only worth drawing when there's more than one step */}
            {qs.length > 1 && (
              <div className="flex gap-1 mt-3 pl-3.5">
                {qs.map((_, i) => (
                  <span
                    key={i}
                    className={`h-0.5 flex-1 rounded-full transition-colors duration-300 ${
                      i < qi ? 'bg-brand/60' : i === qi ? 'bg-brand' : 'bg-border'
                    }`}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Options */}
          <div className="px-3 pb-3 space-y-2">
            {rows.map((row, n) => {
              const isCustomRow = row.key === customIndex;
              const on = picked(qi).includes(row.key);
              return (
                <motion.div
                  key={row.key}
                  onClick={() => choose(row.key)}
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
                    {/* Numbered for the real options; the free-text row isn't a numbered choice */}
                    <div
                      className={`mt-px w-4 h-4 shrink-0 flex items-center justify-center text-[10px] font-bold transition-all ${
                        q.multiple ? 'rounded-[4px] border-2' : 'rounded-full border-2'
                      } ${on ? 'border-brand bg-brand text-white' : 'border-border text-muted/70'}`}
                    >
                      {isCustomRow ? (on ? '✓' : '+') : on ? '✓' : n + 1}
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
        </motion.div>
      </AnimatePresence>

      {/* Footer — Back is always available so a mis-tap isn't a dead end. The
          confirm button only appears when a tap alone can't finish the step. */}
      {(qi > 0 || needsConfirm) && (
        <div className="px-3 pb-3 flex items-center gap-2">
          {qi > 0 && (
            <button
              onClick={() => setStep(s => Math.max(0, s - 1))}
              className="px-3 py-2.5 rounded-xl text-xs font-medium text-muted hover:text-text transition-colors shrink-0"
            >
              ← Back
            </button>
          )}
          {needsConfirm && (
            <motion.button
              onClick={confirm}
              disabled={!canConfirm}
              whileHover={canConfirm ? { scale: 1.02, y: -1 } : {}}
              whileTap={canConfirm ? { scale: 0.98 } : {}}
              transition={spring}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white btn-primary disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
            >
              {isLast ? (parsed?.submitLabel ?? 'Continue') : 'Next'} →
            </motion.button>
          )}
        </div>
      )}
    </motion.div>
  );
}
