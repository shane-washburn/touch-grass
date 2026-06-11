import type { ModuleManifest } from "@emoji/ui";

export const manifest: ModuleManifest = {
  id: "screaming-chicken",
  title: "Screaming Chicken",
  description:
    "A rubber chicken you can squeeze. Hold to compress, release to hear it scream. The deeper the squeeze, the bigger the scream.",
  emoji: "🐔",
  path: "/apps/screaming-chicken",
  status: "active",
  load: () => import("./ScreamingChickenPage"),
};
