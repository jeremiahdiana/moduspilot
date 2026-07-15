'use client';

import { ReactNode, useState } from 'react';

type Side = 'top' | 'bottom' | 'left' | 'right';

const SIDE_POS: Record<Side, string> = {
  top:    'bottom-full left-1/2 -translate-x-1/2 mb-2',
  bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
  left:   'right-full top-1/2 -translate-y-1/2 mr-2',
  right:  'left-full top-1/2 -translate-y-1/2 ml-2',
};

const SIDE_ORIGIN: Record<Side, string> = {
  top:    'origin-bottom',
  bottom: 'origin-top',
  left:   'origin-right',
  right:  'origin-left',
};

/**
 * Tooltip — hover/focus label. Wrap any element; reveals `label` on hover or
 * keyboard focus.
 *
 * A tooltip explains a control you have not used yet, so it must get out of the
 * way the moment you use it. This was pure CSS (group-hover + group-focus-within)
 * and both halves kept it on screen after a click:
 *   - the cursor is still over the button once the menu opens, so :hover never
 *     ends and "Attach & tools" sat on top of the menu it had just opened;
 *   - clicking FOCUSES the button, so :focus-within held the label up even after
 *     the mouse left — until something else was clicked.
 * Hence the state: a pointer press dismisses it until the pointer leaves and
 * comes back. Keyboard focus still shows it, but only real keyboard focus
 * (:focus-visible), which a mouse click does not trigger.
 *
 * The wrapped child should be focusable (button/link/[tabIndex]) for the
 * keyboard reveal to fire.
 *
 * ⚠️ This span is `relative inline-flex`: in a flex column it stretches full
 * width while the child inside shrink-wraps, so anything that must fill its row
 * needs `w-full` on BOTH the Tooltip and the inner control.
 */
export function Tooltip({
  label,
  side = 'top',
  children,
  className = '',
}: {
  label: string;
  side?: Side;
  children: ReactNode;
  className?: string;
}) {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);
  const [keyboardFocus, setKeyboardFocus] = useState(false);

  const visible = (hovered && !pressed) || keyboardFocus;

  return (
    <span
      className={`relative inline-flex group/tooltip ${className}`}
      onMouseEnter={() => { setHovered(true); setPressed(false); }}
      onMouseLeave={() => { setHovered(false); setPressed(false); }}
      // Dismiss on press, not on click: the label should be gone by the time the
      // menu paints, not a frame after it.
      onPointerDown={() => setPressed(true)}
      onFocus={(e) => {
        // Mouse clicks fire focus too. :focus-visible is what separates a real
        // keyboard tab from a click, and only the former wants a tooltip.
        try {
          if ((e.target as HTMLElement).matches(':focus-visible')) setKeyboardFocus(true);
        } catch { /* older engines: skip the keyboard reveal rather than stick */ }
      }}
      onBlur={() => setKeyboardFocus(false)}
    >
      {children}
      <span
        role="tooltip"
        aria-hidden={!visible}
        className={`pointer-events-none absolute z-50 whitespace-nowrap rounded-lg bg-text px-2 py-1 text-[11px] font-medium text-bg shadow-lg
          transition-all duration-150 ease-out
          ${visible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}
          ${SIDE_POS[side]} ${SIDE_ORIGIN[side]}`}
      >
        {label}
      </span>
    </span>
  );
}
