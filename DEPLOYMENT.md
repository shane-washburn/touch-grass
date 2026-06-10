# Deploying to Vercel (free)

This monorepo deploys as **two separate Vercel projects** from the same Git
repository — they stay decoupled, exactly like local dev:

- `apps/api` → a serverless function running the Hono app.
- `apps/web` → a static Vite site that talks to the API via `VITE_API_BASE_URL`.

Both fit comfortably in Vercel's free **Hobby** tier, and serverless functions
don't cold-sleep the way a free Render instance does.

## 0. Prerequisites

1. Push this repo to GitHub/GitLab/Bitbucket.
2. Create a free account at https://vercel.com.
3. Have your Google Gemini API key ready
   (https://aistudio.google.com/app/apikey).

---

## 1. Deploy the API (backend)

1. In Vercel: **Add New… → Project**, import this repo.
2. **Root Directory**: set to `apps/api`.
   - Enable **"Include source files outside of the Root Directory in the Build
     Step"** (needed so it can build the `@emoji/shared` workspace package).
3. **Framework Preset**: **Other** — do NOT let it pick "Hono". Vercel
   auto-detects Hono and would build `src/app.ts` as a broken function at `/`.
   `apps/api/vercel.json` sets `"framework": null` to prevent this, but set the
   dashboard preset to **Other** too, to be safe.
4. **Environment Variables** (Settings → Environment Variables):
   | Name                           | Value                                  |
   | ------------------------------ | -------------------------------------- |
   | `GOOGLE_GENERATIVE_AI_API_KEY` | your Gemini key                        |
   | `AI_PROVIDER`                  | `google`                               |
   | `GEMINI_MODEL`                 | `gemini-2.5-flash`                     |
   | `CORS_ORIGIN`                  | your web URL (fill in after step 2)    |
5. **Deploy**. Note the resulting URL, e.g. `https://emoji-api.vercel.app`.
6. Sanity check: open `https://<your-api>.vercel.app/api/health` — it should
   return `{ "ok": true, ... }`. (The app is mounted under `/api`.)

> You can temporarily set `CORS_ORIGIN` to `*` for first testing, then lock it
> down to the real web URL once you have it.

---

## 2. Deploy the Web (frontend)

1. In Vercel: **Add New… → Project**, import the **same** repo again.
2. **Root Directory**: set to `apps/web`.
   - Enable **"Include source files outside of the Root Directory"** as above.
3. **Framework Preset**: Vite (or Other — `apps/web/vercel.json` already defines
   the commands and SPA fallback).
4. **Environment Variables**:
   | Name                | Value                                |
   | ------------------- | ------------------------------------ |
   | `VITE_API_BASE_URL` | your API URL from step 1 **with the `/api` suffix**, no trailing slash, e.g. `https://emoji-api.vercel.app/api` |
5. **Deploy**. Note the web URL, e.g. `https://emoji-web.vercel.app`.

---

## 3. Connect them

1. Go back to the **API** project → Environment Variables.
2. Set `CORS_ORIGIN` to the exact web URL from step 2
   (e.g. `https://emoji-web.vercel.app`). Multiple origins can be
   comma-separated.
3. **Redeploy** the API so the new CORS value takes effect.

Open the web URL and translate something. Done.

---

## How it works

- `apps/api/api/[[...route]].ts` is a catch-all serverless function that mounts
  the shared Hono `app` under `/api`, so production routes are `/api/health`
  and `/api/v1/translate`. It uses `@hono/node-server/vercel`'s `handle()` (the
  **Node.js** runtime adapter — `hono/vercel` is Edge-only and the cache uses
  `node:crypto`).
- No `vercel.json` rewrite is used: Vercel's native filesystem routing maps
  `/api/*` to the function directly.
- `apps/api/public/index.html` is a small static landing page. With
  `"framework": null`, Vercel expects a static output directory; this satisfies
  it and gives `/` a friendly page that links to `/api/health`.
- Local dev is unaffected: `pnpm dev` still runs the Node server via
  `apps/api/src/index.ts`, serving `/health` and `/v1/translate` directly.

## Notes & limits

- The in-memory cache (`apps/api/src/cache.ts`) is **per-instance** and resets
  when a serverless instance recycles. That's fine for a demo; swap in Upstash
  Redis later if you want a shared cache.
- Never commit `.env` files — set secrets in the Vercel dashboard instead.
