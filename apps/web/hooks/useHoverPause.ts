import { useEffect, useState } from 'react';

/**
 * Hover-to-pause that cannot latch on.
 *
 * The old `onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}`
 * assumed every enter is answered by a leave. It isn't. A macOS notification
 * taking the pointer, the window losing focus, a touch device that fires enter
 * with no leave to follow — any of those strand `paused` at true forever, and
 * both the bar and the clock stop for good with no way back. That is the
 * /features stuck bar.
 *
 * So: only arm hover on devices that actually hover, and treat blur and tab-hide
 * as unconditional resumes rather than trusting a leave to arrive.
 */
export function useHoverPause() {
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    const resume = () => setPaused(false);
    // A window losing focus never delivers mouseleave, and a hidden tab is not
    // being read — either way the pause has no owner left to release it.
    window.addEventListener('blur', resume);
    document.addEventListener('visibilitychange', resume);
    return () => {
      window.removeEventListener('blur', resume);
      document.removeEventListener('visibilitychange', resume);
    };
  }, []);

  const handlers = {
    onPointerEnter: () => {
      // Touch fires pointerenter on tap and then no pointerleave, which is the
      // latch. Coarse pointers get no hover pause at all.
      if (typeof window !== 'undefined' && window.matchMedia('(hover: hover)').matches) {
        setPaused(true);
      }
    },
    onPointerLeave: () => setPaused(false),
    onPointerCancel: () => setPaused(false),
  };

  return { paused, handlers };
}
