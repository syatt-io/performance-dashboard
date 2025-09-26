/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        good: '#16a34a',
        'needs-improvement': '#d97706',
        poor: '#dc2626',
      },
    },
  },
  plugins: [require('@tailwindcss/typography')],
};