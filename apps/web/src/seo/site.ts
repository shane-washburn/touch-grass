/**
 * Single source of truth for site-wide SEO metadata. Consumed at runtime by
 * RouteMeta (per-route head tags) and at build time by scripts/generate-seo.mts
 * (sitemap, robots, llms.txt, prerendered route HTML).
 */
export const SITE_URL = "https://scrollgoblin.fun";

export const SITE_NAME = "Scroll Goblin";

export const SITE_DESCRIPTION =
  "A suite of gloriously pointless AI-powered mini-apps: translate text to emoji, touch virtual grass, squeeze a screaming chicken, commune with god, paint potatoes, fence with slugs, and blow up balloons with your voice.";

export const OG_IMAGE = `${SITE_URL}/scroll-goblin-mascot.png`;

/**
 * A short "about" paragraph and a set of plain-fact statements. These exist
 * specifically to answer the questions crawlers and LLMs ask but cannot infer
 * from an interactive app: what it is, whether it needs an account, whether
 * it involves crypto/payments, etc. Surfaced in the prerendered HTML body and
 * in llms.txt.
 */
export const SITE_ABOUT =
  "Scroll Goblin is a free collection of silly, interactive browser toys powered by AI. Each mini-app does one absurd thing well — there is nothing to install and nothing to learn. Just open one and start poking.";

export const SITE_FACTS = [
  "Free to use — no account, sign-up, login, or email required.",
  "No ads, no crypto, no wallet, no payments, and no tracking beyond basic anonymous visit counts.",
  "Everything runs in your web browser; nothing to download or install.",
  "The AI-powered apps (Emoji Translator, Commune with God) send your input to a language model and return a playful response.",
  "A global leaderboard ranks the apps by how often they are visited and poked.",
  "Built purely for fun — it is a novelty entertainment site, not a tool, product, or service.",
];

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
