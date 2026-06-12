import type { ModuleManifest } from "@scroll-goblin/ui";

export const manifest: ModuleManifest = {
  id: "balloon-blower",
  title: "Balloon Blower",
  description:
    "Blow into your microphone to inflate a balloon on screen — the harder you blow, the faster it fills. Tie it off in time to bank a balloon, or keep blowing past full and watch it explode. Counts every balloon filled and popped on the global leaderboard. A hands-free, mouth-powered browser toy.",
  emoji: "🎈",
  path: "/apps/balloon-blower",
  status: "active",
  load: () => import("./BalloonBlowerPage"),
};
