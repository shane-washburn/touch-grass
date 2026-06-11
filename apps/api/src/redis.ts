import { Redis } from "@upstash/redis";

/**
 * Lazily-constructed Upstash Redis client (HTTP-based, serverless-safe).
 *
 * Returns null when UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN are not
 * configured, so the API degrades gracefully: tracking becomes a no-op and
 * the leaderboard reports zeros with `live: false`.
 */
let client: Redis | null | undefined;

export function getRedis(): Redis | null {
  if (client !== undefined) return client;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  client = url && token ? new Redis({ url, token }) : null;
  if (!client) {
    console.warn(
      "Upstash Redis not configured (UPSTASH_REDIS_REST_URL/TOKEN) — stats are disabled."
    );
  }
  return client;
}
