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
} from "@emoji/shared";
import { Card } from "@emoji/ui";
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
    <div className="mx-auto max-w-3xl px-4 py-10 sm:py-16">
      <header className="mb-8 text-center">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/70 px-4 py-1.5 text-sm font-medium text-brand-600 shadow-sm ring-1 ring-brand-100">
          <Sparkles className="h-4 w-4" />
          AI Emoji Translator
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
          Translate language <span>↔️</span> emoji
        </h1>
        <p className="mt-2 text-slate-500">
          Powered by an LLM. Pick a direction, choose a language, and go.
        </p>
      </header>

      <Card className="p-5 sm:p-7">
        {/* Controls */}
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 rounded-xl bg-slate-100 p-1 text-sm font-medium">
            <button
              onClick={() => isTextToEmoji || swap()}
              className={`rounded-lg px-3 py-1.5 transition ${
                isTextToEmoji
                  ? "bg-white text-brand-600 shadow"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              Text → Emoji
            </button>
            <button
              onClick={() => !isTextToEmoji || swap()}
              className={`rounded-lg px-3 py-1.5 transition ${
                !isTextToEmoji
                  ? "bg-white text-brand-600 shadow"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              Emoji → Text
            </button>
          </div>

          <label className="flex items-center gap-2 text-sm text-slate-600">
            <Languages className="h-4 w-4 text-slate-400" />
            <span className="hidden sm:inline">
              {isTextToEmoji ? "Input language" : "Output language"}
            </span>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value as LanguageCode)}
              className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
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
        <div className="grid items-stretch gap-3 sm:grid-cols-[1fr_auto_1fr]">
          <textarea
            value={input}
            maxLength={1024}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              isTextToEmoji
                ? "Type a sentence to turn into emoji..."
                : "Paste emoji to interpret... 🎉🍕🚀"
            }
            className="min-h-[160px] w-full resize-none rounded-xl border border-slate-200 bg-slate-50 p-4 text-lg outline-none transition focus:border-brand-400 focus:bg-white focus:ring-2 focus:ring-brand-100"
          />

          <div className="flex items-center justify-center">
            <button
              onClick={swap}
              title="Swap direction"
              className="rounded-full border border-slate-200 bg-white p-2 text-slate-500 shadow-sm transition hover:rotate-180 hover:text-brand-600"
            >
              <ArrowLeftRight className="h-5 w-5" />
            </button>
          </div>

          <div className="relative min-h-[160px] w-full rounded-xl border border-slate-200 bg-slate-50 p-4">
            {result ? (
              <>
                <p className="pr-12 text-lg leading-relaxed text-slate-800 break-words">
                  {result.translation}
                </p>
                <button
                  onClick={copyOutput}
                  className="absolute right-3 top-3 rounded-md bg-white p-1.5 text-slate-400 shadow-sm ring-1 ring-slate-100 transition hover:text-brand-600"
                  title="Copy"
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </button>
              </>
            ) : (
              <p className="text-slate-400">
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
            className="fixed bottom-6 right-6 z-50 inline-flex items-center gap-2 rounded-full bg-brand-600 px-5 py-3 font-semibold text-white shadow-lg shadow-brand-300 transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50 sm:static sm:rounded-xl sm:px-5 sm:py-2.5 sm:shadow-brand-200"
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
          <div className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600 ring-1 ring-red-100">
            {error}
          </div>
        )}

        {/* Extras: alternatives + notes */}
        {result && (result.alternatives.length > 0 || result.notes) && (
          <div className="mt-5 space-y-3 border-t border-slate-100 pt-4">
            {result.alternatives.length > 0 && (
              <div>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Alternatives
                </p>
                <div className="flex flex-wrap gap-2">
                  {result.alternatives.map((alt, i) => (
                    <span
                      key={i}
                      className="rounded-lg bg-brand-50 px-3 py-1.5 text-sm text-brand-700 ring-1 ring-brand-100"
                    >
                      {alt}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {result.notes && (
              <p className="text-sm text-slate-500">
                <span className="font-medium text-slate-600">Note: </span>
                {result.notes}
              </p>
            )}
          </div>
        )}

        {cached && result && (
          <p className="mt-3 text-right text-xs text-slate-300">
            served from cache
          </p>
        )}
      </Card>
    </div>
  );
}
