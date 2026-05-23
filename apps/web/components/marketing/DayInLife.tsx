'use client';

import { motion } from 'framer-motion';

const EVENTS = [
  {
    time: '7:00 AM',
    title: 'Briefing hits your browser.',
    desc: 'Energy check-in. Top 3 priorities. Overdue tasks. One habit streak at risk. All before you open your inbox.',
    tag: 'Morning Briefing',
    tagColor: 'bg-violet-500/10 text-violet-400 border-violet-500/20',
  },
  {
    time: '8:45 AM',
    title: 'Deep work block defended.',
    desc: 'Two meeting requests came in for 9 AM. MODUS queued a decline with a reschedule suggestion. You approved in one tap.',
    tag: 'Approval Card',
    tagColor: 'bg-brand/10 text-brand border-brand/20',
  },
  {
    time: '11:30 AM',
    title: '4 emails triaged.',
    desc: '2 replies drafted and waiting for your sign-off. 1 flagged urgent. 1 archived. You spent 90 seconds on email.',
    tag: 'Gmail Triage',
    tagColor: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  },
  {
    time: '2:00 PM',
    title: 'Pattern flagged.',
    desc: 'You\'ve deferred "Review Q2 goals" three days in a row. MODUS surfaced it — neutral, no guilt. Just data.',
    tag: 'Pattern Recognition',
    tagColor: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  },
  {
    time: '5:30 PM',
    title: 'Day review ready.',
    desc: '3 of 4 priorities done. Streak: 14 days. One habit at risk tonight. Tomorrow\'s briefing is already being drafted.',
    tag: 'End of Day',
    tagColor: 'bg-brand/10 text-brand border-brand/20',
  },
];

export default function DayInLife() {
  return (
    <section className="py-32 px-6 relative overflow-hidden">
      <div className="absolute inset-0 bg-panel/40" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_30%_50%,rgba(124,58,237,0.18),transparent)] dark:bg-[radial-gradient(ellipse_70%_50%_at_30%_50%,rgba(124,58,237,0.06),transparent)]" />

      <div className="max-w-5xl mx-auto relative">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <p className="text-xs font-bold text-brand uppercase tracking-widest mb-3">A Day With MODUS</p>
          <h2 className="text-4xl md:text-5xl font-black text-text mb-4">
            From Wakeup to Wrap-up.
          </h2>
          <p className="text-muted text-lg max-w-xl mx-auto">
            This is what your day looks like when you stop managing yourself.
          </p>
        </motion.div>

        <div className="relative">
          {/* Vertical line */}
          <div className="absolute left-[88px] md:left-[108px] top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-brand/30 to-transparent hidden sm:block" />

          <div className="space-y-0">
            {EVENTS.map((event, i) => (
              <motion.div
                key={event.time}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: '-60px' }}
                transition={{ duration: 0.5, delay: i * 0.08, ease: 'easeOut' }}
                className="flex gap-6 md:gap-10 relative pb-10 last:pb-0"
              >
                {/* Time + dot */}
                <div className="flex flex-col items-end shrink-0 w-16 md:w-24 pt-1">
                  <span className="text-xs font-bold text-brand/70 tabular-nums whitespace-nowrap">{event.time}</span>
                  <div className="relative mt-2 hidden sm:block">
                    <div className="w-2.5 h-2.5 rounded-full bg-brand/40 border border-brand/60 ring-4 ring-brand/10 translate-x-[calc(50%+0.5px)]" />
                  </div>
                </div>

                {/* Content */}
                <div className="flex-1 bg-panel border border-border/60 rounded-2xl p-5 group hover:border-brand/30 transition-colors">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <h3 className="text-base font-bold text-text leading-snug">{event.title}</h3>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${event.tagColor}`}>
                      {event.tag}
                    </span>
                  </div>
                  <p className="text-sm text-muted leading-relaxed">{event.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
