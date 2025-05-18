import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    '../../packages/ui/src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        accent: {
          DEFAULT: '#db7518',
          50: '#fdf6ef',
          100: '#fbe8d8',
          200: '#f5ccad',
          300: '#eeaa77',
          400: '#e48a42',
          500: '#db7518',
          600: '#b85d13',
          700: '#944713',
          800: '#783816',
          900: '#632f15',
          950: '#391708',
        },
      },
    },
  },
  plugins: [],
}

export default config 