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
        primary: '#f9f506',
        'background-light': '#f8f8f5',
        'background-dark': '#23220f',
        'card-dark': '#1a190b',
        'surface-light': '#f4f4e6',
        'surface-dark': '#2d2c14',
        'border-light': '#e9e8ce',
        'border-dark': '#3a391a',
        'text-secondary': '#9e9d47',
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
        primary: '0 10px 30px rgba(249, 245, 6, 0.4)',
      },
    },
  },
  plugins: [],
}
