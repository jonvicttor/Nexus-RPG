/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        rpgBg: '#0b0b14',     // Fundo profundo
        rpgPanel: '#16213e',  // Painéis laterais
        rpgAccent: '#e94560', // Vermelho "Cellbit" para botões/críticos
        rpgText: '#e0e0e0',
      },
      fontFamily: {
        mono: ['Roboto Mono', 'monospace'],
        sans: ['Montserrat', 'sans-serif'],
      }
    },
  },
  plugins: [],
}