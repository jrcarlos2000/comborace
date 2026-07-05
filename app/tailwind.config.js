/** @type {import('tailwindcss').Config} */
import colors from './src/theme/colors';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors,
      fontFamily: {
        display: ['"SF Pro Display"', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'sans-serif'],
        sans: ['"SF Pro Display"', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'sans-serif'],
        neue: ['"Neue Montreal"', 'sans-serif'],
        mono: ['"SF Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      boxShadow: {
        button: '0px 0px 2.5px 0px rgba(0, 0, 0, 0.34), 0px -5px 4px 0px rgba(240, 240, 240, 0.8) inset',
        primary: '0px 0px 2.5px 0px rgba(0, 0, 0, 0.34), 0px -5px 4px 0px #8E75EF inset',
        cta: '0px 0px 2.5px 0px rgba(0, 0, 0, 0.34), 0px -5px 4px 0px #8E75EF inset, 0px 16px 34px -12px rgba(126, 93, 254, 0.55)',
        'primary-inset': 'inset 0px -5px 4px 0px #8E75EF',
        'pill-highlight': 'inset 2px 3px 4px 0px rgba(255, 255, 255, 0.56)',
        'card-drop': '0px 0px 56.6px 0px rgba(0, 0, 0, 0.19)',
        'card-dark': '0px 24px 60px -20px rgba(0, 0, 0, 0.7)',
        'purple-glow': '0px 0px 56.6px 0px rgba(145, 115, 255, 0.12)',
        'brand-glow': '0 0 40px -6px rgba(126, 93, 254, 0.5)',
        'tab-active': '2px 2px 4px 0px rgba(0, 0, 0, 0.09), inset 3px 3px 4px 0px rgba(255, 255, 255, 0.25)',
        'token-badge': '1.267px 1.267px 2.534px 0px rgba(0, 0, 0, 0.25), inset 1.901px 1.901px 4px 0px rgba(255, 255, 255, 0.39)',
        box: '0px 0px 56.6px 0px rgba(0, 0, 0, 0.09)',
        cancel: '4px 4px 4px 0px rgba(255, 182, 182, 0.25) inset',
        chip: 'inset 0 0 0 1px rgba(255, 255, 255, 0.14), 0 1px 2px rgba(0, 0, 0, 0.35)',
        'car-select': '0 0 0 1px rgba(255, 255, 255, 0.12), 0 8px 20px -12px rgba(0, 0, 0, 0.7)',
      },
      backgroundImage: {
        'gradient-primary': 'linear-gradient(180deg, #7e5dfe 0%, #997fff 100%)',
        'gradient-cancel': 'linear-gradient(180deg, #ff7f81 0%, #ff5757 100%)',
        'gradient-default': 'linear-gradient(180deg, #f3f3f3 0%, #fff 100%)',
        'gradient-purple-text': 'linear-gradient(180deg, #7e5dfe 0%, #4819be 100%)',
        'gradient-ltv-pill': 'linear-gradient(180deg, #e8f9ff 0%, #a4e5ff 100%)',
        'gradient-exit-pill': 'linear-gradient(180deg, #f1f0ff 0%, #c4beff 100%)',
        'gradient-track': 'radial-gradient(130% 65% at 50% -12%, rgba(126, 93, 254, 0.20), transparent 60%), #06060c',
        'gradient-panel': 'linear-gradient(180deg, rgba(255, 255, 255, 0.04) 0%, rgba(255, 255, 255, 0.01) 100%)',
        'gradient-brand-soft': 'linear-gradient(180deg, rgba(126, 93, 254, 0.16) 0%, rgba(102, 49, 246, 0.06) 100%)',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(1rem)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        dropdownOpen: {
          '0%': { opacity: '0', transform: 'scale(0.95) translateY(-10px)' },
          '100%': { opacity: '1', transform: 'scale(1) translateY(0)' },
        },
        marquee: {
          '0%': { transform: 'translateX(0%)' },
          '100%': { transform: 'translateX(-50%)' },
        },
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        'fade-in-up': 'fadeInUp 0.5s ease-out forwards',
        dropdownOpen: 'dropdownOpen 0.3s ease-out forwards',
        marquee: 'marquee 120s linear infinite',
      },
    },
  },
  plugins: [],
};
