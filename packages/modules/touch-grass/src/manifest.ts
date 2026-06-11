import type { ModuleManifest } from "@scroll-goblin/ui";

export const manifest: ModuleManifest = {
  id: "touch-grass",
  title: "Touch Grass",
  description:
    "Finally, a way to touch grass without going outside. Brush it, pat it, pluck it — it reacts.",
  emoji: "🌱",
  path: "/apps/touch-grass",
  status: "active",
  load: () => import("./TouchGrassPage"),
};
