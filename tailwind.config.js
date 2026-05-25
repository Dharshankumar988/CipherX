/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        cyber: {
          neon: '#4ade80',    // Neon green/teal from the image
          bg: '#0A0D10',      // Deep dark background
          card: '#161C24',    // Solid dark card surface
          accent: '#39ff14',  // Bright glowing green
          secondary: '#475569', // Slate gray for inactive icons
          text: '#f8fafc'     // Crisp white text
        }
      }
    },
  },
  plugins: [],
}
