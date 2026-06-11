import { useState } from "react";
import {
  ArrowLeftRight,
  Copy,
  Check,
  Loader2,
  Sparkles,
  Languages,
} from "lucide-react";
import {
  LANGUAGES,
  type Direction,
  type LanguageCode,
  type TranslationResult,
} from "@scroll-goblin/shared";
import { Card } from "@scroll-goblin/ui";
import { translate } from "./api";

export default function EmojiTranslatorPage() {
  const [direction, setDirection] = useState<Direction>("text-to-emoji");
  const [language, setLanguage] = useState<LanguageCode>("en");
  const [input, setInput] = useState("");
  const [result, setResult] = useState<TranslationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [cached, setCached] = useState(false);

  const isTextToEmoji = direction === "text-to-emoji";

  const swap = () => {
    setDirection((d) =>
      d === "text-to-emoji" ? "emoji-to-text" : "text-to-emoji"
    );
    setInput(result?.translation ?? "");
    setResult(null);
    setError(null);
  };

  const onTranslate = async () => {
    if (!input.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await translate({
        input: input.trim(),
        direction,
        targetLanguage: language,
      });
      setResult(res.result);
      setCached(res.cached);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const copyOutput = async () => {
    if (!result) return;
    await navigator.clipboard.writeText(result.translation);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:py-12">
      <header className="mb-bento grid gap-bento sm:grid-cols-[1fr_1fr]">
        <div className="rounded-neobrutal border-thick border-brand-border bg-brand-secondary p-5 shadow-neo-lg">
          <div className="mb-4 inline-flex items-center gap-2 rounded-neobrutal border-thin border-brand-border bg-brand-background px-3 py-1 text-xs font-bold uppercase shadow-neo-sm">
          <Sparkles className="h-4 w-4" />
          AI Emoji Translator
          </div>
          <h1 className="font-heading text-4xl uppercase leading-none text-brand-text sm:text-5xl">
          Translate language <span>↔️</span> emoji
          </h1>
        </div>
        <p className="rounded-neobrutal border-thick border-brand-border bg-brand-surface p-5 text-sm font-bold leading-relaxed shadow-neo-lg">
          Powered by an LLM. Pick a direction, choose a language, and go.
        </p>
      </header>

      <Card className="bg-brand-background p-4 sm:p-6">
        {/* Controls */}
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2 text-sm font-bold">
            <button
              onClick={() => isTextToEmoji || swap()}
              className={`rounded-neobrutal border-thin border-brand-border px-3 py-1.5 shadow-neo-sm transition-[transform,box-shadow,background-color] duration-100 active:translate-x-0.5 active:translate-y-0.5 active:shadow-neo-pressed ${
                isTextToEmoji
                  ? "bg-brand-primary text-brand-text"
                  : "bg-brand-surface text-brand-text"
              }`}
            >
              Text → Emoji
            </button>
            <button
              onClick={() => !isTextToEmoji || swap()}
              className={`rounded-neobrutal border-thin border-brand-border px-3 py-1.5 shadow-neo-sm transition-[transform,box-shadow,background-color] duration-100 active:translate-x-0.5 active:translate-y-0.5 active:shadow-neo-pressed ${
                !isTextToEmoji
                  ? "bg-brand-primary text-brand-text"
                  : "bg-brand-surface text-brand-text"
              }`}
            >
              Emoji → Text
            </button>
          </div>

          <label className="flex items-center gap-2 text-sm font-bold text-brand-text">
            <Languages className="h-4 w-4 text-brand-text" />
            <span className="hidden sm:inline">
              {isTextToEmoji ? "Input language" : "Output language"}
            </span>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value as LanguageCode)}
              className="rounded-neobrutal border-thin border-brand-border bg-brand-background px-2 py-1.5 text-sm font-bold text-brand-text shadow-neo-sm outline-none focus:bg-brand-warning"
            >
              {LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        {/* IO panes */}
        <div className="grid items-stretch gap-bento sm:grid-cols-[1fr_auto_1fr]">
          <textarea
            value={input}
            maxLength={1024}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              isTextToEmoji
                ? "Type a sentence to turn into emoji..."
                : "Paste emoji to interpret... 🎉🍕🚀"
            }
            className="min-h-[180px] w-full resize-none rounded-neobrutal border-thick border-brand-border bg-brand-surface p-4 text-base font-bold text-brand-text shadow-neo-md outline-none transition focus:bg-brand-background"
          />

          <div className="flex items-center justify-center">
            <button
              onClick={swap}
              title="Swap direction"
              className="rounded-neobrutal border-thick border-brand-border bg-brand-warning p-2 text-brand-text shadow-neo-md transition-[transform,box-shadow] duration-100 hover:rotate-180 active:translate-x-1 active:translate-y-1 active:shadow-neo-pressed"
            >
              <ArrowLeftRight className="h-5 w-5" />
            </button>
          </div>

          <div className="relative min-h-[180px] w-full rounded-neobrutal border-thick border-brand-border bg-brand-primary p-4 shadow-neo-md">
            {result ? (
              <>
                <p className="pr-12 text-base font-bold leading-relaxed text-brand-text break-words">
                  {result.translation}
                </p>
                <button
                  onClick={copyOutput}
                  className="absolute right-3 top-3 rounded-neobrutal border-thin border-brand-border bg-brand-background p-1.5 text-brand-text shadow-neo-sm transition-[transform,box-shadow] duration-100 active:translate-x-0.5 active:translate-y-0.5 active:shadow-neo-pressed"
                  title="Copy"
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-brand-text" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </button>
              </>
            ) : (
              <p className="text-sm font-bold text-brand-text">
                {loading ? "Translating..." : "Translation will appear here"}
              </p>
            )}
          </div>
        </div>

        {/* Action */}
        <div className="mt-5 flex justify-end">
          <button
            onClick={onTranslate}
            disabled={loading || !input.trim()}
            className="fixed bottom-6 right-6 z-50 inline-flex items-center gap-2 rounded-neobrutal border-thick border-brand-border bg-brand-primary px-5 py-3 font-bold text-brand-text shadow-neo-lg transition-[transform,box-shadow,background-color] duration-100 active:translate-x-1 active:translate-y-1 active:shadow-neo-pressed disabled:cursor-not-allowed disabled:opacity-50 disabled:active:translate-x-0 disabled:active:translate-y-0 disabled:active:shadow-neo-lg sm:static sm:px-5 sm:py-2.5"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            Translate
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="mt-4 rounded-neobrutal border-thick border-brand-border bg-brand-alert px-4 py-3 text-sm font-bold text-brand-background shadow-neo-md">
            {error}
          </div>
        )}

        {/* Extras: alternatives + notes */}
        {result && (result.alternatives.length > 0 || result.notes) && (
          <div className="mt-5 space-y-3 border-t-thick border-brand-border pt-4">
            {result.alternatives.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-bold uppercase text-brand-text">
                  Alternatives
                </p>
                <div className="flex flex-wrap gap-2">
                  {result.alternatives.map((alt, i) => (
                    <span
                      key={i}
                      className="rounded-neobrutal border-thin border-brand-border bg-brand-secondary px-3 py-1.5 text-sm font-bold text-brand-text shadow-neo-sm"
                    >
                      {alt}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {result.notes && (
              <p className="text-sm font-bold text-brand-text">
                <span className="bg-brand-warning px-1">Note: </span>
                {result.notes}
              </p>
            )}
          </div>
        )}

        {cached && result && (
          <p className="mt-3 text-right text-xs font-bold text-brand-text">
            served from cache
          </p>
        )}
      </Card>
    </div>
  );
}
