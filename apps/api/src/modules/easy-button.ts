import { Hono } from "hono";
import { EasyButtonClipIdSchema } from "@scroll-goblin/shared";
import { getRedis } from "../redis.js";

export const easyButtonRouter = new Hono();

const MAX_BYTES = 500 * 1024;
const CLIP_TTL_SECONDS = 7 * 24 * 60 * 60;
const RATE_WINDOW_SECONDS = 60 * 60;
const MAX_UPLOADS_PER_WINDOW = 10;

const ALLOWED_MIME_TYPES = new Set([
  "audio/webm",
  "audio/mp4",
  "audio/mpeg",
  "audio/wav",
  "audio/x-wav",
]);

interface StoredClip {
  mime: string;
  base64: string;
  createdAt: number;
  expiresAt: number;
}

const clipKey = (id: string) => `easy-button:clip:${id}`;
const rateKey = (ip: string, bucket: number) =>
  `easy-button:rate:${ip}:${bucket}`;

function clientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || headers.get("x-real-ip") || "unknown";
}

function contentMime(contentType: string | undefined): string {
  return (contentType ?? "").split(";")[0].trim().toLowerCase();
}

function newClipId(): string {
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
    ""
  );
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

async function enforceRateLimit(ip: string): Promise<
  | { ok: true }
  | { ok: false; status: 429; body: { error: string; retryAfterSeconds: number } }
> {
  const redis = getRedis();
  if (!redis) {
    return {
      ok: false,
      status: 429,
      body: {
        error: "Clip storage is not configured.",
        retryAfterSeconds: RATE_WINDOW_SECONDS,
      },
    };
  }

  const bucket = Math.floor(Date.now() / (RATE_WINDOW_SECONDS * 1000));
  const key = rateKey(ip, bucket);
  const count = await redis.incr(key);
  if (count === 1) await redis.expire(key, RATE_WINDOW_SECONDS);

  if (count > MAX_UPLOADS_PER_WINDOW) {
    return {
      ok: false,
      status: 429,
      body: {
        error: "Too many recordings uploaded. Try again in an hour.",
        retryAfterSeconds: RATE_WINDOW_SECONDS,
      },
    };
  }

  return { ok: true };
}

easyButtonRouter.post("/v1/clips", async (c) => {
  const redis = getRedis();
  if (!redis) return c.json({ error: "Clip storage is not configured." }, 503);

  const rate = await enforceRateLimit(clientIp(c.req.raw.headers));
  if (rate.ok === false) {
    return c.json(rate.body, rate.status, {
      "Retry-After": String(rate.body.retryAfterSeconds),
    });
  }

  const mime = contentMime(c.req.header("content-type"));
  if (!ALLOWED_MIME_TYPES.has(mime)) {
    return c.json({ error: "Unsupported audio format." }, 415);
  }

  const contentLength = Number(c.req.header("content-length") ?? 0);
  if (contentLength > MAX_BYTES) {
    return c.json({ error: "Recording is too large." }, 413);
  }

  const bytes = await c.req.arrayBuffer();
  if (bytes.byteLength === 0) {
    return c.json({ error: "Recording is empty." }, 400);
  }
  if (bytes.byteLength > MAX_BYTES) {
    return c.json({ error: "Recording is too large." }, 413);
  }

  const now = Date.now();
  const expiresAt = now + CLIP_TTL_SECONDS * 1000;
  const clipId = newClipId();
  const stored: StoredClip = {
    mime,
    base64: arrayBufferToBase64(bytes),
    createdAt: now,
    expiresAt,
  };

  try {
    await redis.set(clipKey(clipId), stored, { ex: CLIP_TTL_SECONDS });
  } catch (err) {
    console.error("Easy Button clip write failed:", err);
    return c.json({ error: "Could not save recording." }, 502);
  }

  return c.json({
    clipId,
    expiresAt: new Date(expiresAt).toISOString(),
  });
});

easyButtonRouter.get("/v1/clips/:id", async (c) => {
  const id = c.req.param("id");
  if (!EasyButtonClipIdSchema.safeParse(id).success) {
    return c.json({ error: "Clip not found." }, 404);
  }

  const redis = getRedis();
  if (!redis) return c.json({ error: "Clip storage is not configured." }, 503);

  let clip: StoredClip | null = null;
  try {
    clip = await redis.get<StoredClip>(clipKey(id));
  } catch (err) {
    console.error("Easy Button clip read failed:", err);
    return c.json({ error: "Could not load recording." }, 502);
  }

  if (!clip || Date.now() >= clip.expiresAt) {
    return c.json({ error: "Clip not found." }, 404);
  }

  const maxAge = Math.max(
    0,
    Math.min(3600, Math.floor((clip.expiresAt - Date.now()) / 1000))
  );
  const audio = base64ToArrayBuffer(clip.base64);

  return new Response(audio, {
    headers: {
      "Content-Type": clip.mime,
      "Content-Length": String(audio.byteLength),
      "Cache-Control": `public, max-age=${maxAge}, s-maxage=${maxAge}, immutable`,
    },
  });
});
