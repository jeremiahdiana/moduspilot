'use client';

import { ReactNode } from 'react';

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
 * Tooltip — CSS-only hover/focus label. Wrap any element; reveals `label` on
 * hover or keyboard focus. No JS state, so it's cheap to use anywhere.
 *
 * The wrapped child should be focusable (button/link/[tabIndex]) for the
 * focus-within reveal to fire for keyboard users.
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
  return (
    <span className={`relative inline-flex group/tooltip ${className}`}>
      {children}
      <span
        role="tooltip"
        className={`pointer-events-none absolute z-50 whitespace-nowrap rounded-lg bg-text px-2 py-1 text-[11px] font-medium text-bg shadow-lg
          opacity-0 scale-95 transition-all duration-150 ease-out
          group-hover/tooltip:opacity-100 group-hover/tooltip:scale-100
          group-focus-within/tooltip:opacity-100 group-focus-within/tooltip:scale-100
          ${SIDE_POS[side]} ${SIDE_ORIGIN[side]}`}
      >
        {label}
      </span>
    </span>
  );
}
