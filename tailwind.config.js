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
        primary: '0 6px 22px rgba(254, 198, 65, 0.5)',
        'primary-glow': '0 6px 20px rgba(254, 198, 65, 0.5)',
        'primary-glow-dark': '0 3px 12px rgba(254, 198, 65, 0.2)',
        'primary-glow-hover': '0 8px 26px rgba(254, 198, 65, 0.55)',
        'primary-glow-hover-dark': '0 5px 18px rgba(254, 198, 65, 0.28)',
      },
    },
  },
  plugins: [],
}
