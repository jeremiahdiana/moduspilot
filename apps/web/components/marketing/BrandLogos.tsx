// Shared brand/logo SVGs. Inline (no network) so they render instantly and
// inherit color where appropriate. Used by PlatformsSection, ModelSettings, etc.
// — replacing the decorative Unicode glyphs that rendered as tofu boxes.
import type { SVGProps } from 'react';

type LogoProps = { className?: string } & SVGProps<SVGSVGElement>;

export function AppleLogo({ className = 'w-6 h-6', ...rest }: LogoProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden {...rest}>
      <path d="M17.05 12.54c-.03-3.2 2.62-4.74 2.74-4.82-1.5-2.18-3.82-2.48-4.64-2.52-1.98-.2-3.86 1.16-4.86 1.16s-2.54-1.13-4.18-1.1c-2.15.03-4.14 1.25-5.24 3.18-2.24 3.87-.57 9.6 1.6 12.74 1.07 1.54 2.34 3.26 4 3.2 1.6-.06 2.22-1.04 4.16-1.04s2.49 1.04 4.19 1.01c1.73-.03 2.82-1.57 3.88-3.11 1.22-1.79 1.72-3.52 1.75-3.6-.04-.02-3.36-1.29-3.4-5.1zM13.87 3.85c.88-1.07 1.48-2.56 1.32-4.05-1.27.05-2.82.85-3.73 1.92-.82.95-1.54 2.47-1.35 3.92 1.42.11 2.87-.72 3.76-1.79z"/>
    </svg>
  );
}

export function WebGlobe({ className = 'w-6 h-6', ...rest }: LogoProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className={className} aria-hidden {...rest}>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" strokeLinecap="round" />
      <path d="M12 3c2.6 2.4 3.6 6 3.6 9s-1 6.6-3.6 9c-2.6-2.4-3.6-6-3.6-9s1-6.6 3.6-9z" />
    </svg>
  );
}

export function OpenAILogo({ className = 'w-5 h-5', ...rest }: LogoProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden {...rest}>
      <path d="M22.28 9.82a5.98 5.98 0 0 0-.52-4.91 6.05 6.05 0 0 0-6.51-2.9A5.98 5.98 0 0 0 10.75 0a6.05 6.05 0 0 0-5.77 4.19 5.98 5.98 0 0 0-4 2.9 6.05 6.05 0 0 0 .75 7.1 5.98 5.98 0 0 0 .51 4.91 6.05 6.05 0 0 0 6.52 2.9A5.98 5.98 0 0 0 13.25 24a6.05 6.05 0 0 0 5.77-4.2 5.98 5.98 0 0 0 4-2.9 6.05 6.05 0 0 0-.74-7.08zM13.25 22.43a4.48 4.48 0 0 1-2.88-1.04l.14-.08 4.78-2.76a.78.78 0 0 0 .4-.68v-6.74l2.02 1.17a.07.07 0 0 1 .04.05v5.58a4.5 4.5 0 0 1-4.5 4.5zM3.6 18.3a4.47 4.47 0 0 1-.54-3.01l.14.08 4.78 2.76a.78.78 0 0 0 .78 0l5.84-3.37v2.33a.07.07 0 0 1-.03.06l-4.83 2.79a4.5 4.5 0 0 1-6.14-1.64zM2.34 7.9a4.48 4.48 0 0 1 2.35-1.97v5.68a.78.78 0 0 0 .39.68l5.83 3.36-2.02 1.17a.07.07 0 0 1-.07 0l-4.83-2.8A4.5 4.5 0 0 1 2.34 7.9zm16.6 3.86-5.84-3.37 2.02-1.16a.07.07 0 0 1 .07 0l4.83 2.78a4.5 4.5 0 0 1-.68 8.12v-5.69a.78.78 0 0 0-.4-.68zm2.01-3.02-.14-.09-4.77-2.77a.78.78 0 0 0-.79 0L9.42 7.2V4.87a.07.07 0 0 1 .03-.06l4.83-2.79a4.5 4.5 0 0 1 6.68 4.66zM8.32 12.87 6.3 11.7a.07.07 0 0 1-.04-.05V6.08a4.5 4.5 0 0 1 7.38-3.45l-.14.08L8.72 5.47a.78.78 0 0 0-.4.68zm1.1-2.37 2.6-1.5 2.6 1.5v3l-2.6 1.5-2.6-1.5z"/>
    </svg>
  );
}

