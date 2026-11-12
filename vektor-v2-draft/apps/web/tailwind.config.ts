import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        navy: { DEFAULT: "#101D35", 800: "#16264a", 700: "#1d3260", 600: "#26407a" },
        brand: { DEFAULT: "#246BFD", 600: "#1b57d6", 50: "#eaf1ff" },
        canvas: "#F5F7FB",
        ink: "#263449",
        muted: "#64748B",
        success: "#16A36A",
        warning: "#E49A26",
        critical: "#D94A4A",
        purple: { status: "#7c5cd6" },
      },
      fontFamily: { sans: ["var(--font-inter)", "system-ui", "sans-serif"] },
      borderRadius: { card: "14px" },
      boxShadow: { card: "0 1px 2px rgba(16,29,53,0.05), 0 1px 3px rgba(16,29,53,0.04)" },
    },
  },
  plugins: [],
};
export default config;
