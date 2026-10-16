/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          50: '#F0F4F8',
          100: '#D9E2EC',
          200: '#BCCCDC',
          500: '#334E68',
          700: '#1A365D',
          800: '#142A43',
          900: '#0E1D2E',
          DEFAULT: '#142A43',
        },
        teal: {
          50: '#E6F8F5',
          100: '#C2EFEB',
          400: '#2EC4B6',
          500: '#16A085',
          600: '#138D75',
          700: '#0E6655',
          DEFAULT: '#16A085',
        },
        surface: {
          bg: '#F3F6F8',
          card: '#FFFFFF',
          border: '#E1E7ED',
          borderHover: '#CBD5E1',
        },
        content: {
          primary: '#182230',
          secondary: '#667085',
          muted: '#98A2B3',
        },
        amber: {
          DEFAULT: '#D97706',
        },
        danger: {
          DEFAULT: '#DC2626',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      boxShadow: {
        subtle: '0 1px 3px 0 rgba(16, 24, 40, 0.06), 0 1px 2px 0 rgba(16, 24, 40, 0.04)',
        card: '0 2px 6px 0 rgba(20, 42, 67, 0.05), 0 1px 3px 0 rgba(20, 42, 67, 0.03)',
        modal: '0 20px 25px -5px rgba(20, 42, 67, 0.1), 0 10px 10px -5px rgba(20, 42, 67, 0.04)',
      },
    },
  },
  plugins: [],
}