export function AnthropicLogo({ className = 'w-5 h-5', ...rest }: LogoProps) {
  // Anthropic / Claude wordmark glyph.
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden {...rest}>
      <path d="M13.83 4h3.02L23 20h-3.02l-1.2-3.16h-6.6L11 20H8l6.16-16h-.33zm-.35 3.9-2.23 5.86h4.46L13.48 7.9zM4.02 4h3.1L1 20H-.02z" transform="translate(1)"/>
      <path d="M6.5 4h3l6.16 16h-3l-1.22-3.2H4.9L3.68 20h-3L6.5 4zm1.5 3.9L5.77 13.8h4.46L8 7.9z"/>
    </svg>
  );
}

export function GeminiLogo({ className = 'w-5 h-5', ...rest }: LogoProps) {
  // Google Gemini four-point spark.
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden {...rest}>
      <path d="M12 2c.3 4.4 2.4 8 7.6 8-5.2 0-7.3 3.6-7.6 8-.3-4.4-2.4-8-7.6-8C9.6 10 11.7 6.4 12 2z" fill="#4285F4"/>
    </svg>
  );
}

export function XaiLogo({ className = 'w-4 h-4', ...rest }: LogoProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden {...rest}>
      <path d="M3 3h3.6l5 7-5 7H3l5-7zm12.8 0H19l-4.3 6-1.8-2.5zm-1.3 11.9 1.8 2.6L13.7 21h-3.2z"/>
    </svg>
  );
}

export function MetaLogo({ className = 'w-5 h-5', ...rest }: LogoProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden {...rest}>
      <path d="M3 15.5c0-3.6 1.6-7 4-7 1.7 0 3 1.6 4.9 4.7 2 3.3 3.1 4.8 4.7 4.8 1.5 0 2.4-1.6 2.4-4 0-2.7-1.1-4.5-2.6-4.5-1.2 0-2.3 1-3.8 3.4l-1.2-1.9C15.2 8.2 16.7 7 18.4 7 21 7 23 9.8 23 14c0 3.4-1.6 5.5-4 5.5-1.9 0-3.2-1.2-5.1-4.3C12 12 11 10.5 9.7 10.5c-1 0-1.9 1.4-1.9 3.8 0 1 .2 1.9.4 2.5l-2 .6C3.7 16.5 3 15.7 3 15.5z" fill="#0866FF"/>
    </svg>
  );
}

export function AutoSpark({ className = 'w-5 h-5', ...rest }: LogoProps) {
  // "Auto" (MODUS routing) — a spark, in the brand color.
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden {...rest}>
      <path d="M12 2.5c.4 4.6 2.6 6.8 7 7.2-4.4.4-6.6 2.6-7 7.2-.4-4.6-2.6-6.8-7-7.2 4.4-.4 6.6-2.6 7-7.2z"/>
      <path d="M18.5 15c.2 2 1.1 2.9 3 3.1-1.9.2-2.8 1.1-3 3.1-.2-2-1.1-2.9-3-3.1 1.9-.2 2.8-1.1 3-3.1z" opacity="0.6"/>
    </svg>
  );
}

// Maps a provider label (as used in lib/models.ts / ModelSettings) to a logo.
export function ProviderLogo({ provider, className }: { provider: string; className?: string }) {
  const p = provider.toLowerCase();
  if (p.includes('openai')) return <OpenAILogo className={className} />;
  if (p.includes('anthropic')) return <AnthropicLogo className={className} />;
  if (p.includes('google')) return <GeminiLogo className={className} />;
  if (p.includes('xai')) return <XaiLogo className={className} />;
  if (p.includes('meta') || p.includes('groq') || p.includes('llama')) return <MetaLogo className={className} />;
  if (p.includes('modus') || p.includes('routing')) return <AutoSpark className={className} />;
  return null;
}
