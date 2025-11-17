/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        frost: '#eef2ff',
      },
      boxShadow: {
        glass: '0 20px 45px rgba(15, 23, 42, 0.35)',
      },
      backdropBlur: {
        glass: '12px',
      },
    },
  },
  plugins: [],
}
