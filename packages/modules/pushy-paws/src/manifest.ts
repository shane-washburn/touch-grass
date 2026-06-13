import type { ModuleManifest } from "@scroll-goblin/ui";

export const manifest: ModuleManifest = {
  id: "pushy-paws",
  title: "Pushy Paws",
  description:
    "Play as an orange cat with one goal: shove everything off the shelf. Heavy mugs, magic junk, and squeaky toys all fall differently.",
  emoji: "🐈",
  path: "/apps/pushy-paws",
  status: "active",
  load: () => import("./PushyPawsPage"),
};
