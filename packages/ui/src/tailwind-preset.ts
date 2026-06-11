import type { Config } from "tailwindcss";
import colors from "tailwindcss/colors";

/**
 * Shared design tokens for every app/module in the suite.
 * Apps consume this via `presets: [preset]` in their tailwind.config.ts, so
 * changing a token here restyles the whole suite at once.
 */
const preset = {
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      colors: {
        // Semantic alias: use `brand-*` instead of hardcoding a palette so the
        // suite's accent color can change in one place.
        brand: colors.indigo,
      },
    },
  },
} satisfies Partial<Config>;

export default preset;
