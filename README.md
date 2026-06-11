# Scroll Goblin

**Scroll Goblin** (`scroll-goblin`) is a growing collection of mini apps, games,
and activities ("**modules**") served
from a single landing page. Current modules: **Emoji Translator** 😀 and
**Touch Grass** 🌱.

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
    ├── ui/                   # Design system: Tailwind preset, Card/Button, ModuleManifest type
    └── modules/
        ├── emoji-translator/ # One package per module (UI + manifest + API client)
        └── touch-grass/
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

## Tech Stack

| Layer    | Choice |
|----------|--------|
| Shell    | React, TypeScript, Vite, React Router, Tailwind CSS, Lucide |
| Modules  | One pnpm package each (`@scroll-goblin/module-*`), lazy-loaded source packages |
| Design   | `@scroll-goblin/ui` — Tailwind preset (brand tokens) + shared components |
| Backend  | Node, Hono, Vercel AI SDK (`ai`), Zod |
| LLM      | Google Gemini (default, provider-agnostic) |
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
