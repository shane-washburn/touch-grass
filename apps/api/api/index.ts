import { Hono } from "hono";
import { handle } from "@hono/node-server/vercel";
import { app } from "../src/app.js";

/**
 * Vercel serverless function entry (Node.js runtime).
 *
 * Reached via the vercel.json rewrite `/api/(.*) -> /api`, which maps every
 * /api/* request to this function (a plain filename, not a fragile
 * `[[...route]]` catch-all that Vercel treated as a single segment).
 *
 * The app is mounted under /api, so production routes are /api/health and
 * /api/v1/translate. Local dev (src/index.ts) is unchanged and serves /health
 * and /v1/translate directly.
 *
 * We use @hono/node-server/vercel (NOT hono/vercel, which is Edge-only) because
 * the cache uses node:crypto. bodyParser is disabled so the raw request stream
 * reaches Hono untouched.
 */
const vercelApp = new Hono();
vercelApp.route("/api", app);

export const config = {
  api: {
    bodyParser: false,
  },
};

export default handle(vercelApp);
