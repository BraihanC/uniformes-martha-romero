/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#D50565',
        accent: '#EA5C2E',
        'bg-beige': '#FFF1E5',
        'bg-blue': '#C5D6EF',
      },
    },
  },
  plugins: [],
}
