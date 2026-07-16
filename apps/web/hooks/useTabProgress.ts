import { useEffect, useRef } from 'react';

/** Longest delta a single frame may contribute (~6 frames at 60fps). Anything
 *  bigger is a gap where we weren't running, not time the user watched. */
const MAX_FRAME_MS = 100;

/**
 * Drives an auto-advancing tab strip: one rAF loop is BOTH the countdown and the
 * fill bar, so they cannot disagree.
 *
 * The previous split — a setTimeout banking its remaining time next to a CSS
 * keyframe bar frozen with animation-play-state — kept two clocks that were only
 * ever in sync by luck, and it got stuck for real on /features. Every desync had
 * the same shape: something moved one clock and not the other. A background tab
 * throttles setTimeout to >=1s but pauses CSS animations dead. `prefers-reduced-
 * motion` killed the bar's animation, so it sat at 100% while the JS still had
 * seconds to run. And the banked remainder floored at 0 permanently, so a run
 * that never got a fresh runKey could only ever fire instantly or not at all.
 *
 * One clock removes the entire class. rAF stops on its own in a background tab,
 * which is most of the pause semantics for free — but only once its delta is
 * clamped, or the gap arrives all at once on the first frame back (see tick).
 *
 * The bar is written straight to the DOM as a CSS var rather than through state:
 * this ticks ~60x/sec and nothing else on the page needs to re-render for it.
 *
 * @param ms      full duration of a run
 * @param paused  hold the clock (hover, off-screen)
 * @param runKey  changes to restart a run from zero
 * @param onDone  fires once per run when the time is up (always the latest ref)
 * @returns ref to put on the fill element; it reads `width: var(--fill)`
 */
export function useTabProgress(
  ms: number,
  paused: boolean,
  runKey: string,
  onDone: () => void,
) {
  const fillRef = useRef<HTMLElement | null>(null);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  const elapsed = useRef(0);
  const fired = useRef(false);

  useEffect(() => {
    elapsed.current = 0;
    fired.current = false;
    if (fillRef.current) fillRef.current.style.setProperty('--fill', '0%');

    let raf = 0;
    let last = performance.now();

    const tick = (now: number) => {
      // Clamped because rAF STOPS while the tab is hidden: the first frame back
      // carries the whole gap as its delta, which would teleport the clock to
      // done and snap the bar to 100% on return — the same lie, from the other
      // direction. Anything longer than a few frames means we weren't running,
      // so it counts as no time passed, and being hidden pauses the run.
      const dt = Math.min(now - last, MAX_FRAME_MS);
      last = now;

      // Not accumulating IS the pause. No remainder is banked anywhere, so there
      // is no stale remainder to get stuck on.
      if (!pausedRef.current) elapsed.current += dt;

      const p = Math.min(1, elapsed.current / ms);
      if (fillRef.current) fillRef.current.style.setProperty('--fill', `${p * 100}%`);

      if (p >= 1) {
        if (!fired.current) {
          fired.current = true;
          onDoneRef.current();
        }
        return; // the runKey change from onDone starts the next run
      }
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [runKey, ms]);

  return fillRef;
}
