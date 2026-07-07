import { forwardRef } from 'react';

type Variant = 'primary' | 'ghost' | 'danger';
type Size = 'sm' | 'md';

const VARIANTS: Record<Variant, string> = {
  // `.btn-primary` (globals.css) carries the brand gradient + sweep shine.
  primary: 'btn-primary text-white',
  ghost: 'border border-border text-text hover:border-brand/30 hover:bg-panel',
  danger: 'text-red-400 hover:bg-red-900/10 border border-transparent hover:border-red-900/20',
};

const SIZES: Record<Size, string> = {
  sm: 'text-xs px-3 py-1.5 gap-1.5',
  md: 'text-sm px-4 py-2 gap-2',
};

/**
 * Button — shared CTA/action button. Consolidates the repeated
 * `bg-brand text-white rounded-xl` inline pattern. Renders a real <button>.
 */
export const Button = forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
}>(function Button({ variant = 'primary', size = 'md', className = '', children, ...props }, ref) {
  return (
    <button
      ref={ref}
      className={`inline-flex items-center justify-center rounded-xl font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
});
