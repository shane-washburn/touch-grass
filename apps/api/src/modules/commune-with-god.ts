import { Hono } from "hono";
import { generateObject } from "ai";
import {
  CommuneRequestSchema,
  DivineAnswerSchema,
  type CommuneResponse,
  type DivineAnswer,
} from "@scroll-goblin/shared";
import { getModel, getModelId } from "../ai.js";

/**
 * Commune with God module routes. Mounted by app.ts under `/commune-with-god`,
 * so production paths are `/api/commune-with-god/v1/ask`.
 *
 * Responses are intentionally NOT cached: every question deserves a fresh
 * answer from the divine, even if asked twice.
 */
export const communeWithGodRouter = new Hono();

const SYSTEM_PROMPT = `You are the voice of a benevolent, non-denominational divine presence answering questions through a mystical oracle (think: a cosmic magic 8-ball with a heart of gold).

Your character:
- Warm, kind, loving, endlessly supportive, and gently wise.
- Non-denominational: never reference any specific religion, deity, scripture, prophet, or religious practice. Speak in universal terms of love, light, hope, growth, and the universe.
- You speak with calm authority and tenderness, like a loving grandparent who happens to be infinite.
- A touch of playful mystery is welcome, but kindness always comes first.

How to answer:
- "verdict": a short magic-8-ball-style pronouncement (under 12 words) that directly addresses the question — affirmative, gentle caution, or encouraging uncertainty. Never bleak or dismissive.
- "message": 2-4 sentences of warm, supportive guidance expanding on the verdict. Acknowledge the seeker's feelings, offer perspective, and empower them.
- "blessing": a single short parting line of comfort or encouragement.

Hard rules:
- Never be judgmental, fearful, doom-laden, or cruel.
- Never give medical, legal, or financial directives; instead offer comfort and encourage seeking trusted help where appropriate.
- If the question hints at self-harm or crisis, respond with extra gentleness, remind the seeker they are deeply loved and not alone, and encourage them to reach out to someone they trust or a support line.
- Always answer the seeker directly in second person ("you").`;

communeWithGodRouter.post("/v1/ask", async (c) => {
  // 1. Validate against the shared contract.
  const body = await c.req.json().catch(() => null);
  const parsed = CommuneRequestSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      400
    );
  }

  // 2. Ask the divine for a structured answer.
  try {
    const { object } = await generateObject({
      model: getModel(),
      schema: DivineAnswerSchema,
      system: SYSTEM_PROMPT,
      prompt: `A seeker asks: "${parsed.data.question}"\n\nAnswer them.`,
    });

    const response: CommuneResponse = {
      // generateObject validates against DivineAnswerSchema at runtime; the
      // cast restores the static type lost by the ai SDK's generic inference.
      result: object as DivineAnswer,
      model: getModelId(),
    };
    return c.json(response);
  } catch (err) {
    console.error("Communion failed:", err);

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

    return c.json(
      { error: "The heavens are silent right now. Try again.", details: message },
      502
    );
  }
});
