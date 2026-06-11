/// <reference types="vite/client" />
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, Trophy, Footprints, RefreshCw } from "lucide-react";
import {
  LeaderboardResponseSchema,
  STAT_METRICS,
  type LeaderboardResponse,
} from "@scroll-goblin/shared";
import { Card } from "@scroll-goblin/ui";
import { MODULES } from "../modules/registry";

const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8787"
).replace(/\/+$/, "");

const LEADERBOARD_URL = `${API_BASE_URL}/stats/v1/leaderboard`;

type Tab = "interactions" | "visits";

/** One row of the interactions tab: a metric total across all users. */
interface MetricRow {
  moduleId: string;
  emoji: string;
  moduleTitle: string;
  label: string;
  total: number;
}

const palette = [
  "bg-brand-primary",
  "bg-brand-secondary",
  "bg-brand-warning",
  "bg-brand-pink",
  "bg-brand-orange",
  "bg-brand-purple",
];

const medal = (rank: number) =>
  rank === 0 ? "🥇" : rank === 1 ? "🥈" : rank === 2 ? "🥉" : null;

export default function Leaderboard() {
  const [tab, setTab] = useState<Tab>("interactions");
  const [data, setData] = useState<LeaderboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(LEADERBOARD_URL);
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      setData(LeaderboardResponseSchema.parse(await res.json()));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  // Flatten every module metric into ranked rows, biggest totals first.
  const metricRows: MetricRow[] = [];
  if (data) {
    for (const m of MODULES) {
      const stats = data.modules[m.id];
      const labels = STAT_METRICS[m.id];
      if (!stats || !labels) continue;
      for (const [metric, label] of Object.entries(labels)) {
        metricRows.push({
          moduleId: m.id,
          emoji: m.emoji,
          moduleTitle: m.title,
          label,
          total: stats.metrics[metric] ?? 0,
        });
      }
    }
    metricRows.sort((a, b) => b.total - a.total);
  }

  const visitRows = data
    ? MODULES.filter((m) => data.modules[m.id])
        .map((m) => ({
          moduleId: m.id,
          emoji: m.emoji,
          moduleTitle: m.title,
          path: m.path,
          visits: data.modules[m.id].visits,
        }))
        .sort((a, b) => b.visits - a.visits)
    : [];

  const tabButton = (t: Tab, label: string, icon: React.ReactNode) => (
    <button
      onClick={() => setTab(t)}
      className={`inline-flex items-center gap-2 rounded-neobrutal border-thin border-brand-border px-3 py-1.5 text-sm font-bold shadow-neo-sm transition-[transform,box-shadow,background-color] duration-100 active:translate-x-0.5 active:translate-y-0.5 active:shadow-neo-pressed ${
        tab === t
          ? "bg-brand-background text-brand-text"
          : "bg-brand-surface text-brand-text"
      }`}
    >
      {icon}
      {label}
    </button>
  );

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:py-12">
      <header className="mb-bento grid gap-bento sm:grid-cols-[1fr_1fr]">
        <div className="rounded-neobrutal border-thick border-brand-border bg-brand-warning p-5 shadow-neo-lg">
          <div className="mb-4 inline-flex items-center gap-2 rounded-neobrutal border-thin border-brand-border bg-brand-background px-3 py-1 text-xs font-bold uppercase shadow-neo-sm">
            <Trophy className="h-4 w-4" />
            Leaderboard
          </div>
          <h1 className="font-heading text-4xl uppercase leading-none text-brand-text sm:text-5xl">
            The collective brainrot
          </h1>
        </div>
        <p className="rounded-neobrutal border-thick border-brand-border bg-brand-surface p-5 text-sm font-bold leading-relaxed shadow-neo-lg">
          Combined totals from every goblin who has ever scrolled through. Every
          blade plucked, egg laid, and answer received — counted forever.
        </p>
      </header>

      <Card className="overflow-hidden bg-brand-background">
        {/* Tabs */}
        <div className="flex flex-col gap-3 border-b-thick border-brand-border bg-brand-secondary p-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            {tabButton(
              "interactions",
              "Interactions",
              <Trophy className="h-4 w-4" />
            )}
            {tabButton("visits", "Visits", <Footprints className="h-4 w-4" />)}
          </div>
          <button
            onClick={() => void load()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-neobrutal border-thin border-brand-border bg-brand-surface px-3 py-1.5 text-xs font-bold shadow-neo-sm transition-[transform,box-shadow] duration-100 active:translate-x-0.5 active:translate-y-0.5 active:shadow-neo-pressed disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        {loading && !data && (
          <div className="flex items-center justify-center gap-2 py-16 font-bold text-brand-text">
            <Loader2 className="h-5 w-5 animate-spin" />
            Tallying the chaos...
          </div>
        )}

        {error && (
          <div className="m-4 rounded-neobrutal border-thick border-brand-border bg-brand-alert px-4 py-3 text-sm font-bold text-brand-background shadow-neo-md">
            {error}
          </div>
        )}

        {data && !data.live && (
          <div className="m-4 rounded-neobrutal border-thin border-brand-border bg-brand-warning px-4 py-3 text-xs font-bold shadow-neo-sm">
            The stats database isn't connected yet, so everything reads zero.
            (API is missing its Upstash Redis credentials.)
          </div>
        )}

        {/* Interactions tab */}
        {data && tab === "interactions" && (
          <ul className="divide-y-2 divide-brand-border">
            {metricRows.map((row, i) => (
              <li
                key={`${row.moduleId}-${row.label}`}
                className="flex items-center gap-3 p-4"
              >
                <span className="w-8 text-center font-heading text-xl">
                  {medal(i) ?? `${i + 1}`}
                </span>
                <span className="text-2xl">{row.emoji}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-brand-text">
                    {row.label}
                  </p>
                  <p className="text-xs font-bold uppercase text-brand-text opacity-60">
                    {row.moduleTitle}
                  </p>
                </div>
                <span
                  className={`rounded-neobrutal border-thin border-brand-border px-3 py-1 font-heading text-lg text-brand-text shadow-neo-sm ${
                    palette[i % palette.length]
                  }`}
                >
                  {row.total.toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        )}

        {/* Visits tab */}
        {data && tab === "visits" && (
          <ul className="divide-y-2 divide-brand-border">
            {visitRows.map((row, i) => (
              <li key={row.moduleId} className="flex items-center gap-3 p-4">
                <span className="w-8 text-center font-heading text-xl">
                  {medal(i) ?? `${i + 1}`}
                </span>
                <span className="text-2xl">{row.emoji}</span>
                <div className="min-w-0 flex-1">
                  <Link
                    to={row.path}
                    className="text-sm font-bold text-brand-text underline-offset-2 hover:underline"
                  >
                    {row.moduleTitle}
                  </Link>
                </div>
                <span
                  className={`rounded-neobrutal border-thin border-brand-border px-3 py-1 font-heading text-lg text-brand-text shadow-neo-sm ${
                    palette[i % palette.length]
                  }`}
                >
                  {row.visits.toLocaleString()}{" "}
                  <span className="font-body text-xs">visits</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <p className="mt-4 text-center text-xs font-bold text-brand-text opacity-60">
        Totals update within about a minute. Stats are anonymous — nobody knows
        it was you who squeezed the chicken 4,000 times.
      </p>
    </div>
  );
}
