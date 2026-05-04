import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Cream / paper background — niet pure wit
        canvas: "#F8F4ED",
        paper: "#FBF8F2",
        ink: "#15140F",
        muted: "#6B6557",
        rule: "#E5DCC9",
        // Diepe aubergine accent — Irixs-paars maar refined
        accent: {
          DEFAULT: "#3A1F47",
          soft: "#F0E8EC",
          ring: "#5A3268",
        },
        method: {
          post: "#2D5A3A",     // diep groen
          put:  "#7A5821",     // mosterd/oker
          delete: "#7A2828",   // diep rood
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "Georgia", "serif"],
        sans:    ["var(--font-sans)", "ui-sans-serif", "system-ui"],
        mono:    ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      letterSpacing: {
        tightest: "-0.04em",
      },
    },
  },
  plugins: [],
};

export default config;
