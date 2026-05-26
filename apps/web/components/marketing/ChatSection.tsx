'use client';

import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';

function ApprovalCardMockup() {
  const [typed, setTyped] = useState('');
  const message = 'Draft a reply to Marcus, block tomorrow morning, move my 3 PM to Friday.';

  useEffect(() => {
    let i = 0;
    const interval = setInterval(() => {
      setTyped(message.slice(0, i));
      i++;
      if (i > message.length) {
        setTimeout(() => { i = 0; setTyped(''); }, 3000);
      }
    }, 40);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="bg-panel border border-border rounded-2xl overflow-hidden shadow-2xl">
      <div className="px-4 py-3 border-b border-border flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-brand animate-pulse" />
        <span className="text-xs text-muted font-medium">MODUS Chat</span>
      </div>

      <div className="p-4 space-y-4 min-h-[280px]">
        <div className="flex justify-end">
          <div className="bg-brand/20 border border-brand/20 rounded-xl rounded-tr-sm px-4 py-2.5 max-w-[85%]">
            <p className="text-sm text-text">
              {typed}
              <span className="inline-block w-0.5 h-4 bg-brand ml-0.5 animate-pulse align-middle" />
            </p>
          </div>
        </div>

        <div className="flex gap-2.5">
          <div className="w-7 h-7 rounded-full bg-brand/20 border border-brand/30 flex items-center justify-center text-xs font-black text-brand shrink-0 mt-0.5">M</div>
          <div className="flex-1 space-y-3">
            <div className="bg-bg border border-border rounded-xl rounded-tl-sm px-4 py-2.5">
              <p className="text-xs text-muted mb-1">Reviewing…</p>
              <p className="text-sm text-text">Three actions queued. Approval card ready.</p>
            </div>

            <div className="bg-bg border border-brand/30 rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-brand" />
                <span className="text-xs font-semibold text-brand uppercase tracking-wider">Approval Required</span>
              </div>
              <div className="space-y-2">
                {[
                  'Draft reply to Marcus re: Q3 roadmap',
                  'Block 9–12am tomorrow as Deep Work',
                  'Move 3 PM → Friday 3 PM',
                ].map((action, i) => (
                  <div key={i} className="flex items-center gap-2.5 text-sm text-muted">
                    <div className="w-4 h-4 rounded border border-border flex items-center justify-center">
                      <div className="w-2 h-2 rounded-sm bg-brand/60" />
                    </div>
                    {action}
                  </div>
                ))}
              </div>
              <div className="flex gap-2 pt-1">
                <button className="flex-1 py-1.5 bg-brand text-white text-xs font-semibold rounded-lg">Approve All</button>
                <button className="flex-1 py-1.5 border border-border text-muted text-xs rounded-lg">Edit</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 py-3 border-t border-border">
        <div className="bg-bg border border-border rounded-xl px-3 py-2 text-xs text-muted/40">
          Message MODUS…
        </div>
      </div>
    </div>
  );
}

export default function ChatSection() {
  return (
    <section className="py-28 px-6 overflow-hidden">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.7, ease: 'easeOut' }}
          >
            <h2 className="text-4xl md:text-5xl font-black text-text mb-6 leading-tight">
              One Message.<br />Your Entire Life.
            </h2>
            <p className="text-muted text-base leading-relaxed mb-6">
              The chat is not a feature — it's the operating surface MODUS is built on.
              From a single message you can connect integrations, execute cross-app actions,
              surface a decision you made three months ago, or restructure your goals entirely.
            </p>
            <div className="bg-panel border border-border rounded-xl px-4 py-3 mb-8">
              <p className="text-sm text-muted italic">
                "Draft a reply to Marcus, block tomorrow morning, move my 3 PM to Friday."
                <span className="text-text not-italic"> One message. Three actions. One approval card.</span>
              </p>
            </div>
            <div className="flex items-center gap-6 text-sm">
              <div className="flex items-center gap-1.5 text-emerald-400">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                <span className="text-text font-medium">Web App</span>
                <span className="text-[10px] font-bold bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full">Live</span>
              </div>
              <span className="text-muted text-sm">iOS · Mac <span className="text-[10px] text-muted/50">Coming Soon</span></span>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.7, ease: 'easeOut' }}
          >
            <ApprovalCardMockup />
          </motion.div>
        </div>
      </div>
    </section>
  );
}
