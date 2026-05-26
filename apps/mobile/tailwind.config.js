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
      colors: {
        bg: '#0a0a0f',
        text: '#e8e8f0',
        muted: '#6b6b80',
        brand: '#7C3AED',
        'brand-light': '#9461ff',
        border: '#1e1e2e',
        surface: '#0f0f1a',
        'surface-2': '#161626',
      },
    },
  },
};
