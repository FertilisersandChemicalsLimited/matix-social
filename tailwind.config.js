/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // warm cream surfaces
        cream: {
          50:  '#fdf8f3',
          100: '#fbf0e6',
          200: '#f5e6d6',
          300: '#ecd6bf',
          400: '#dcc1a3'
        },
        // executive brick — refined for higher contrast
        brand: {
          50:  '#fdecea',
          100: '#fad4cf',
          200: '#f3a99e',
          300: '#e87a68',
          400: '#d6543e',
          500: '#b83a25',
          600: '#9a2d1c',
          700: '#7c2415',
          800: '#5d1a10',
          900: '#3f110a'
        },
        ink: {
          900: '#1a1410',
          800: '#2a1f18',
          700: '#3d2f24',
          600: '#5a473a',
          500: '#7a6655'
        },
        accent: {
          blue:  '#0e63a3',
          green: '#1f8a4c',
          amber: '#d28a1d',
          red:   '#9a2d1c',
          gold:  '#c8924a'
        }
      },
      fontFamily: {
        sans:    ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['"Playfair Display"', 'Georgia', 'serif']
      },
      backgroundImage: {
        'brand-gradient': 'linear-gradient(135deg, #b83a25 0%, #7c2415 100%)',
        'cream-gradient': 'linear-gradient(180deg, #fdf8f3 0%, #fbf0e6 100%)',
        'aurora':        'radial-gradient(60% 60% at 50% 0%, rgba(232,122,104,0.18) 0%, rgba(253,248,243,0) 70%)',
        'noise':         "url(\"data:image/svg+xml;utf8,<svg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/><feColorMatrix values='0 0 0 0 0.36 0 0 0 0 0.20 0 0 0 0 0.10 0 0 0 0.05 0'/></filter><rect width='200' height='200' filter='url(%23n)'/></svg>\")"
      },
      boxShadow: {
        soft:  '0 1px 2px rgba(60,30,15,0.04), 0 8px 24px -12px rgba(60,30,15,0.10)',
        lift:  '0 2px 4px rgba(60,30,15,0.05), 0 18px 38px -16px rgba(60,30,15,0.18)',
        glow:  '0 0 0 1px rgba(154,45,28,0.18), 0 14px 36px -12px rgba(154,45,28,0.32)',
        ring:  '0 0 0 1px rgba(154,45,28,0.15)',
        inset: 'inset 0 1px 0 rgba(255,255,255,0.6)'
      },
      animation: {
        'fade-in':        'fadeIn 220ms ease-out',
        'fade-up':        'fadeUp 360ms cubic-bezier(0.22, 1, 0.36, 1) both',
        'fade-up-slow':   'fadeUp 520ms cubic-bezier(0.22, 1, 0.36, 1) both',
        'slide-in':       'slideIn 280ms cubic-bezier(0.22, 1, 0.36, 1)',
        'scale-in':       'scaleIn 260ms cubic-bezier(0.22, 1, 0.36, 1) both',
        'shimmer':        'shimmer 1.6s linear infinite',
        'pulse-soft':     'pulseSoft 2.4s ease-in-out infinite',
        'breathe':        'breathe 3.4s ease-in-out infinite',
        'spin-slow':      'spin 3s linear infinite',
        'progress-indet': 'progressIndet 1.6s cubic-bezier(0.65, 0, 0.35, 1) infinite'
      },
      keyframes: {
        fadeIn:   { '0%': { opacity: 0 }, '100%': { opacity: 1 } },
        fadeUp:   {
          '0%':   { opacity: 0, transform: 'translateY(12px)' },
          '100%': { opacity: 1, transform: 'translateY(0)' }
        },
        slideIn:  {
          '0%':   { transform: 'translateX(24px)', opacity: 0 },
          '100%': { transform: 'translateX(0)',    opacity: 1 }
        },
        scaleIn:  {
          '0%':   { opacity: 0, transform: 'scale(0.96)' },
          '100%': { opacity: 1, transform: 'scale(1)' }
        },
        shimmer:  {
          '0%':   { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' }
        },
        pulseSoft: {
          '0%, 100%': { opacity: 1 },
          '50%':      { opacity: 0.55 }
        },
        breathe: {
          '0%, 100%': { transform: 'scale(1)' },
          '50%':      { transform: 'scale(1.04)' }
        },
        progressIndet: {
          '0%':   { transform: 'translateX(-100%) scaleX(0.6)' },
          '60%':  { transform: 'translateX(40%)   scaleX(0.9)' },
          '100%': { transform: 'translateX(120%)  scaleX(0.6)' }
        }
      },
      transitionTimingFunction: {
        snap:    'cubic-bezier(0.22, 1, 0.36, 1)',
        spring:  'cubic-bezier(0.34, 1.56, 0.64, 1)'
      }
    }
  },
  plugins: []
};
