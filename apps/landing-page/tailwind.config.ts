import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "../../packages/ui/src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        accent: {
          DEFAULT: '#36b625',
          50: '#f2fdf0',
          100: '#e2fbdd',
          200: '#c4f5bd',
          300: '#95ec89',
          400: '#60d94f',
          500: '#36b625',
          600: '#2a9f1a',
          700: '#237d18',
          800: '#1f6318',
          900: '#1c5116',
          950: '#092d06',
        },
      },
    },
  },
  plugins: [],
};

export default config;





















