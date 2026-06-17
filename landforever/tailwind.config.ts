import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Cobalt + Bone visual language
        ink: { DEFAULT: "#0a1a3f", deep: "#06112b", light: "#1a2f5c" },
        bone: { DEFAULT: "#f4f1ea", soft: "#faf9f5", dim: "#e9e4d8" },
        cobalt: { DEFAULT: "#2347d9", light: "#4a6aff", dark: "#1a35a8" },
        paper: "#faf9f5",
        // Legacy aliases mapped to the new palette so older class names keep working
        forest: { DEFAULT: "#0a1a3f", deep: "#06112b", light: "#1a2f5c", "2": "#1a2f5c" },
        cream: { DEFAULT: "#f4f1ea", "2": "#faf9f5" },
        gold: { DEFAULT: "#2347d9", light: "#4a6aff", dark: "#1a35a8" },
        offwhite: "#faf9f5",
        sand: "#e9e4d8",
      },
      fontFamily: {
        display: ["var(--font-geist-sans)", "system-ui", "sans-serif"],
        sans: ["var(--font-geist-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "monospace"],
      },
    },
  },
  plugins: [],
};
export default config;
