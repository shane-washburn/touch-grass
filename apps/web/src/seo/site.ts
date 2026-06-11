/**
 * Single source of truth for site-wide SEO metadata. Consumed at runtime by
 * RouteMeta (per-route head tags) and at build time by scripts/generate-seo.mts
 * (sitemap, robots, llms.txt, prerendered route HTML).
 */
export const SITE_URL = "https://scrollgoblin.fun";

export const SITE_NAME = "Scroll Goblin";

export const SITE_DESCRIPTION =
  "A suite of gloriously pointless AI-powered mini-apps: translate text to emoji, touch virtual grass, scream at a chicken, commune with god, and paint potatoes.";

export const OG_IMAGE = `${SITE_URL}/scroll-goblin-mascot.png`;

/** Static (non-module) routes that should appear in the sitemap. */
export const STATIC_PAGES = [
  { path: "/", title: SITE_NAME, description: SITE_DESCRIPTION },
  {
    path: "/leaderboard",
    title: `Leaderboard — ${SITE_NAME}`,
    description:
      "Global leaderboard of the most-visited and most-poked Scroll Goblin mini-apps.",
  },
];

/** "Touch Grass — Scroll Goblin" for module pages, plain site name for home. */
export function pageTitle(title: string): string {
  return title === SITE_NAME ? SITE_NAME : `${title} — ${SITE_NAME}`;
}
