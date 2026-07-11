import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // Semantic tokens driven by CSS variables (see globals.css). Each is an
        // RGB channel triplet so Tailwind opacity modifiers (bg-ink/95) work.
        ink: "rgb(var(--ink) / <alpha-value>)", // page background
        fg: "rgb(var(--fg) / <alpha-value>)", // primary text
        surface: "rgb(var(--surface) / <alpha-value>)", // cards
        "surface-2": "rgb(var(--surface-2) / <alpha-value>)", // nested
        hair: "rgb(var(--hair) / <alpha-value>)", // hairline borders
        accent: "rgb(var(--accent) / <alpha-value>)", // red highlights
        gold: "rgb(var(--gold) / <alpha-value>)",
        muted: "rgb(var(--muted) / <alpha-value>)", // secondary text
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
