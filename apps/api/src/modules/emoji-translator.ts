import { Hono } from "hono";
import { generateObject } from "ai";
import {
  TranslateRequestSchema,
  TranslationResultSchema,
  type TranslateResponse,
  type TranslationResult,
} from "@emoji/shared";
import { getModel, getModelId } from "../ai.js";
import { buildPrompt } from "../prompt.js";
import { cacheKey, getCached, setCached } from "../cache.js";

/**
 * Emoji Translator module routes. Mounted by app.ts under `/emoji-translator`
 * (and at the root for legacy clients), so production paths are
 * `/api/emoji-translator/v1/translate`.
 */
export const emojiTranslatorRouter = new Hono();

emojiTranslatorRouter.post("/v1/translate", async (c) => {
  // 1. Validate against the shared contract.
  const body = await c.req.json().catch(() => null);
  const parsed = TranslateRequestSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      400
    );
  }
  const req = parsed.data;

  // 2. Serve from cache when possible (zero tokens on repeats).
  const key = cacheKey(req);
  const cached = getCached(key);
  if (cached) {
    return c.json({ ...cached, cached: true } satisfies TranslateResponse);
  }

  // 3. Build the direction-specific prompt and call the LLM for structured JSON.
  const { system, prompt } = buildPrompt(req);
  try {
    const { object } = await generateObject({
      model: getModel(),
      schema: TranslationResultSchema,
      system,
      prompt,
    });

    const response: TranslateResponse = {
      // generateObject validates against TranslationResultSchema at runtime, so
      // this is the correct shape; the cast restores the static type that the
      // ai SDK's generic inference loses against the prebuilt shared schema.
      result: object as TranslationResult,
      model: getModelId(),
      cached: false,
    };
    setCached(key, response);
    return c.json(response);
  } catch (err) {
    console.error("Translation failed:", err);

    // Surface auth/config problems clearly instead of a generic 502.
    const message =
      err && typeof err === "object" && "message" in err
        ? String((err as { message: unknown }).message)
        : String(err);
    const isAuthError = /api key|unauthorized|permission|invalid_argument/i.test(
      message
    );

    if (isAuthError) {
      return c.json(
        {
          error:
            "LLM provider rejected the request (check GOOGLE_GENERATIVE_AI_API_KEY).",
          details: message,
        },
        401
      );
    }

    return c.json({ error: "Translation failed", details: message }, 502);
  }
});
