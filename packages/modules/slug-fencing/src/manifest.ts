import type { ModuleManifest } from "@scroll-goblin/ui";

export const manifest: ModuleManifest = {
  id: "slug-fencing",
  title: "Slug Fencing",
  description:
    "A duel of two slimy duelists. Slide your slug up and down, then click to lunge. Land a hit on your rival to score — but mind your energy meter, because moving and lunging both drain it.",
  emoji: "🐌",
  path: "/apps/slug-fencing",
  status: "active",
  load: () => import("./SlugFencingPage"),
};
