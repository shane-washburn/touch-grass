import type { Config } from "tailwindcss";
import preset from "../../packages/ui/src/tailwind-preset";

export default {
  presets: [preset],
  content: [
    "./index.html",
    "./src/**/*.{ts,tsx}",
    "../../packages/ui/src/**/*.{ts,tsx}",
    "../../packages/modules/*/src/**/*.{ts,tsx}",
  ],
  plugins: [],
} satisfies Config;
