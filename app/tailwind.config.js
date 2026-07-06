/** @type {import('tailwindcss').Config} */
import colors from './src/theme/colors';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
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
        // Danny's engineered light-surface shadows. The neutral button carries the outer edge
        // plus a soft inner top-highlight; primary/cta swap the highlight to purple.
        button: '0px 0px 2.5px 0px rgba(0, 0, 0, 0.34), 0px -5px 4px 0px rgba(240, 240, 240, 0.8) inset',
        primary: '0px 0px 2.5px 0px rgba(0, 0, 0, 0.34), 0px -5px 4px 0px #8E75EF inset',
        cta: '0px 0px 2.5px 0px rgba(0, 0, 0, 0.34), 0px -5px 4px 0px #8E75EF inset, 0px 16px 34px -12px rgba(126, 93, 254, 0.45)',
        'primary-inset': 'inset 0px -5px 4px 0px #8E75EF',
        'pill-highlight': 'inset 2px 3px 4px 0px rgba(255, 255, 255, 0.56)',
        // Soft card drop: the signature ambient depth that makes a raised white surface read.
        'card-drop': '0px 0px 56.6px 0px rgba(0, 0, 0, 0.09)',
        'card-raise': '0px 1px 4px 0px rgba(0, 0, 0, 0.06), 0px 12px 32px -18px rgba(0, 0, 0, 0.18)',
        'purple-glow': '0px 0px 56.6px 0px rgba(145, 115, 255, 0.12)',
        'brand-glow': '0 0 40px -6px rgba(126, 93, 254, 0.35)',
        'tab-active': '2px 2px 4px 0px rgba(0, 0, 0, 0.09), inset 3px 3px 4px 0px rgba(255, 255, 255, 0.25)',
        'token-badge': '1.267px 1.267px 2.534px 0px rgba(0, 0, 0, 0.25), inset 1.901px 1.901px 4px 0px rgba(255, 255, 255, 0.39)',
        box: '0px 0px 56.6px 0px rgba(0, 0, 0, 0.09)',
        cancel: '4px 4px 4px 0px rgba(255, 182, 182, 0.25) inset',
        // Soft grey lane strip: a recessed inner press with a crisp top-light so the car sits
        // down inside a crafted groove rather than floating on the pure-white hero panel.
        lane: 'inset 0px 2px 4px 0px rgba(0, 0, 0, 0.07), inset 0px -1px 1px 0px rgba(255, 255, 255, 0.9), inset 0px 0px 0px 1px rgba(0, 0, 0, 0.03)',
        chip: 'inset 0 0 0 1px rgba(0, 0, 0, 0.06), 0 1px 2px rgba(0, 0, 0, 0.14)',
        // Selected card: a thin purple identity ring (selection = accent) over a NEUTRAL grey
        // lift, so depth reads in black alphas instead of a coloured neon stain.
        'car-select': '0 0 0 1.5px rgba(126, 93, 254, 0.6), 0 1px 4px rgba(0, 0, 0, 0.06), 0 12px 32px -18px rgba(0, 0, 0, 0.18)',
      },
      backgroundImage: {
        'gradient-primary': 'linear-gradient(180deg, #7e5dfe 0%, #997fff 100%)',
        'gradient-cancel': 'linear-gradient(180deg, #ff7f81 0%, #ff5757 100%)',
        'gradient-default': 'linear-gradient(180deg, #f3f3f3 0%, #fff 100%)',
        'gradient-purple-text': 'linear-gradient(180deg, #7e5dfe 0%, #4819be 100%)',
        'gradient-ltv-pill': 'linear-gradient(180deg, #e8f9ff 0%, #a4e5ff 100%)',
        'gradient-exit-pill': 'linear-gradient(180deg, #f1f0ff 0%, #c4beff 100%)',
        'gradient-track': 'radial-gradient(130% 65% at 50% -12%, rgba(126, 93, 254, 0.10), transparent 60%), #edeef2',
        'gradient-panel': 'linear-gradient(180deg, #ffffff 0%, #fafafb 100%)',
        'gradient-brand-soft': 'linear-gradient(180deg, rgba(126, 93, 254, 0.10) 0%, rgba(102, 49, 246, 0.03) 100%)',
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
        // Landing-only: cars drift along their lane so a resting position still reads as a live,
        // moving oracle number rather than a static graphic. Pure transform, honors reduced motion.
        driftLead: {
          '0%, 100%': { transform: 'translateX(0)' },
          '50%': { transform: 'translateX(15px)' },
        },
        driftMid: {
          '0%, 100%': { transform: 'translateX(0)' },
          '50%': { transform: 'translateX(-11px)' },
        },
        driftTrail: {
          '0%, 100%': { transform: 'translateX(0)' },
          '45%': { transform: 'translateX(-17px)' },
          '75%': { transform: 'translateX(7px)' },
        },
        softPulse: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.4' },
        },
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        'fade-in-up': 'fadeInUp 0.5s ease-out forwards',
        dropdownOpen: 'dropdownOpen 0.3s ease-out forwards',
        marquee: 'marquee 120s linear infinite',
        'drift-lead': 'driftLead 4.4s ease-in-out infinite',
        'drift-mid': 'driftMid 3.6s ease-in-out infinite',
        'drift-trail': 'driftTrail 5.2s ease-in-out infinite',
        'soft-pulse': 'softPulse 1.7s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
