'use client';

import Image from 'next/image';
import { FRONTIER_MODELS } from './foundingContent';

// A product-accurate mock of the MODUS chat with the model picker open — shows
// the multimodel feature (every frontier model in one chat) crisply, on-brand.
// Uses the real model names + logos so it's truthful, not a marketing render.
export default function ChatMock() {
  return (
    <div className="fj-device w-full max-w-[560px] mx-auto float overflow-hidden bg-[#0a0812]">
      {/* window chrome */}
      <div className="flex items-center gap-2 px-3.5 py-2.5 border-b border-white/8">
        <span className="flex gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-white/15" />
          <span className="w-2.5 h-2.5 rounded-full bg-white/15" />
          <span className="w-2.5 h-2.5 rounded-full bg-white/15" />
        </span>
        <span className="flex items-center gap-1.5 ml-1">
          <Image src="/logo-dark.png" alt="" width={16} height={12} className="object-contain" />
          <span className="text-[11px] font-semibold tracking-wide text-white/70">MODUS</span>
        </span>
      </div>

      <div className="flex min-h-[248px]">
        {/* conversation */}
        <div className="flex-1 min-w-0 p-3.5 flex flex-col gap-2.5">
          <div className="self-end max-w-[85%] rounded-2xl rounded-br-md bg-brand text-white px-3 py-1.5 text-[11px] leading-snug">
            Research this with Claude, then rewrite it in Gemini’s voice.
          </div>
          <div className="flex items-start gap-2">
            <span className="mt-0.5 w-5 h-5 shrink-0 rounded-md bg-brand/20 text-brand text-[8px] font-black flex items-center justify-center">M</span>
            <div className="max-w-[85%] rounded-2xl rounded-tl-md border border-white/10 bg-white/[0.03] px-3 py-2 text-[11px] leading-snug text-white/80">
              On it — routing the research to <span className="text-white font-medium">Claude Opus</span>, then the rewrite to <span className="text-white font-medium">Gemini 3.1 Pro</span>.
            </div>
          </div>
          <div className="mt-auto flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
            <span className="text-[11px] text-white/35 flex-1">Talk to MODUS…</span>
            <span className="text-[10px] font-medium text-violet-300 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-violet-400" /> Auto
            </span>
          </div>
        </div>

        {/* model picker — the multimodel feature */}
        <div className="w-[186px] shrink-0 border-l border-white/8 bg-black/30 p-2">
          <p className="text-[9px] uppercase tracking-widest text-white/30 px-1.5 pb-1.5">Model</p>
          <div className="flex items-center gap-2 rounded-lg bg-brand/15 ring-1 ring-brand/30 px-2 py-1.5 mb-1">
            <span className="w-4 h-4 rounded-md bg-violet-400/20 flex items-center justify-center text-[8px]">✦</span>
            <span className="flex-1 min-w-0">
              <span className="block text-[11px] font-semibold text-white leading-none">Auto</span>
              <span className="block text-[8.5px] text-white/45 leading-tight mt-0.5">Best model per task</span>
            </span>
            <svg viewBox="0 0 20 20" className="w-3 h-3 text-brand" fill="currentColor"><path d="M16.7 5.3a1 1 0 0 1 0 1.4l-7 7a1 1 0 0 1-1.4 0l-3.3-3.3a1 1 0 1 1 1.4-1.4l2.6 2.6 6.3-6.3a1 1 0 0 1 1.4 0Z" /></svg>
          </div>
          {FRONTIER_MODELS.map(m => (
            <div key={m.name} className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-white/5">
              <span className="w-4 h-4 flex items-center justify-center"><m.logo className="w-3.5 h-3.5" /></span>
              <span className="flex-1 min-w-0">
                <span className="block text-[11px] font-medium text-white/85 leading-none truncate">{m.name}</span>
                <span className="block text-[8.5px] text-white/40 leading-tight mt-0.5">{m.provider}</span>
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
