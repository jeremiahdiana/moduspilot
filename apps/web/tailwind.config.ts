import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        bg: 'rgb(var(--color-bg) / <alpha-value>)',
        panel: 'rgb(var(--color-panel) / <alpha-value>)',
        border: 'rgb(var(--color-border) / <alpha-value>)',
        brand: '#6d28d9',
        // Was #a78bfa (washed lavender) — read as "light purple" on the ivory
        // marketing bg. Now a true deep violet: kills the washed look while
        // keeping enough contrast for the `dark:text-brand-light` usages on
        // dark surfaces (chat, dark marketing).
        'brand-light': '#7C3AED',
        text: 'rgb(var(--color-text) / <alpha-value>)',
        muted: 'rgb(var(--color-muted) / <alpha-value>)',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'system-ui', 'sans-serif'],
        grotesk: ['var(--font-grotesk)', 'system-ui', 'sans-serif'],
        // `font-serif` = Sentient, the homepage heading face — now also the
        // global h1–h6 default (see globals.css).
        serif: ['var(--font-serif)', 'Georgia', 'serif'],
      },
    },
  },
  plugins: [],
};

export default config;
