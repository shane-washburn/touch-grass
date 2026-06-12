# Scroll Goblin

**Scroll Goblin** (`scroll-goblin`) is a growing collection of mini apps, games,
and activities ("**modules**") served
from a single landing page.

**Live:** [scrollgoblin.fun](https://scrollgoblin.fun) (frontend) ·
[scrollgoblinapi.vercel.app/api](https://scrollgoblinapi.vercel.app/api) (backend)

Current modules:

| Module | What it does |
|--------|--------------|
| 😀 **Emoji Translator** | Translate between human language and emoji in both directions, powered by an LLM. |
| 🌱 **Touch Grass** | Finally, a way to touch grass without going outside. Brush it, pluck it, water it — it reacts (and sounds like it). |
| 🐔 **Screaming Chicken** | A rubber chicken you can squeeze. Hold to compress, release to hear it scream. |
| 🔮 **Commune with God** | Ask the divine anything. A benevolent, non-denominational AI oracle answers with kindness. |
| 🥔 **Potato Painter** | Grab a spud, drag it onto the canvas, and stamp masterpieces. Every potato grows back different. |
| 🐌 **Slug Fencing** | A duel of two slimy duelists. Slide your slug up and down, lunge to strike, and manage your energy meter. |
| 🎈 **Balloon Blower** | Blow into your microphone to inflate a balloon. Tie it off in time to bank it — or push past full and pop it. |

There's also a suite-wide **Leaderboard** (`/leaderboard`) showing combined
interaction totals and per-module visits across all users, backed by Upstash
Redis.

Built as a **decoupled monorepo** so the shell, backend, modules, and LLM
provider are each independently swappable — and so the suite scales
horizontally: adding a module never touches another module's code.

```
scroll-goblin/
├── apps/
│   ├── web/                  # The SHELL: landing page, router, global chrome
│   └── api/                  # Hono backend: per-module routers + shared infra
└── packages/
    ├── shared/               # Zod schemas + TS types (API contracts)
    ├── ui/                   # Design system + shared infra: Tailwind preset, Card/Button,
    │                         #   ModuleManifest type, stat tracking, share links, audio bus + MuteButton
    └── modules/
        ├── emoji-translator/ # One package per module (UI + manifest + API client)
        ├── touch-grass/
        ├── screaming-chicken/
        ├── commune-with-god/
        ├── potato-painter/
        ├── slug-fencing/
        └── balloon-blower/
```

## Architecture

```
                    ┌─ Shell (apps/web) ────────────┐
  Landing page ──▶  │  module registry → lazy routes  │
                    └─────┬────────────────────────┘
                          │ loads @scroll-goblin/module-* chunks on demand
                          ▼
  Module UI  --HTTP/JSON-->  API (Hono)  /api/<module-id>/...  -->  LLM (Gemini)
        |                          |
        +---- @scroll-goblin/shared (Zod contract) ----+
```

- **Registry-driven:** the shell discovers modules only through
  `apps/web/src/modules/registry.ts`. The landing page cards and routes are
  generated from each module's `ModuleManifest` — no shell changes per module.
- **Code-split:** every module is lazy-loaded into its own chunk, so the
  landing page bundle stays small no matter how many modules exist.
- **Namespaced API:** each module's backend routes mount at
  `/api/<module-id>/...` via the router registry in `apps/api/src/app.ts`.
  Modules can't collide, and per-module usage is easy to trace.
- **Unified styling:** `@scroll-goblin/ui` owns the design tokens (Tailwind preset with
  the `brand-*` palette) and common components. Modules never hardcode one-off
  colors — restyle the suite in one place.
- **Decoupled:** module UIs only know `VITE_API_BASE_URL` plus the shared
  contract. Frontend-only modules (like Touch Grass) need no backend at all.
- **Provider-agnostic:** the backend uses the **Vercel AI SDK**. Default is
  **Google Gemini**; switch via `AI_PROVIDER` env (see `apps/api/src/ai.ts`).
- **Secure:** LLM API keys live only in the backend, never in the browser.
- **Cached:** identical LLM requests are served from an in-memory cache.
- **Stats:** modules report interactions via the batched tracker in
  `@scroll-goblin/ui` (`trackStat`); the API aggregates them in Upstash Redis
  and serves the leaderboard at `/api/stats/v1/leaderboard`.
- **Sound:** all sound effects are synthesized live with the Web Audio API —
  zero audio asset files. `@scroll-goblin/ui` provides the shared plumbing
  (`getAudioBus`: lazy AudioContext + master gain, `getNoiseBuffer`, and a
  persisted global mute with a `MuteButton` component); each module composes
  its own sounds in a local `sounds.ts` (lunges and splats in Slug Fencing,
  rustle/droplets in Touch Grass, hiss/creak/pop in Balloon Blower, stamps in
  Potato Painter, the chicken's scream). Muting in any module silences the
  whole suite. Continuous loops start only on user interaction, per browser
  autoplay policy.
- **Share links:** modules can capture their state into a compact
  URL-encoded snapshot (`ShareButton` + `consumeShareSnapshot` in
  `@scroll-goblin/ui`) so users share their grass patch, potato art, or duel
  score; links self-clean on load.
- **SEO & AI discoverability:** `apps/web/src/seo/site.ts` is the single
  source of truth for site metadata. At runtime, `RouteMeta` keeps per-route
  title/description/canonical/OG tags in sync; at build time,
  `apps/web/scripts/generate-seo.mts` (runs automatically after `vite build`)
  emits `robots.txt` (with explicit AI-crawler allowances), `sitemap.xml`,
  `llms.txt`, and a prerendered static HTML shell per route — with JSON-LD
  structured data and a crawlable app list — so no-JS crawlers and LLM agents
  see real content. New modules are picked up automatically from the registry.

## Tech Stack

| Layer    | Choice |
|----------|--------|
| Shell    | React, TypeScript, Vite, React Router, Tailwind CSS, Lucide |
| Modules  | One pnpm package each (`@scroll-goblin/module-*`), lazy-loaded source packages |
| Design   | `@scroll-goblin/ui` — Tailwind preset (brand tokens) + shared components |
| Backend  | Node, Hono, Vercel AI SDK (`ai`), Zod |
| LLM      | Google Gemini (default, provider-agnostic) |
| Stats    | Upstash Redis (leaderboard counters) |
| Sound    | Web Audio API synthesis (shared audio bus in `@scroll-goblin/ui`, no asset files) |
| SEO      | Build-time generation: robots.txt, sitemap.xml, llms.txt, prerendered per-route HTML + JSON-LD |
| Contract | `@scroll-goblin/shared` (Zod) |
| Tooling  | pnpm workspaces |

## Prerequisites

- Node 18+
- pnpm 9+ (`npm install -g pnpm`)
- A Google Gemini API key: https://aistudio.google.com/apikey

## Setup

```bash
pnpm install

# Backend env
cp apps/api/.env.example apps/api/.env
#   then set GOOGLE_GENERATIVE_AI_API_KEY in apps/api/.env
#   (optional) set the UPSTASH_REDIS_REST_* credentials to enable stat
#   tracking and the leaderboard — when unset, stats are a no-op

# Frontend env
cp apps/web/.env.example apps/web/.env
```

> On Windows PowerShell use `Copy-Item apps/api/.env.example apps/api/.env`.

## Run (dev)

```bash
pnpm dev
```

This builds the shared package, then starts the API (`http://localhost:8787`) and the web app (`http://localhost:5173`) together.

Run individually:

```bash
pnpm build:shared
pnpm dev:api
pnpm dev:web
```

## Build (production)

```bash
pnpm build
```

Builds the shared package, the API, and the web app. The web build also runs
`apps/web/scripts/generate-seo.mts`, which writes `robots.txt`,
`sitemap.xml`, `llms.txt`, and prerendered per-route HTML into
`apps/web/dist/`.

## Creating a new module

A module is a pnpm package that exports a `ModuleManifest`. The shell's landing
page and router pick it up automatically.

**1. Create the package** — copy the smallest existing module as a skeleton:

```
packages/modules/my-game/
├── package.json        # name: "@scroll-goblin/module-my-game", main: "./src/index.ts"
├── tsconfig.json       # extends ../../../tsconfig.base.json, jsx: react-jsx
└── src/
    ├── index.ts        # export { manifest } from "./manifest";
    ├── manifest.ts     # metadata + lazy entry point
    └── MyGamePage.tsx  # default-export React component (the module's UI)
```

**2. Fill in the manifest:**

```ts
// src/manifest.ts
import type { ModuleManifest } from "@scroll-goblin/ui";

export const manifest: ModuleManifest = {
  id: "my-game",                  // also the API namespace, /api/my-game/...
  title: "My Game",
  description: "Shown on the landing page card.",
  emoji: "🎮",
  path: "/apps/my-game",
  status: "active",               // "beta" shows a badge, "hidden" unlists it
  load: () => import("./MyGamePage"),
};
```

**3. Register it (two one-line changes):**

- `apps/web/package.json` → add `"@scroll-goblin/module-my-game": "workspace:*"` to dependencies
- `apps/web/src/modules/registry.ts` → import the manifest and append it to `MODULES`

Then `pnpm install`. Done — the landing page card and route exist.

**4. (Optional) Add a backend.** If the module needs server routes:

- Create a Hono router in `apps/api/src/modules/my-game.ts`
- Register it in the `moduleRouters` map in `apps/api/src/app.ts`
- Define request/response Zod schemas in `packages/shared` and call the API
  from the module via a small typed client (see
  `packages/modules/emoji-translator/src/api.ts` for the pattern)

**Rules of the road**

- Use `@scroll-goblin/ui` components and `brand-*` Tailwind tokens; don't invent
  one-off colors.
- Keep module state inside the module — no globals.
- Frontend-only modules (no backend) are perfectly fine: Touch Grass is one.
- Track interactions with `trackStat(moduleId, metric)` so the module shows up
  on the leaderboard.
- Synthesize sounds through the shared audio bus (`getAudioBus` /
  `getNoiseBuffer` from `@scroll-goblin/ui`) in a local `sounds.ts`, and put a
  `<MuteButton />` in the module's control bar so the global mute applies.
  Never start audio before a user gesture.
- SEO is automatic: the manifest's `title`/`description` feed the route
  metadata, sitemap, llms.txt, and prerendered HTML — write them like copy a
  search result would show.

## API

Module routes are namespaced by module id. The emoji translator:

`POST /api/emoji-translator/v1/translate` (in production; locally
`POST http://localhost:8787/emoji-translator/v1/translate`)

```jsonc
// request
{
  "input": "I love pizza and coffee",
  "direction": "text-to-emoji",     // or "emoji-to-text"
  "targetLanguage": "en"
}
// response
{
  "result": { "translation": "❤️🍕☕", "alternatives": ["😍🍕☕"], "notes": "..." },
  "model": "gemini-2.0-flash",
  "cached": false
}
```

The legacy unprefixed mount (`/api/v1/translate`) still works during migration
and can be removed once no clients use it (see `apps/api/src/app.ts`).

## Swapping the LLM provider

1. Install the provider SDK, e.g. `pnpm --filter @scroll-goblin/api add @ai-sdk/openai`
2. Uncomment its case in `apps/api/src/ai.ts`
3. Set `AI_PROVIDER=openai` and the matching key in `apps/api/.env`

No frontend changes required.
