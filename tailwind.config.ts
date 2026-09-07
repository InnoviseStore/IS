import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      animation: {
        'pulse-slow': 'pulse-slow 9s ease-in-out infinite',
        'float-slow': 'float-slow 12s ease-in-out infinite',
      },
      keyframes: {
        'pulse-slow': {
          '0%, 100%': { opacity: '0.45', transform: 'scale(1)' },
          '50%': { opacity: '0.65', transform: 'scale(1.08)' },
        },
        'float-slow': {
          '0%, 100%': { transform: 'translateY(0px) translateX(0px)' },
          '33%': { transform: 'translateY(-24px) translateX(16px)' },
          '66%': { transform: 'translateY(16px) translateX(-12px)' },
        },
      },
      backdropBlur: {
        xs: '2px',
        '4xl': '72px',
      },
    },
  },
  plugins: [],
}

export default config
