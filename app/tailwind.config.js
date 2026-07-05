/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: { DEFAULT: '#7E5DFE', deep: '#6631F6' },
        crash: '#FF3A3E',
        cash: '#22F58A',
        track: { bg: '#0A0A12', panel: '#12121F', lane: '#0E0E1A', line: '#23234010' },
        neon: {
          cyan: '#22E1FF',
          orange: '#FF8A1E',
          magenta: '#FF3AF0',
          lime: '#B6FF3A',
        },
      },
      fontFamily: {
        display: ['"SF Pro Display"', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'sans-serif'],
        mono: ['"SF Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
    },
  },
  plugins: [],
};
