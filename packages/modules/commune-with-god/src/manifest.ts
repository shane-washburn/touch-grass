import type { ModuleManifest } from "@scroll-goblin/ui";

export const manifest: ModuleManifest = {
  id: "commune-with-god",
  title: "Commune with God",
  description:
    "Ask the divine anything. A benevolent, non-denominational AI oracle answers with kindness, love, and support.",
  emoji: "🔮",
  path: "/apps/commune-with-god",
  status: "active",
  load: () => import("./CommuneWithGodPage"),
};
