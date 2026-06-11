import { languageLabel, type TranslateRequest } from "@scroll-goblin/shared";

/**
 * Two prompt templates, one per direction. Both ask for the same structured
 * shape (translation + alternatives + notes) which matches TranslationResultSchema.
 */
export function buildPrompt(req: TranslateRequest): {
  system: string;
  prompt: string;
} {
  const lang = languageLabel(req.targetLanguage);

  if (req.direction === "text-to-emoji") {
    return {
      system: [
        "You are an expert translator that converts human language into a sequence of emoji.",
        "Capture the meaning, tone, and key nouns/verbs of the input using widely understood emoji.",
        "Prefer clarity over cleverness. Keep ordering natural. Do not include words unless absolutely necessary.",
        "Return a primary emoji translation, up to 5 alternative emoji renderings, and an optional short note.",
      ].join(" "),
      prompt: [
        `The input is written in ${lang}.`,
        "Translate the following text into emoji:",
        "",
        req.input,
      ].join("\n"),
    };
  }

  // emoji-to-text
  return {
    system: [
      `You are an expert translator that interprets emoji and explains their meaning in ${lang}.`,
      "Emoji are ambiguous, so provide the most likely natural-language reading as the primary translation.",
      `Write all output in ${lang}.`,
      "Include up to 5 alternative interpretations and an optional short note about ambiguity, tone, or idioms.",
    ].join(" "),
    prompt: [
      `Translate the following emoji into natural ${lang}. Give the meaning, not just emoji names:`,
      "",
      req.input,
    ].join("\n"),
  };
}
