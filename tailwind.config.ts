import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        canvas: "#F5F2F6",
        paper: "#FFFFFF",
        ink: "#340C46",
        muted: "#716677",
        rule: "#DED6E2",
        accent: {
          DEFAULT: "#340C46",
          soft: "#EEE8F1",
          ring: "#5D3470",
        },
        brand: {
          yellow: "#FDB940",
          "yellow-dark": "#C77D00",
          purple: "#6A538E",
          blue: "#143A84",
          mist: "#ECE8EF",
        },
        success: {
          DEFAULT: "#247A52",
          soft: "#EDF8F2",
        },
        danger: {
          DEFAULT: "#A62E3A",
          soft: "#FFF0F1",
        },
        method: {
          post: "#247A52",
          put:  "#C77D00",
          delete: "#A62E3A",
        },
      },
      fontFamily: {
        display: ["var(--font-sans)", "ui-sans-serif", "system-ui"],
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
