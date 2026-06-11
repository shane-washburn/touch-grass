import { Hono } from "hono";
import {
  STAT_METRICS,
  StatsTrackRequestSchema,
  VISITS_METRIC,
  isValidStat,
  type LeaderboardResponse,
  type ModuleStats,
} from "@scroll-goblin/shared";
import { getRedis } from "../redis.js";

/**
 * Suite-wide stats routes. Mounted by app.ts under `/stats`, so production
 * paths are `/api/stats/v1/track` and `/api/stats/v1/leaderboard`.
 *
 * Storage: one Redis counter per (module, metric) — `stats:<module>:<metric>`
 * — incremented atomically via a single pipelined request per batch. Clients
 * batch increments (see @scroll-goblin/ui stats tracker) so the free-tier
 * command quota goes a long way.
 */
export const statsRouter = new Hono();

const statKey = (module: string, metric: string) =>
  `stats:${module}:${metric}`;

/** Max increment accepted per event — caps trivial abuse from one request. */
const MAX_COUNT_PER_EVENT = 1000;

statsRouter.post("/v1/track", async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = StatsTrackRequestSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      400
    );
  }

  // Drop unknown module/metric pairs instead of erroring: stale clients
  // shouldn't break, they just don't get counted.
  const events = parsed.data.events.filter((e) =>
    isValidStat(e.module, e.metric)
  );
  if (events.length === 0) return c.json({ ok: true, counted: 0 });

  const redis = getRedis();
  if (!redis) return c.json({ ok: true, counted: 0 });

  // Merge duplicate (module, metric) pairs, then increment in one pipeline.
  const totals = new Map<string, number>();
  for (const e of events) {
    const key = statKey(e.module, e.metric);
    totals.set(
      key,
      Math.min(
        (totals.get(key) ?? 0) + e.count,
        MAX_COUNT_PER_EVENT
      )
    );
  }

  try {
    const pipeline = redis.pipeline();
    for (const [key, count] of totals) pipeline.incrby(key, count);
    await pipeline.exec();
  } catch (err) {
    console.error("Stats track failed:", err);
    return c.json({ error: "Stats unavailable" }, 502);
  }

  return c.json({ ok: true, counted: events.length });
});

/**
 * Leaderboard reads are cached in-memory per serverless instance so bursts
 * of traffic cost one MGET per TTL window instead of one per viewer.
 */
const LEADERBOARD_TTL_MS = 30_000;
let cache: { at: number; data: LeaderboardResponse } | null = null;

statsRouter.get("/v1/leaderboard", async (c) => {
  if (cache && Date.now() - cache.at < LEADERBOARD_TTL_MS) {
    return c.json(cache.data);
  }

  // Stable key order: every metric of every module, plus its visits counter.
  const entries: { module: string; metric: string }[] = [];
  for (const [module, metrics] of Object.entries(STAT_METRICS)) {
    entries.push({ module, metric: VISITS_METRIC });
    for (const metric of Object.keys(metrics)) entries.push({ module, metric });
  }

  const redis = getRedis();
  let values: (number | null)[] = entries.map(() => null);
  if (redis) {
    try {
      values = await redis.mget<(number | null)[]>(
        ...entries.map((e) => statKey(e.module, e.metric))
      );
    } catch (err) {
      console.error("Leaderboard read failed:", err);
      return c.json({ error: "Stats unavailable" }, 502);
    }
  }

  const modules: Record<string, ModuleStats> = {};
  for (const module of Object.keys(STAT_METRICS)) {
    modules[module] = { visits: 0, metrics: {} };
  }
  entries.forEach(({ module, metric }, i) => {
    const value = Number(values[i] ?? 0);
    if (metric === VISITS_METRIC) modules[module].visits = value;
    else modules[module].metrics[metric] = value;
  });

  const data: LeaderboardResponse = { modules, live: redis !== null };
  cache = { at: Date.now(), data };
  return c.json(data);
});
