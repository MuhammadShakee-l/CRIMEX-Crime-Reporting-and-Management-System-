import defaultTheme from 'tailwindcss/defaultTheme'
import plugin from 'tailwindcss/plugin'

export default {
  content: [
    './index.html',
    './src/**/*.{js,jsx,ts,tsx}'
  ],
  darkMode: 'class',
  theme: {
    extend: {
      spacing: {
        18: '4.5rem' // enables h-18, w-18, etc.
      },
      fontFamily: {
        sans: ['Inter', ...defaultTheme.fontFamily.sans],
        display: ['Poppins', 'Inter', ...defaultTheme.fontFamily.sans]
      },
      colors: {
        greenbrand: {
          primary: '#06C167',
          dark: '#04904C',
          light: '#5FE8AC',
          glow: '#2EE68F',
          lime: '#A3FF47'
        },
        base: {
          bg: '#0F1A17',
          canvas: '#13221D',
          panel: '#182B25',
          panelAlt: '#1F342B',
          border: '#1F3B31',
          stroke: '#27493D',
          text: '#E9F7F0',
          muted: '#88A79A'
        },
        semantic: {
          danger: '#EF4444',
          warning: '#F59E0B',
          info: '#36A3F7',
          success: '#10B981'
        }
      },
      boxShadow: {
        depth: '0 8px 28px -6px rgba(0,0,0,0.55), 0 2px 6px -1px rgba(0,0,0,0.4)',
        soft: '0 4px 16px -4px rgba(0,0,0,0.45)',
        borderGlow: '0 0 0 1px rgba(46,230,143,0.35), 0 0 0 4px rgba(46,230,143,0.15)',
        focusEmerald: '0 0 0 3px rgba(6,193,103,0.45)'
      },
      backgroundImage: {
        'hero-grid': 'radial-gradient(circle at 20% 25%, rgba(6,193,103,0.35) 0%, rgba(19,34,29,0.92) 55%, #0F1A17 100%)',
        'panel-grad': 'linear-gradient(140deg,#182B25 0%,#1F342B 60%,#13221D 100%)',
        'chip-grad': 'linear-gradient(120deg,#06C167 0%,#5FE8AC 100%)',
        'glow-soft': 'linear-gradient(140deg,#13221D 0%,#182B25 55%,#1F342B 100%)'
      },
      keyframes: {
        fadeLift: {
          '0%': { opacity: 0, transform: 'translateY(14px) scale(.96)' },
          '100%': { opacity: 1, transform: 'translateY(0) scale(1)' }
        },
        pulseGlow: {
          '0%': { boxShadow: '0 0 0 0 rgba(6,193,103,0.5)' },
          '70%': { boxShadow: '0 0 0 10px rgba(6,193,103,0)' },
          '100%': { boxShadow: '0 0 0 0 rgba(6,193,103,0)' }
        },
        shimmer: {
          '0%': { backgroundPosition: '0% 50%' },
          '100%': { backgroundPosition: '100% 50%' }
        }
      },
      animation: {
        fadeLift: 'fadeLift .55s cubic-bezier(.16,.8,.3,1)',
        pulseGlow: 'pulseGlow 2.5s infinite',
        shimmer: 'shimmer 6s linear infinite'
      }
    }
  },
  plugins: [
    plugin(({ addComponents, addUtilities }) => {
      addComponents({
        '.glass': {
          background: 'linear-gradient(145deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))',
          backdropFilter: 'blur(14px)'
        }
      })
      addUtilities({
        '.no-scrollbar': {
          '::-webkit-scrollbar': { display: 'none' },
          '-ms-overflow-style': 'none',
          'scrollbar-width': 'none'
        }
      })
    })
  ]
}