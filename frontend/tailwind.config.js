/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: '#0d0d0d',
          2: '#1a1a1a',
          3: '#262626',
        },
        paper: '#f0f2f8',
        fog:   '#f7f6f4',
        rule:  '#e8e8e8',
        muted: '#8c8c8c',
        brand: {
          50:  '#f0f9ff',
          100: '#e0f7ff',
          300: '#7dd3fc',
          500: '#0ea5e9',
          600: '#0284c7',
          700: '#0369a1',
        },
      },
      fontFamily: {
        sans:    ['Geist', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        display: ['Instrument Serif', 'Georgia', 'serif'],
        mono:    ['DM Mono', 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
};
