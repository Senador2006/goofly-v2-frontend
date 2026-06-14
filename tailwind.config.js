/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: '#FEC641',
        foreground: '#111111',
        'background-light': '#F5F5F5',
        'background-dark': '#111111',
        'card-dark': '#161616',
        'surface-light': '#FFFFFF',
        'surface-dark': '#1A1A1A',
        'border-light': '#E5E5E5',
        'border-dark': '#2A2A2A',
        'text-secondary': '#6B6B6B',
        goofy: {
          yellow: '#FEC641',
          gray: '#F5F5F5',
          white: '#FFFFFF',
          black: '#111111',
        },
      },
      fontFamily: {
        display: ['Plus Jakarta Sans', 'sans-serif'],
      },
      borderRadius: {
        DEFAULT: '1rem',
        lg: '2rem',
        xl: '3rem',
        full: '9999px',
      },
      boxShadow: {
        primary: '0 10px 30px rgba(254, 198, 65, 0.4)',
        'primary-glow': '0 2px 10px rgba(254, 198, 65, 0.14)',
        'primary-glow-hover': '0 4px 14px rgba(254, 198, 65, 0.2)',
      },
    },
  },
  plugins: [],
}
