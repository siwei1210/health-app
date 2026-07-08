import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // App palette — dark, StrongLifts-inspired
        ink: "#000000",
        surface: "#1c1c1e",
        "surface-2": "#2c2c2e",
        hair: "#38383a",
        accent: "#ff3b30", // red used for active set / highlights
        gold: "#ffb02e",
        muted: "#8e8e93",
      },
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "Helvetica",
          "Arial",
          "sans-serif",
        ],
      },
    },
  },
  plugins: [],
};

export default config;
