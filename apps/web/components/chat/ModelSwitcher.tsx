'use client';

import { useEffect, useRef, useState } from 'react';
import { PLATFORM_MODELS, effectivePlan, modelName } from '@/lib/models';
import { logoForModel } from '@/components/marketing/ModelLogos';

interface Props {
  /** 'auto' | a model id | 'default' */
  value: string;
  onChange: (value: string) => void;
  plan: string;
}

function currentLabel(value: string): string {
  if (value === 'auto' || value === 'default' || !value) return 'Auto';
  return modelName(value);
}

export default function ModelSwitcher({ value, onChange, plan }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const ep = effectivePlan(plan);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  function select(v: string) {
    onChange(v);
    setOpen(false);
  }

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1 text-xs text-muted hover:text-text border border-border rounded-lg px-2 py-1 transition-colors max-w-[9rem]"
      >
        {value === 'auto' || !value ? (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-3.5 h-3.5 text-brand shrink-0">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16 2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3Z" />
          </svg>
        ) : (
          (() => { const L = logoForModel(value); return <L className="w-3.5 h-3.5 shrink-0" />; })()
        )}
        <span className="truncate font-medium">{currentLabel(value)}</span>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3 h-3 shrink-0">
          <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div className="absolute bottom-full left-0 mb-2 w-60 bg-panel border border-border rounded-xl shadow-lg py-1.5 z-50 max-h-80 overflow-y-auto">
          <button
            type="button"
            onClick={() => select('auto')}
            className={`w-full text-left px-3 py-2 flex items-start gap-2.5 hover:bg-brand/5 transition-colors ${value === 'auto' || !value ? 'bg-brand/5' : ''}`}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-4 h-4 text-brand shrink-0 mt-0.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16 2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3Z" />
            </svg>
            <div className="min-w-0">
              <p className={`text-sm font-medium ${value === 'auto' || !value ? 'text-brand' : 'text-text'}`}>Auto</p>
              <p className="text-xs text-muted leading-snug">MODUS picks the best model for each task</p>
            </div>
          </button>

          <div className="my-1 border-t border-border/60" />

          {PLATFORM_MODELS.map(m => {
            const locked = !m.plans.includes(ep);
            const selected = value === m.id;
            const Logo = logoForModel(m.id);
            return (
              <button
                key={m.id}
                type="button"
                disabled={locked}
                onClick={() => select(m.id)}
                className={`w-full text-left px-3 py-2 flex items-center justify-between gap-2 transition-colors ${
                  locked ? 'opacity-40 cursor-not-allowed' : 'hover:bg-brand/5'
                } ${selected ? 'bg-brand/5' : ''}`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Logo className="w-4 h-4 shrink-0" />
                  <div className="min-w-0">
                    <p className={`text-sm font-medium truncate ${selected ? 'text-brand' : 'text-text'}`}>{m.name}</p>
                    <p className="text-xs text-muted truncate">{m.provider}</p>
                  </div>
                </div>
                {locked && (
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-muted/10 text-muted shrink-0">
                    {m.plans.includes('modus') ? 'MODUS+' : 'PILOT'}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
