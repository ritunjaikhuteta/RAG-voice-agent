/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#05060a',
          900: '#0a0c14',
          850: '#0e111b',
          800: '#131726',
          750: '#181d2f',
          700: '#1f2540',
          600: '#2a3155',
        },
        brand: {
          50: '#ecfdff',
          100: '#cff7fe',
          200: '#a4eefc',
          300: '#6ce2f8',
          400: '#22d3ee',
          500: '#06b6d4',
          600: '#0891b2',
          700: '#0e7490',
          800: '#155e75',
          900: '#164e63',
        },
        accent: {
          400: '#a78bfa',
          500: '#8b5cf6',
        },
        emerald: {
          400: '#34d399',
          500: '#10b981',
        },
        amber: {
          400: '#fbbf24',
          500: '#f59e0b',
        },
        rose: {
          400: '#fb7185',
          500: '#f43f5e',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      boxShadow: {
        glow: '0 0 40px -10px rgba(34, 211, 238, 0.45)',
        'glow-lg': '0 0 80px -15px rgba(34, 211, 238, 0.6)',
        'glow-emerald': '0 0 40px -10px rgba(52, 211, 153, 0.5)',
        'glow-amber': '0 0 40px -10px rgba(251, 191, 36, 0.5)',
        'glow-rose': '0 0 40px -10px rgba(251, 113, 133, 0.5)',
        'inner-soft': 'inset 0 1px 0 0 rgba(255,255,255,0.05)',
      },
      backgroundImage: {
        'grid-faint':
          'linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)',
        'radial-glow':
          'radial-gradient(60% 60% at 50% 0%, rgba(34,211,238,0.12) 0%, transparent 70%)',
      },
      backgroundSize: {
        grid: '44px 44px',
      },
      keyframes: {
        'pulse-ring': {
          '0%': { transform: 'scale(0.9)', opacity: '0.7' },
          '100%': { transform: 'scale(1.6)', opacity: '0' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-6px)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      animation: {
        'pulse-ring': 'pulse-ring 2s cubic-bezier(0.4,0,0.6,1) infinite',
        float: 'float 4s ease-in-out infinite',
        shimmer: 'shimmer 2.5s linear infinite',
      },
    },
  },
  plugins: [],
};
