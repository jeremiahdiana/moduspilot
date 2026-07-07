import { forwardRef } from 'react';

/**
 * Card — the canonical panel surface. Replaces the `bg-panel border
 * border-border rounded-2xl` string that was copy-pasted ~39× across the app.
 * `hover` adds the standard brand-tinted lift used on interactive cards.
 */
export const Card = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement> & {
  hover?: boolean;
  padding?: string;
}>(function Card({ hover = false, padding = 'p-5', className = '', children, ...props }, ref) {
  return (
    <div
      ref={ref}
      className={`bg-panel border border-border rounded-2xl ${padding} ${
        hover ? 'transition-colors hover:border-brand/30 hover:shadow-lg hover:shadow-brand/5' : ''
      } ${className}`}
      {...props}
    >
      {children}
    </div>
  );
});
