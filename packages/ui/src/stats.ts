/**
 * Batched, fire-and-forget stat tracking.
 *
 * Modules call `trackStat(moduleId, metric)` on every interaction; counts
 * are buffered locally and flushed to `/stats/v1/track` at most once per
 * FLUSH_INTERVAL_MS (and on tab hide via sendBeacon). Batching keeps the
 * Redis free-tier command quota comfortable even under heavy clicking.
 *
 * Tracking is best-effort by design: failures are swallowed, never surfaced
 * to the user, and never block the UI.
 */

// This source-shipped package is compiled by the consuming app's Vite build,
// which injects import.meta.env; the cast avoids needing vite types here.
const viteEnv = (import.meta as unknown as { env?: Record<string, string> })
  .env;

const API_BASE_URL = (
  viteEnv?.VITE_API_BASE_URL ?? "http://localhost:8787"
).replace(/\/+$/, "");

const TRACK_URL = `${API_BASE_URL}/stats/v1/track`;

const FLUSH_INTERVAL_MS = 10_000;

/** Pending counts keyed by `module\u0000metric`. */
const buffer = new Map<string, number>();
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let listenersBound = false;

function payload(): string | null {
  if (buffer.size === 0) return null;
  const events = Array.from(buffer, ([key, count]) => {
    const [module, metric] = key.split("\u0000");
    return { module, metric, count: Math.min(count, 1000) };
  });
  buffer.clear();
  return JSON.stringify({ events });
}

function flush(useBeacon = false): void {
  const body = payload();
  if (!body) return;
  if (useBeacon && navigator.sendBeacon) {
    // sendBeacon survives page unload; Blob sets the JSON content type.
    navigator.sendBeacon(
      TRACK_URL,
      new Blob([body], { type: "application/json" })
    );
    return;
  }
  fetch(TRACK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
  }).catch(() => {
    /* best-effort: drop on failure */
  });
}

function scheduleFlush(): void {
  if (!listenersBound) {
    listenersBound = true;
    // Flush whatever is buffered when the tab is hidden or closed.
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") flush(true);
    });
    window.addEventListener("pagehide", () => flush(true));
  }
  if (flushTimer !== null) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    flush();
  }, FLUSH_INTERVAL_MS);
}

/**
 * Record `count` occurrences of a module interaction. Buffered and batched;
 * safe to call on every click/frame-level event.
 */
export function trackStat(moduleId: string, metric: string, count = 1): void {
  const key = `${moduleId}\u0000${metric}`;
  buffer.set(key, (buffer.get(key) ?? 0) + count);
  scheduleFlush();
}

/** Last visit recorded, used to dedupe StrictMode double-effects. */
let lastVisit = { key: "", at: 0 };

/**
 * Record one visit to a module. Call from an effect on route change; repeat
 * calls for the same module within a short window are ignored so React
 * StrictMode's double-invoked effects don't double count.
 */
export function trackVisit(moduleId: string): void {
  const now = Date.now();
  if (lastVisit.key === moduleId && now - lastVisit.at < 1000) return;
  lastVisit = { key: moduleId, at: now };
  trackStat(moduleId, "visits");
}
