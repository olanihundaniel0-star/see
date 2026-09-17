/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
    "./lib/**/*.{js,jsx,ts,tsx}"
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        black: "#000000",
        zincglass: {
          950: "rgba(9, 9, 11, 0.60)",
          900: "rgba(24, 24, 27, 0.45)",
          800: "rgba(39, 39, 42, 0.30)"
        }
      },
      fontFamily: {
        sans: ["SpaceGrotesk_400Regular", "System"],
        "sans-medium": ["SpaceGrotesk_500Medium", "System"],
        "sans-semibold": ["SpaceGrotesk_600SemiBold", "System"],
        "sans-bold": ["SpaceGrotesk_700Bold", "System"],
        mono: ["SpaceMono_400Regular", "Courier New", "monospace"],
        "mono-bold": ["SpaceMono_700Bold", "Courier New", "monospace"]
      },
      boxShadow: {
        glass: "0 0 0 1px rgba(255,255,255,0.10), 0 20px 40px -20px rgba(0,0,0,0.85)"
      }
    }
  },
  plugins: []
};
