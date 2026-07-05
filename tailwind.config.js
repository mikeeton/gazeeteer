/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#151819',
        mist: '#f5f7f8',
        teal: '#0f8b8d',
        coral: '#e76f51',
        gold: '#f4a261',
      },
      boxShadow: {
        panel: '0 18px 45px rgba(21, 24, 25, 0.22)',
      },
    },
  },
  plugins: [],
};
