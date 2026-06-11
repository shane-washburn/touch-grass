import { useState } from "react";
import { Loader2, Send, Sparkles, Heart } from "lucide-react";
import { type DivineAnswer } from "@scroll-goblin/shared";
import {
  Card,
  ShareButton,
  consumeShareSnapshot,
  trackStat,
} from "@scroll-goblin/ui";
import { askTheDivine } from "./api";

/** State captured in a shareable link. Bump SHARE_VERSION on shape changes. */
interface ShareState {
  asked: string | null;
  answer: DivineAnswer | null;
}

const MODULE_ID = "commune-with-god";
const SHARE_VERSION = 1;

const PLACEHOLDER_QUESTIONS = [
  "Will things work out for me?",
  "Should I take the leap?",
  "Am I on the right path?",
  "Is it time to let go?",
];

export default function CommuneWithGodPage() {
  // Consume a share snapshot exactly once; the URL param is stripped so a
  // refresh or fresh navigation starts the module blank.
  const [snapshot] = useState(() =>
    consumeShareSnapshot<ShareState>(MODULE_ID, SHARE_VERSION)
  );

  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<DivineAnswer | null>(
    snapshot?.answer ?? null
  );
  const [asked, setAsked] = useState<string | null>(snapshot?.asked ?? null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const placeholder =
    PLACEHOLDER_QUESTIONS[
      Math.abs(question.length) % PLACEHOLDER_QUESTIONS.length
    ];

  const onAsk = async () => {
    const q = question.trim();
    if (!q || loading) return;
    setLoading(true);
    setError(null);
    setAnswer(null);
    setAsked(q);
    try {
      const res = await askTheDivine({ question: q });
      setAnswer(res.result);
      trackStat(MODULE_ID, "answers");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const askAgain = () => {
    setQuestion("");
    setAnswer(null);
    setAsked(null);
    setError(null);
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:py-12">
      <header className="mb-bento grid gap-bento sm:grid-cols-[1fr_1fr]">
        <div className="rounded-neobrutal border-thick border-brand-border bg-brand-secondary p-5 shadow-neo-lg">
          <div className="mb-4 inline-flex items-center gap-2 rounded-neobrutal border-thin border-brand-border bg-brand-background px-3 py-1 text-xs font-bold uppercase shadow-neo-sm">
            <Sparkles className="h-4 w-4" />
            Divine Oracle
          </div>
          <h1 className="font-heading text-4xl uppercase leading-none text-brand-text sm:text-5xl">
            Commune with God <span>🔮</span>
          </h1>
        </div>
        <p className="rounded-neobrutal border-thick border-brand-border bg-brand-surface p-5 text-sm font-bold leading-relaxed shadow-neo-lg">
          Ask anything that weighs on your heart. A benevolent, non-denominational
          presence answers with kindness, love, and support. No judgment, ever.
        </p>
      </header>

      <Card className="bg-brand-background p-4 sm:p-6">
        {/* The orb */}
        <div className="mb-6 flex justify-center">
          <div
            className={`flex h-40 w-40 items-center justify-center rounded-full border-thick border-brand-border bg-brand-primary shadow-neo-lg transition-transform ${
              loading ? "animate-bounce" : ""
            }`}
          >
            <span className="text-6xl" role="img" aria-label="crystal ball">
              {loading ? "✨" : answer ? "🕊️" : "🔮"}
            </span>
          </div>
        </div>

        {/* Question input */}
        {!answer && (
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              value={question}
              maxLength={500}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && onAsk()}
              placeholder={placeholder}
              disabled={loading}
              className="w-full rounded-neobrutal border-thick border-brand-border bg-brand-surface p-4 text-base font-bold text-brand-text shadow-neo-md outline-none transition focus:bg-brand-background disabled:opacity-60"
            />
            <button
              onClick={onAsk}
              disabled={loading || !question.trim()}
              className="inline-flex items-center justify-center gap-2 rounded-neobrutal border-thick border-brand-border bg-brand-primary px-5 py-3 font-bold text-brand-text shadow-neo-lg transition-[transform,box-shadow,background-color] duration-100 active:translate-x-1 active:translate-y-1 active:shadow-neo-pressed disabled:cursor-not-allowed disabled:opacity-50 disabled:active:translate-x-0 disabled:active:translate-y-0 disabled:active:shadow-neo-lg"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              Ask
            </button>
          </div>
        )}

        {loading && (
          <p className="mt-4 text-center text-sm font-bold text-brand-text">
            The heavens are listening...
          </p>
        )}

        {/* Error */}
        {error && (
          <div className="mt-4 rounded-neobrutal border-thick border-brand-border bg-brand-alert px-4 py-3 text-sm font-bold text-brand-background shadow-neo-md">
            {error}
          </div>
        )}

        {/* Divine answer */}
        {answer && (
          <div className="space-y-bento">
            {asked && (
              <p className="text-center text-sm font-bold text-brand-text">
                You asked: <span className="bg-brand-warning px-1">{asked}</span>
              </p>
            )}

            <div className="rounded-neobrutal border-thick border-brand-border bg-brand-primary p-5 text-center shadow-neo-lg">
              <p className="font-heading text-2xl uppercase leading-tight text-brand-text sm:text-3xl">
                {answer.verdict}
              </p>
            </div>

            <div className="rounded-neobrutal border-thick border-brand-border bg-brand-surface p-5 shadow-neo-md">
              <p className="text-base font-bold leading-relaxed text-brand-text">
                {answer.message}
              </p>
            </div>

            <div className="flex items-start gap-2 rounded-neobrutal border-thin border-brand-border bg-brand-secondary px-4 py-3 shadow-neo-sm">
              <Heart className="mt-0.5 h-4 w-4 shrink-0 text-brand-text" />
              <p className="text-sm font-bold italic text-brand-text">
                {answer.blessing}
              </p>
            </div>

            <div className="flex flex-wrap justify-center gap-3">
              <button
                onClick={askAgain}
                className="inline-flex items-center gap-2 rounded-neobrutal border-thick border-brand-border bg-brand-warning px-5 py-2.5 font-bold text-brand-text shadow-neo-lg transition-[transform,box-shadow] duration-100 active:translate-x-1 active:translate-y-1 active:shadow-neo-pressed"
              >
                <Sparkles className="h-4 w-4" />
                Ask another question
              </button>
              <ShareButton
                moduleId={MODULE_ID}
                version={SHARE_VERSION}
                getState={(): ShareState => ({ asked, answer })}
              />
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
