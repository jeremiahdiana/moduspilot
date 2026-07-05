import type { ReactNode } from 'react';

// Recognizable brand marks for the AI models MODUS routes between. Kept as clean
// inline SVGs so they render crisp in light + dark. `className` controls size.

type LogoProps = { className?: string };

export function OpenAILogo({ className = 'w-5 h-5' }: LogoProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-label="OpenAI">
      <path fill="#10A37F" d="M22.28 9.82a5.98 5.98 0 0 0-.52-4.91 6.05 6.05 0 0 0-6.51-2.9A6.07 6.07 0 0 0 4.98 4.18a5.98 5.98 0 0 0-4 2.9 6.05 6.05 0 0 0 .74 7.1 5.98 5.98 0 0 0 .51 4.91 6.05 6.05 0 0 0 6.52 2.9A5.97 5.97 0 0 0 13.26 22a6.06 6.06 0 0 0 5.77-4.21 5.99 5.99 0 0 0 4-2.9 6.06 6.06 0 0 0-.75-7.07zm-9.02 12.6a4.48 4.48 0 0 1-2.88-1.04l.14-.08 4.78-2.76a.79.79 0 0 0 .39-.68v-6.74l2.02 1.17a.07.07 0 0 1 .04.06v5.58a4.5 4.5 0 0 1-4.49 4.49zM3.6 18.3a4.47 4.47 0 0 1-.54-3.01l.14.09 4.78 2.76a.77.77 0 0 0 .78 0l5.84-3.37v2.33a.08.08 0 0 1-.03.07l-4.83 2.79a4.5 4.5 0 0 1-6.14-1.65zM2.34 7.9a4.48 4.48 0 0 1 2.35-1.97V11.6a.77.77 0 0 0 .39.68l5.81 3.35-2.02 1.17a.07.07 0 0 1-.07 0l-4.83-2.79A4.5 4.5 0 0 1 2.34 7.9zm16.6 3.86-5.84-3.4L15.12 7.2a.07.07 0 0 1 .07 0l4.83 2.78a4.49 4.49 0 0 1-.68 8.1v-5.68a.79.79 0 0 0-.4-.68zm2.01-3.03-.14-.09-4.77-2.78a.78.78 0 0 0-.79 0L9.42 9.23V6.9a.07.07 0 0 1 .03-.07l4.83-2.78a4.49 4.49 0 0 1 6.67 4.65zM8.32 12.9 6.3 11.73a.08.08 0 0 1-.04-.06V6.1a4.49 4.49 0 0 1 7.36-3.44l-.14.08L8.66 5.5a.79.79 0 0 0-.39.68l-.01 6.72zm1.1-2.36 2.6-1.5 2.6 1.5v3l-2.6 1.5-2.6-1.5v-3z" />
    </svg>
  );
}

export function ClaudeLogo({ className = 'w-5 h-5' }: LogoProps) {
  // Anthropic sunburst.
  return (
    <svg viewBox="0 0 24 24" className={className} stroke="#D97757" strokeWidth={2.1} strokeLinecap="round" fill="none" aria-label="Claude">
      <path d="M12 2.5v19M2.5 12h19M5.2 5.2l13.6 13.6M18.8 5.2 5.2 18.8" />
    </svg>
  );
}

export function GeminiLogo({ className = 'w-5 h-5' }: LogoProps) {
  // Gemini four-point spark.
  return (
    <svg viewBox="0 0 24 24" className={className} aria-label="Gemini">
      <path fill="#4285F4" d="M12 2c.42 4.9 3.6 8.08 8.5 8.5-4.9.42-8.08 3.6-8.5 8.5-.42-4.9-3.6-8.08-8.5-8.5 4.9-.42 8.08-3.6 8.5-8.5z" />
    </svg>
  );
}

export function GrokLogo({ className = 'w-5 h-5' }: LogoProps) {
  // xAI X mark (adapts to theme via currentColor).
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-label="Grok">
      <path d="M3 3h3.2l5 6.9L16.9 3H20l-6.4 8.6L20.4 21H17l-5.3-7.2L6 21H3l6.7-9L3 3z" />
    </svg>
  );
}

export function MetaLogo({ className = 'w-5 h-5' }: LogoProps) {
  // Meta infinity loop.
  return (
    <svg viewBox="0 0 24 24" className={className} fill="#0866FF" aria-label="Meta / Llama">
      <path d="M7.2 6.5c-2.9 0-5.2 2.5-5.2 5.5s2 5.5 4.8 5.5c2.1 0 3.6-1.4 5-3.6l-1.5-2.2c-1.1 1.8-1.9 2.9-3.2 2.9-1.4 0-2.4-1.2-2.4-2.6 0-1.5 1-2.7 2.4-2.7 1 0 1.9.7 3 2.3l1.4 2.1c1.5 2.2 3 3.8 5.2 3.8 2.8 0 4.5-2.5 4.5-5.5s-1.8-5.5-4.6-5.5c-2.2 0-3.8 1.6-5.2 3.8l-.7 1.1-.7-1c-1.4-2.2-2.9-3.7-4.3-3.7zm9.9 2.3c1.4 0 2.4 1.2 2.4 2.7s-.9 2.7-2.3 2.7c-1 0-1.8-.9-3-2.7l-.6-.9.7-1.1c1.1-1.6 1.9-2.7 2.8-2.7z" />
    </svg>
  );
}

export interface ModelInfo {
  name: string;
  provider: string;
  logo: (p: LogoProps) => ReactNode;
}

export const MODEL_LOGOS: ModelInfo[] = [
  { name: 'Claude',  provider: 'Anthropic', logo: ClaudeLogo },
  { name: 'GPT-4o',  provider: 'OpenAI',    logo: OpenAILogo },
  { name: 'Gemini',  provider: 'Google',    logo: GeminiLogo },
  { name: 'Grok',    provider: 'xAI',       logo: GrokLogo },
  { name: 'Llama',   provider: 'Meta',      logo: MetaLogo },
];

/** Logo for a platform model id (see lib/models.ts) — used by the in-app switcher. */
export function logoForModel(id: string): (p: LogoProps) => ReactNode {
  if (id.startsWith('claude')) return ClaudeLogo;
  if (id.startsWith('gpt') || id.startsWith('o4') || id.startsWith('o3')) return OpenAILogo;
  if (id.startsWith('gemini')) return GeminiLogo;
  if (id.startsWith('grok')) return GrokLogo;
  if (id.startsWith('llama')) return MetaLogo;
  return OpenAILogo;
}
