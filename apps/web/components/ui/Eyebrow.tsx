/**
 * Eyebrow — the small brand-colored uppercase label used above section
 * headings across marketing + in-app surfaces.
 */
export function Eyebrow({ className = '', children }: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <p className={`text-xs font-bold text-brand uppercase tracking-widest ${className}`}>
      {children}
    </p>
  );
}
