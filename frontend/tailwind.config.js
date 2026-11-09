/** @type {import('tailwindcss').Config} */
const c = (name) => `hsl(var(--${name}) / <alpha-value>)`
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: { sans: ['Geist', 'ui-sans-serif', 'system-ui', 'sans-serif'], mono: ['"Geist Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'] },
      colors: {
        background: c('background'), foreground: c('foreground'), card: c('card'), border: c('border'), ring: c('ring'),
        muted: { DEFAULT: c('muted'), foreground: c('muted-foreground') },
        primary: { DEFAULT: c('primary'), foreground: c('primary-foreground'), soft: c('primary-soft') },
        success: { DEFAULT: c('success'), soft: c('success-soft') },
        warn: { DEFAULT: c('warn'), soft: c('warn-soft') },
        danger: { DEFAULT: c('danger'), soft: c('danger-soft') },
      },
      borderRadius: { lg: 'var(--radius)', md: 'calc(var(--radius) - 3px)', sm: 'calc(var(--radius) - 6px)' },
      boxShadow: { card: 'var(--shadow-card)', pop: 'var(--shadow-pop)' },
      keyframes: {
        'fade-up': { from: { opacity: '0', transform: 'translateY(8px)' }, to: { opacity: '1', transform: 'none' } },
        'toast-in': { from: { opacity: '0', transform: 'translateY(12px) scale(.98)' }, to: { opacity: '1', transform: 'none' } },
        'pulse-ring': { '0%': { transform: 'scale(.6)', opacity: '.7' }, '100%': { transform: 'scale(2.2)', opacity: '0' } },
        shimmer: { '100%': { transform: 'translateX(100%)' } },
      },
      animation: { 'fade-up': 'fade-up .35s ease-out both', 'toast-in': 'toast-in .25s ease-out both', 'pulse-ring': 'pulse-ring 2.4s ease-out infinite' },
    },
  },
  plugins: [],
}
