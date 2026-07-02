/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        dark: {
          bg: '#0F172A',      // Slate 900
          card: '#1E293B',    // Slate 800
          border: '#334155',  // Slate 700
          hover: '#475569',   // Slate 600
          text: '#F8FAFC',    // Slate 50
          textMuted: '#94A3B8'// Slate 400
        },
        brand: {
          primary: '#10B981', // Emerald 500 (neon green for champion/winners)
          secondary: '#3B82F6',// Blue 500 (for secondary actions/borders)
          accent: '#EC4899',   // Pink 500 (accents)
          gold: '#F59E0B'      // Amber 500
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
