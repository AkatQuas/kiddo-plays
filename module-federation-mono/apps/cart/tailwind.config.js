/** @type {import('tailwindcss').Config} */
const path = require('path');

module.exports = {
  content: [
    './src/**/*.{ts,tsx}',
    './public/index.html',
    path.resolve(__dirname, '../../packages/ui/src/**/*.{ts,tsx}'),
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};
