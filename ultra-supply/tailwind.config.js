/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          DEFAULT: '#123B70',
          950: '#0A2445',
          900: '#0E2F5A',
          800: '#123B70',
          700: '#1B4A85',
          100: '#E3EAF3',
          50: '#F1F5FA',
        },
        brand: { red: '#D92332', redDark: '#B81B29' },
        mist: '#F3F5F7',
      },
      fontFamily: {
        display: ['Archivo', 'IBM Plex Sans Arabic', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'IBM Plex Sans Arabic', 'system-ui', 'sans-serif'],
        arabic: ['IBM Plex Sans Arabic', 'system-ui', 'sans-serif'],
      },
      letterSpacing: { label: '0.22em' },
      maxWidth: { site: '1360px' },
      keyframes: {
        scrollDot: {
          '0%': { transform: 'translateY(0)', opacity: '0' },
          '30%': { opacity: '1' },
          '100%': { transform: 'translateY(14px)', opacity: '0' },
        },
        kenburns: { '0%': { transform: 'scale(1.08)' }, '100%': { transform: 'scale(1)' } },
        marquee: { '0%': { transform: 'translateX(0)' }, '100%': { transform: 'translateX(-50%)' } },
      },
      animation: {
        scrollDot: 'scrollDot 1.8s ease-in-out infinite',
        kenburns: 'kenburns 14s ease-out forwards',
        marquee: 'marquee 40s linear infinite',
      },
    },
  },
  plugins: [],
};
