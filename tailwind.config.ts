import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Crypto neon colors
        'neon-cyan': '#00f5ff',
        'neon-purple': '#bf00ff',
        'neon-pink': '#ff00f5',
        'neon-blue': '#0066ff',
        'neon-green': '#00ff66',
        'neon-yellow': '#ffff00',
        // Dark backgrounds
        'dark': {
          900: '#0a0a0f',
          800: '#12121a',
          700: '#1a1a24',
          600: '#22222e',
          500: '#2a2a38',
        },
        // Gradient accents
        'accent': {
          primary: '#6366f1',
          secondary: '#8b5cf6',
          tertiary: '#a855f7',
        }
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
        'cyber-grid': `linear-gradient(rgba(99, 102, 241, 0.03) 1px, transparent 1px),
                       linear-gradient(90deg, rgba(99, 102, 241, 0.03) 1px, transparent 1px)`,
        'glow-gradient': 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #a855f7 100%)',
        'neon-gradient': 'linear-gradient(135deg, #00f5ff 0%, #bf00ff 50%, #ff00f5 100%)',
      },
      boxShadow: {
        'neon-cyan': '0 0 20px rgba(0, 245, 255, 0.5), 0 0 40px rgba(0, 245, 255, 0.2)',
        'neon-purple': '0 0 20px rgba(191, 0, 255, 0.5), 0 0 40px rgba(191, 0, 255, 0.2)',
        'neon-pink': '0 0 20px rgba(255, 0, 245, 0.5), 0 0 40px rgba(255, 0, 245, 0.2)',
        'neon-blue': '0 0 20px rgba(0, 102, 255, 0.5), 0 0 40px rgba(0, 102, 255, 0.2)',
        'glow': '0 0 30px rgba(99, 102, 241, 0.3)',
        'glow-lg': '0 0 60px rgba(99, 102, 241, 0.4)',
        'inner-glow': 'inset 0 0 30px rgba(99, 102, 241, 0.1)',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
        'float': 'float 6s ease-in-out infinite',
        'gradient': 'gradient 8s linear infinite',
        'scan': 'scan 2s linear infinite',
        'cyber-pulse': 'cyber-pulse 2s ease-in-out infinite',
        'border-flow': 'border-flow 3s linear infinite',
      },
      keyframes: {
        glow: {
          '0%': { boxShadow: '0 0 20px rgba(99, 102, 241, 0.4)' },
          '100%': { boxShadow: '0 0 40px rgba(139, 92, 246, 0.6)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-20px)' },
        },
        gradient: {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
        scan: {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100%)' },
        },
        'cyber-pulse': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.5' },
        },
        'border-flow': {
          '0%': { backgroundPosition: '0% 50%' },
          '100%': { backgroundPosition: '200% 50%' },
        },
      },
      fontFamily: {
        'mono': ['JetBrains Mono', 'Fira Code', 'monospace'],
        'display': ['Orbitron', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

export default config
