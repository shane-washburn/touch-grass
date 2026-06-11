import type { ModuleManifest } from "@scroll-goblin/ui";

export const manifest: ModuleManifest = {
  id: "potato-painter",
  title: "Potato Painter",
  description:
    "Grab a spud, drag it onto the canvas, and stamp masterpieces. Every potato you use grows back different.",
  emoji: "🥔",
  path: "/apps/potato-painter",
  status: "active",
  load: () => import("./PotatoPainterPage"),
};
