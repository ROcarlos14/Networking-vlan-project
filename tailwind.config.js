/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        vlan: {
          1: '#FF6B6B',
          2: '#4ECDC4',
          3: '#45B7D1',
          4: '#96CEB4',
          5: '#FECA57',
          6: '#FF9FF3',
          7: '#54A0FF',
          8: '#5F27CD',
        },
        device: {
          switch: '#34495e',
          router: '#e74c3c',
          pc: '#3498db',
          server: '#2ecc71',
        },
      },
    },
  },
  plugins: [],
}

