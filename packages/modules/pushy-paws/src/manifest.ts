import type { ModuleManifest } from "@scroll-goblin/ui";

export const manifest: ModuleManifest = {
  id: "pushy-paws",
  title: "Pushy Paws",
  description:
    "A free browser cat game where an orange cream cat swats weighted mugs, spellbooks, potions, and rare hazards off a shelf. Every pushed-off item adds to the leaderboard with distinct crash, splash, squeak, or magic sounds.",
  emoji: "🐈",
  path: "/apps/pushy-paws",
  status: "active",
  load: () => import("./PushyPawsPage"),
};
