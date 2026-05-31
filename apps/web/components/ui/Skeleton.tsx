'use client';

/**
 * Skeleton — shimmering placeholder block.
 * Uses the `.skeleton` class (globals.css) for the sweep animation,
 * which respects prefers-reduced-motion.
 */
export function Skeleton({
  className = '',
  rounded = 'rounded-md',
}: {
  className?: string;
  rounded?: string;
}) {
  return <div className={`skeleton ${rounded} ${className}`} />;
}

/** A single skeleton "row" approximating a list item (checkbox + title + meta). */
export function SkeletonRow() {
  return (
    <div className="flex items-start gap-2.5">
      <Skeleton className="mt-0.5 w-4 h-4" rounded="rounded" />
      <div className="flex-1 min-w-0 space-y-1.5">
        <Skeleton className="h-3.5 w-3/5" />
        <Skeleton className="h-2.5 w-1/4" />
      </div>
    </div>
  );
}

/** A skeleton card approximating a goal/project card with a progress bar. */
export function SkeletonCard() {
  return (
    <div className="bg-panel border border-border rounded-2xl p-5 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-4 w-10" />
      </div>
      <Skeleton className="h-3 w-4/5" />
      <Skeleton className="h-2 w-full" rounded="rounded-full" />
    </div>
  );
}

/** Repeats a skeleton element `count` times with consistent spacing. */
export function SkeletonList({
  count = 4,
  children,
  className = 'space-y-3',
}: {
  count?: number;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className} aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i}>{children}</div>
      ))}
    </div>
  );
}
