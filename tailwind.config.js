/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Manrope', 'ui-sans-serif', 'system-ui'],
        display: ['Space Grotesk', 'Manrope', 'ui-sans-serif', 'system-ui'],
      },
      colors: {
        navy: '#0f2c52',
        denim: '#1b6ad5',
        slate: '#153661',
        mist: '#e5eef9',
      },
      boxShadow: {
        'nav-btn': '0 12px 28px rgba(27, 106, 213, 0.28)',
      },
      backgroundImage: {
        'hero-gradient': 'linear-gradient(180deg, #f6fbff 0%, #e5eef9 100%)',
      },
    },
  },
  plugins: [],
}
