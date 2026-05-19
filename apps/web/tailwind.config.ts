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
        bg: '#0a0a0f',
        panel: '#111118',
        border: '#1e1e2e',
        brand: '#7C3AED',
        'brand-light': '#a78bfa',
        text: '#e8e8f0',
        muted: '#6b6b80',
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
