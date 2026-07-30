/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Segoe UI Variable', 'Segoe UI', 'Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      colors: {
        primary: {
          DEFAULT: 'var(--color-primary, #0d7676)',
          50: '#f0fdfa',
          100: '#ccfbf1',
          200: '#99f6e4',
          500: '#14b8a6',
          600: '#0d9488',
          700: '#0f766e',
          800: '#115e59',
          900: '#134e4a',
          hover: 'var(--color-primary-hover, #0f766e)',
        },
        navy: {
          DEFAULT: 'var(--color-navy, #0f2b48)',
          dark: '#0a1e33',
        },
        teal: {
          DEFAULT: 'var(--color-teal, #00a389)',
          light: '#e0f2fe',
        },
        cream: {
          DEFAULT: 'var(--color-cream-bg, #faf6ee)',
          light: '#fbf9f4',
        }
      },
      boxShadow: {
        'xs': '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
        '2xs': '0 1px 1px 0 rgba(0, 0, 0, 0.03)',
        'card': '0 2px 10px -2px rgba(0, 0, 0, 0.04), 0 1px 3px -1px rgba(0, 0, 0, 0.02)',
        'card-hover': '0 10px 25px -5px rgba(0, 0, 0, 0.08), 0 8px 10px -6px rgba(0, 0, 0, 0.03)',
      }
    },
  },
  plugins: [],
}
