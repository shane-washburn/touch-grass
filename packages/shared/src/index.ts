import { z } from "zod";

/**
 * The contract shared between every frontend and backend.
 * Both apps depend ONLY on these schemas/types, never on each other's internals.
 * This is what keeps the system decoupled and swappable.
 */

export const DIRECTIONS = ["text-to-emoji", "emoji-to-text"] as const;
export const DirectionSchema = z.enum(DIRECTIONS);
export type Direction = z.infer<typeof DirectionSchema>;

/**
 * Supported target languages for the `emoji-to-text` direction
 * (and the source/target language for `text-to-emoji`).
 * BCP-47-ish codes; extend freely.
 */
export const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "es", label: "Spanish" },
  { code: "fr", label: "French" },
  { code: "de", label: "German" },
  { code: "it", label: "Italian" },
  { code: "pt", label: "Portuguese" },
  { code: "nl", label: "Dutch" },
  { code: "ru", label: "Russian" },
  { code: "ja", label: "Japanese" },
  { code: "ko", label: "Korean" },
  { code: "zh", label: "Chinese (Simplified)" },
  { code: "hi", label: "Hindi" },
  { code: "ar", label: "Arabic" },
  { code: "uk", label: "Ukrainian" },
] as const;

export const LanguageCodeSchema = z.enum(
  LANGUAGES.map((l) => l.code) as [string, ...string[]]
);
export type LanguageCode = z.infer<typeof LanguageCodeSchema>;

export const TranslateRequestSchema = z.object({
  /** The text or emoji string to translate. */
  input: z.string().min(1, "Input cannot be empty").max(2000, "Input too long"),
  /** Which way to translate. */
  direction: DirectionSchema,
  /**
   * Target human language.
   * - emoji-to-text: language to translate the emoji meaning into.
   * - text-to-emoji: language the input text is written in (helps interpretation).
   */
  targetLanguage: LanguageCodeSchema.default("en"),
});
export type TranslateRequest = z.infer<typeof TranslateRequestSchema>;

/**
 * Structured result the LLM is asked to return.
 * Structured output lets the UI render alternatives + notes cleanly.
 */
export const TranslationResultSchema = z.object({
  /** Primary translation. */
  translation: z.string(),
  /** Other valid interpretations / phrasings (emoji are ambiguous!). */
  alternatives: z.array(z.string()).max(5).default([]),
  /** Optional short note about idioms, ambiguity, or tone. */
  notes: z.string().optional(),
});
export type TranslationResult = z.infer<typeof TranslationResultSchema>;

export const TranslateResponseSchema = z.object({
  result: TranslationResultSchema,
  /** Echoes the model used, for transparency / debugging. */
  model: z.string(),
  /** Whether this response was served from cache. */
  cached: z.boolean().default(false),
});
export type TranslateResponse = z.infer<typeof TranslateResponseSchema>;

/* ------------------------------------------------------------------ */
/* Commune with God — AI magic 8-ball contract                         */
/* ------------------------------------------------------------------ */

export const CommuneRequestSchema = z.object({
  /** The question the seeker asks the divine. */
  question: z
    .string()
    .min(1, "Ask something, even a whisper")
    .max(500, "The divine prefers concise questions"),
});
export type CommuneRequest = z.infer<typeof CommuneRequestSchema>;

/** Structured divine answer the LLM is asked to return. */
export const DivineAnswerSchema = z.object({
  /** Short magic-8-ball-style verdict, e.g. "Yes, and sooner than you think." */
  verdict: z.string(),
  /** A few sentences of warm, supportive, non-denominational guidance. */
  message: z.string(),
  /** A one-line parting blessing. */
  blessing: z.string(),
});
export type DivineAnswer = z.infer<typeof DivineAnswerSchema>;

export const CommuneResponseSchema = z.object({
  result: DivineAnswerSchema,
  /** Echoes the model used, for transparency / debugging. */
  model: z.string(),
});
export type CommuneResponse = z.infer<typeof CommuneResponseSchema>;

export const ErrorResponseSchema = z.object({
  error: z.string(),
  details: z.unknown().optional(),
});
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;

export function languageLabel(code: string): string {
  return LANGUAGES.find((l) => l.code === code)?.label ?? code;
}
