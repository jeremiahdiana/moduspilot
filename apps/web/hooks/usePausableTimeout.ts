import { useEffect, useRef } from 'react';

/**
 * setTimeout that pauses and resumes on the REMAINING time.
 *
 * Written for the auto-advancing tab strips on /features (CreationsSection and
 * the scenarios player). Both pair this with a CSS `tab-fill` bar frozen via
 * animation-play-state, which resumes exactly where it stopped.
 *
 * The naive version — `if (paused) return; setTimeout(fn, full)` — starts a
 * fresh FULL delay on every unpause, so the frozen bar sails to 100% and the tab
 * then sits there for seconds longer: the bar lying about how much time is left.
 * That is the same class of bug as a framer `animate` jumping a paused bar to
 * 100%, and the reason both clocks have to be driven off one remaining time.
 *
 * @param fn      fires when the remaining time elapses (always the latest ref)
 * @param ms      full duration for a fresh run
 * @param paused  hold the clock where it is (hover, off-screen, …)
 * @param runKey  changes to start a fresh full run (e.g. `${tab}-${runId}`)
 */
export function usePausableTimeout(fn: () => void, ms: number, paused: boolean, runKey: string) {
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const remaining = useRef(ms);
  const startedAt = useRef(0);

  // Declared BEFORE the timer effect on purpose: on a runKey change React runs
  // cleanups in declaration order, so the timer's cleanup banks its remainder
  // first and this reset overwrites it second — a new run gets the full
  // duration, not the tail of the previous one.
  useEffect(() => { remaining.current = ms; }, [runKey, ms]);

  useEffect(() => {
    if (paused) return;
    startedAt.current = performance.now();
    const t = setTimeout(() => fnRef.current(), remaining.current);
    return () => {
      clearTimeout(t);
      remaining.current = Math.max(0, remaining.current - (performance.now() - startedAt.current));
    };
  }, [paused, runKey, ms]);
}
