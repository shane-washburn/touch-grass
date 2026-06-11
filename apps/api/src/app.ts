import { Hono } from "hono";
import { cors } from "hono/cors";
import { getModelId } from "./ai.js";
import { emojiTranslatorRouter } from "./modules/emoji-translator.js";

/**
 * The Hono application, defined independently of any runtime.
 *
 * Local dev runs it via @hono/node-server (see index.ts); production runs the
 * exact same `app` as a Vercel serverless function (see ../api/index.ts).
 *
 * Cross-cutting concerns (CORS, health) live here; each module contributes a
 * router that is mounted under its module id, mirroring the frontend registry.
 */
export const app = new Hono();

const corsOrigins = (process.env.CORS_ORIGIN ?? "http://localhost:5173")
  .split(",")
  .map((s) => s.trim());

app.use("*", cors({ origin: corsOrigins }));

app.get("/health", (c) => c.json({ ok: true, model: getModelId() }));

/**
 * Module router registry. To add a module backend: create a router under
 * src/modules/ and register it here. Routes are namespaced as
 * `/<module-id>/...` (`/api/<module-id>/...` in production).
 */
const moduleRouters: Record<string, Hono> = {
  "emoji-translator": emojiTranslatorRouter,
};

for (const [id, router] of Object.entries(moduleRouters)) {
  app.route(`/${id}`, router);
}

// Legacy mount: keeps the pre-suite `/v1/translate` path working for any
// clients still pointing at the old URL. Remove once traffic is migrated.
app.route("/", emojiTranslatorRouter);
