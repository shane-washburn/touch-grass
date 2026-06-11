import type { Config } from "tailwindcss";

/**
 * Shared design tokens for every app/module in the suite.
 * Apps consume this via `presets: [preset]` in their tailwind.config.ts, so
 * changing a token here restyles the whole suite at once.
 */
const preset = {
  theme: {
    extend: {
      fontFamily: {
        sans: ["Space Mono", "Courier New", "monospace"],
        body: ["Space Mono", "Courier New", "monospace"],
        heading: ["Archivo Black", "Impact", "sans-serif"],
      },
      colors: {
        brand: {
          primary: "#39FF14",
          secondary: "#00BFFF",
          tertiary: "#8B4513",
          background: "#FFFFFF",
          surface: "#EAEAEA",
          text: "#000000",
          border: "#000000",
          alert: "#FF003C",
          warning: "#FFEA00",
          pink: "#FF6EC7",
          orange: "#FF9100",
          purple: "#B388FF",
        },
        acid: "#39FF14",
        sky: "#00BFFF",
        zine: {
          white: "#FFFFFF",
          surface: "#EAEAEA",
          black: "#000000",
          alert: "#FF003C",
          warning: "#FFEA00",
        },
      },
      borderWidth: {
        thin: "2px",
        thick: "4px",
        massive: "8px",
      },
      borderRadius: {
        neobrutal: "4px",
      },
      boxShadow: {
        "neo-sm": "2px 2px 0px 0px #000000",
        "neo-md": "4px 4px 0px 0px #000000",
        "neo-lg": "8px 8px 0px 0px #000000",
        "neo-pressed": "0px 0px 0px 0px #000000",
      },
      spacing: {
        bento: "16px",
      },
      fontSize: {
        brainrot: "4rem",
      },
    },
  },
} satisfies Partial<Config>;

export default preset;
