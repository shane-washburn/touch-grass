import type { TranslateRequest, TranslateResponse } from "@scroll-goblin/shared";

/**
 * Minimal in-memory LRU-ish cache for identical requests.
 * Identical (input + direction + targetLanguage) costs zero tokens on repeat.
 * Swap this module for Upstash Redis in production without touching callers.
 *
 * The key is the composite request string itself — collision-free and with no
 * node:crypto dependency, so this module runs on the Edge runtime too.
 */
const MAX_ENTRIES = 500;
const store = new Map<string, TranslateResponse>();

export function cacheKey(req: TranslateRequest): string {
  return `${req.direction}|${req.targetLanguage}|${req.input}`;
}

export function getCached(key: string): TranslateResponse | undefined {
  const hit = store.get(key);
  if (hit) {
    // refresh recency
    store.delete(key);
    store.set(key, hit);
  }
  return hit;
}

export function setCached(key: string, value: TranslateResponse): void {
  if (store.size >= MAX_ENTRIES) {
    const oldest = store.keys().next().value;
    if (oldest) store.delete(oldest);
  }
  store.set(key, value);
}
