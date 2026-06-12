/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{vue,js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        accent: {
          DEFAULT: '#6366f1',
          light: '#eef2ff',
        },
        wrong: {
          bg: '#fef2f2',
          border: '#fecaca',
          accent: '#ef4444',
        },
        correct: {
          bg: '#ecfdf5',
          border: '#a7f3d0',
          accent: '#10b981',
        },
      },
    },
  },
  plugins: [],
}
