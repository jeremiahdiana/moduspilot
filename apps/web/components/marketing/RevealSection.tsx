'use client';

/**
 * RevealSection — now a passthrough. The scroll-reveal animation was removed
 * (Jeremiah's call: the entrance animations read as unprofessional). Kept as a
 * component so callers don't change; it just renders its children.
 */
export default function RevealSection({
  children,
}: {
  children: React.ReactNode;
  direction?: 'up' | 'left' | 'right' | 'none';
}) {
  return <>{children}</>;
}
