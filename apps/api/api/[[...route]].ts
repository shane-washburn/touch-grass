import { Hono } from "hono";
import { handle } from "@hono/node-server/vercel";
import { app } from "../src/app.js";

/**
 * Vercel serverless function entry (Node.js runtime).
 *
 * This is a catch-all so every /api/* path maps here via Vercel's native
 * filesystem routing — no vercel.json rewrite (rewrites run after filesystem
 * routing and were being beaten to "/" by Vercel internals).
 *
 * The real app is mounted under /api, so production routes are /api/health and
 * /api/v1/translate. Local dev (src/index.ts) is unchanged and still serves
 * /health and /v1/translate directly.
 *
 * We use @hono/node-server/vercel (NOT hono/vercel, which is Edge-only) because
 * the cache layer uses node:crypto. bodyParser is disabled so the raw request
 * stream reaches Hono untouched.
 */
const vercelApp = new Hono();
vercelApp.route("/api", app);

export const config = {
  api: {
    bodyParser: false,
  },
};

export default handle(vercelApp);
