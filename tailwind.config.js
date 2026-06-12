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
          bg: '#f0fdf4',
          border: '#bbf7d0',
          accent: '#22c55e',
        },
      },
    },
  },
  plugins: [],
}
