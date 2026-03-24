/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{html,ts}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef9ff',
          100: '#d8f0ff',
          500: '#1f8ef1',
          700: '#1564ab',
          900: '#0f3b64'
        },
        punch: {
          500: '#ff6f1f',
          700: '#c44d0d'
        }
      },
      fontFamily: {
        display: ['Sora', 'Segoe UI', 'sans-serif'],
        body: ['Manrope', 'Segoe UI', 'sans-serif']
      },
      boxShadow: {
        brutal: '6px 6px 0 0 rgb(21 39 65 / 0.35)',
        card: '0 20px 50px rgb(15 31 50 / 0.16)'
      },
      keyframes: {
        floatIn: {
          '0%': { opacity: 0, transform: 'translateY(18px)' },
          '100%': { opacity: 1, transform: 'translateY(0)' }
        }
      },
      animation: {
        floatIn: 'floatIn 480ms ease-out both'
      }
    }
  },
  plugins: []
};

