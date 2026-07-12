/** @type {import('tailwindcss').Config} */
export default {
  content: ['./web/index.html', './web/src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        conlang: ['"Iowan Old Style"', 'Palatino', 'Georgia', 'serif'],
      },
    },
  },
  plugins: [],
};
