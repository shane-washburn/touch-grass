/**
 * Post-build SEO generation, run after `vite build` (see package.json).
 *
 * From the module registry (single source of truth) it emits into dist/:
 *   - robots.txt     allow-all + explicit AI crawler welcome + sitemap pointer
 *   - sitemap.xml    landing, leaderboard, and every non-hidden module route
 *   - llms.txt       plain-markdown site summary for AI agents
 *   - <route>/index.html   a copy of the built shell per route with the
 *     title/description/canonical/OG tags rewritten, so crawlers that don't
 *     execute JS still see correct per-page metadata (Vercel serves these
 *     static files before the SPA rewrite kicks in).
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { MODULES } from "../src/modules/registry";
import {
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_URL,
  STATIC_PAGES,
  pageTitle,
} from "../src/seo/site";

const dist = resolve(dirname(fileURLToPath(import.meta.url)), "../dist");

interface Page {
  path: string;
  title: string;
  description: string;
}

const modulePages: Page[] = MODULES.filter((m) => m.status !== "hidden").map(
  (m) => ({ path: m.path, title: m.title, description: m.description })
);
const pages: Page[] = [...STATIC_PAGES, ...modulePages];

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

// --- robots.txt ---
const aiBots = ["GPTBot", "ClaudeBot", "PerplexityBot", "Google-Extended"];
writeFileSync(
  join(dist, "robots.txt"),
  [
    "User-agent: *",
    "Allow: /",
    "",
    ...aiBots.flatMap((bot) => [`User-agent: ${bot}`, "Allow: /", ""]),
    `Sitemap: ${SITE_URL}/sitemap.xml`,
    "",
  ].join("\n")
);

// --- sitemap.xml ---
writeFileSync(
  join(dist, "sitemap.xml"),
  [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...pages.map(
      (p) => `  <url><loc>${SITE_URL}${p.path === "/" ? "/" : p.path}</loc></url>`
    ),
    "</urlset>",
    "",
  ].join("\n")
);

// --- llms.txt ---
writeFileSync(
  join(dist, "llms.txt"),
  [
    `# ${SITE_NAME}`,
    "",
    `> ${SITE_DESCRIPTION}`,
    "",
    "## Apps",
    "",
    ...modulePages.map(
      (p) => `- [${p.title}](${SITE_URL}${p.path}): ${p.description}`
    ),
    "",
    "## Other pages",
    "",
    ...STATIC_PAGES.filter((p) => p.path !== "/").map(
      (p) => `- [${p.title}](${SITE_URL}${p.path}): ${p.description}`
    ),
    "",
  ].join("\n")
);

// --- per-route prerendered HTML shells ---
const shell = readFileSync(join(dist, "index.html"), "utf8");

function applyMeta(html: string, page: Page): string {
  const title = escapeHtml(pageTitle(page.title));
  const description = escapeHtml(page.description);
  const url = `${SITE_URL}${page.path === "/" ? "/" : page.path}`;
  let out = html
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${title}</title>`)
    .replaceAll(SITE_DESCRIPTION, description)
    .replace(/(rel="canonical" href=")[^"]*(")/, `$1${url}$2`)
    .replace(/(property="og:url"[\s\S]*?content=")[^"]*(")/, `$1${url}$2`)
    .replace(/(property="og:title"[\s\S]*?content=")[^"]*(")/, `$1${title}$2`)
    .replace(/(name="twitter:title"[\s\S]*?content=")[^"]*(")/, `$1${title}$2`);

  // Per-app pages carry WebApplication schema; the home page keeps WebSite.
  if (page.path !== "/") {
    out = out.replace(
      "</head>",
      `<script type="application/ld+json">${JSON.stringify({
        "@context": "https://schema.org",
        "@type": "WebApplication",
        name: pageTitle(page.title),
        url,
        description: page.description,
        applicationCategory: "EntertainmentApplication",
        operatingSystem: "Web",
        isPartOf: { "@type": "WebSite", name: SITE_NAME, url: `${SITE_URL}/` },
      })}</script></head>`
    );
  }
  return out;
}

/** A crawlable link list of every app, used for internal linking. */
function appList(exclude?: string): string {
  return modulePages
    .filter((m) => m.path !== exclude)
    .map(
      (m) =>
        `<li><a href="${m.path}"><strong>${escapeHtml(
          m.title
        )}</strong> \u2014 ${escapeHtml(m.description)}</a></li>`
    )
    .join("");
}

/**
 * Readable HTML injected into #root. React's createRoot() replaces it on
 * load, so users get the live app while no-JS crawlers and LLMs keep this
 * static content (and follow its internal links to discover every page).
 */
function renderBody(page: Page): string {
  if (page.path === "/") {
    return (
      `<main class="mx-auto max-w-4xl px-4 py-8">` +
      `<h1 class="font-heading text-4xl uppercase">${escapeHtml(SITE_NAME)}</h1>` +
      `<p class="mt-3 font-bold">${escapeHtml(SITE_DESCRIPTION)}</p>` +
      `<h2 class="mt-6 font-heading text-2xl uppercase">Apps</h2>` +
      `<ul>${appList()}` +
      `<li><a href="/leaderboard"><strong>Leaderboard</strong> \u2014 ` +
      `${escapeHtml(STATIC_PAGES[1].description)}</a></li></ul>` +
      `</main>`
    );
  }
  return (
    `<main class="mx-auto max-w-4xl px-4 py-8">` +
    `<h1 class="font-heading text-4xl uppercase">${escapeHtml(page.title)}</h1>` +
    `<p class="mt-3 font-bold">${escapeHtml(page.description)}</p>` +
    `<p class="mt-4"><a href="/">${escapeHtml(SITE_NAME)} home</a></p>` +
    `<h2 class="mt-6 font-heading text-2xl uppercase">More apps</h2>` +
    `<ul>${appList(page.path)}</ul>` +
    `</main>`
  );
}

function prerender(page: Page): string {
  return applyMeta(shell, page).replace(
    '<div id="root"></div>',
    `<div id="root">${renderBody(page)}</div>`
  );
}

for (const page of pages) {
  if (page.path === "/") {
    writeFileSync(join(dist, "index.html"), prerender(page));
    continue;
  }
  const dir = join(dist, ...page.path.split("/").filter(Boolean));
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "index.html"), prerender(page));
}

console.log(
  `[generate-seo] wrote robots.txt, sitemap.xml, llms.txt and ${pages.length} prerendered pages (incl. home) to dist/`
);
