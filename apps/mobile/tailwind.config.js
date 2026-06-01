/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
    './lib/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      // Brand typography — matches web (Clash Display headings, Satoshi body).
      // Loaded at runtime via expo-font; iOS picks the weighted face from the
      // family name + font-weight utility. `font-display` opts a heading into
      // Clash Display; everything else defaults to Satoshi (see lib/fonts.ts).
      fontFamily: {
        display: ['Clash Display'],
        sans: ['Satoshi'],
      },
      // Semantic tokens driven by CSS variables in global.css, so every class
      // (bg-bg, text-text, …) follows the active light/dark theme automatically.
      colors: {
        bg: 'rgb(var(--bg) / <alpha-value>)',
        text: 'rgb(var(--text) / <alpha-value>)',
        muted: 'rgb(var(--muted) / <alpha-value>)',
        brand: 'rgb(var(--brand) / <alpha-value>)',
        'brand-light': 'rgb(var(--brand-light) / <alpha-value>)',
        border: 'rgb(var(--border) / <alpha-value>)',
        surface: 'rgb(var(--surface) / <alpha-value>)',
        'surface-2': 'rgb(var(--surface-2) / <alpha-value>)',
      },
    },
  },
};
