import type { LanguageModel } from "ai";
import { google } from "@ai-sdk/google";

/**
 * Provider-agnostic model resolver.
 *
 * The rest of the app only ever asks for `getModel()` and never imports a
 * specific provider SDK. To swap providers, set AI_PROVIDER + the matching
 * env vars and add a case below. The default is Google Gemini.
 *
 * Other providers are intentionally lazy-required so you don't need their
 * packages installed unless you actually use them.
 */
export function getModel(): LanguageModel {
  const provider = (process.env.AI_PROVIDER ?? "google").toLowerCase();

  switch (provider) {
    case "google": {
      const model = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";
      return google(model);
    }

    // To enable, run: pnpm --filter @scroll-goblin/api add @ai-sdk/openai
    // case "openai": {
    //   const { openai } = require("@ai-sdk/openai");
    //   return openai(process.env.OPENAI_MODEL ?? "gpt-4o-mini");
    // }

    // To enable, run: pnpm --filter @scroll-goblin/api add @ai-sdk/anthropic
    // case "anthropic": {
    //   const { anthropic } = require("@ai-sdk/anthropic");
    //   return anthropic(process.env.ANTHROPIC_MODEL ?? "claude-3-5-haiku-latest");
    // }

    default:
      throw new Error(
        `Unsupported AI_PROVIDER "${provider}". Supported: google (default).`
      );
  }
}

export function getModelId(): string {
  const provider = (process.env.AI_PROVIDER ?? "google").toLowerCase();
  if (provider === "google") return process.env.GEMINI_MODEL ?? "gemini-2.5-flash";
  if (provider === "openai") return process.env.OPENAI_MODEL ?? "gpt-4o-mini";
  if (provider === "anthropic")
    return process.env.ANTHROPIC_MODEL ?? "claude-3-5-haiku-latest";
  return provider;
}
