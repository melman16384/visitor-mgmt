export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Mulish', 'sans-serif'],
      },
      colors: {
        abat: {
          dunkelgrau: '#53565A',
          hellgrau: '#C8C9C7',
          grau: '#6B7A8D',
          blau: '#004B87',
          hellblau: '#00A3E0',
          lichtblau: '#9ADBE8',
        },
        primary: {
          50:  '#e6eef6',
          100: '#ccdded',
          200: '#99bbdb',
          300: '#6699c9',
          400: '#3377b7',
          500: '#004B87',
          600: '#003f72',
          700: '#00335d',
          800: '#002748',
          900: '#001b33',
        },
      },
    },
  },
  plugins: [],
}
