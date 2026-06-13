/// <reference types="vite/client" />
import {
  EasyButtonClipUploadResponseSchema,
  type EasyButtonClipUploadResponse,
} from "@scroll-goblin/shared";

const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8787"
).replace(/\/+$/, "");

const MODULE_API = `${API_BASE_URL}/easy-button`;

export class ClipNotFoundError extends Error {
  constructor() {
    super("Clip not found");
    this.name = "ClipNotFoundError";
  }
}

export async function uploadClip(
  clip: Blob,
  signal?: AbortSignal
): Promise<EasyButtonClipUploadResponse> {
  const res = await fetch(`${MODULE_API}/v1/clips`, {
    method: "POST",
    headers: { "Content-Type": clip.type || "application/octet-stream" },
    body: clip,
    signal,
  });

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const message =
      (data && typeof data.error === "string" && data.error) ||
      `Upload failed (${res.status})`;
    throw new Error(message);
  }

  return EasyButtonClipUploadResponseSchema.parse(data);
}

export async function fetchClip(clipId: string): Promise<Blob> {
  const res = await fetch(`${MODULE_API}/v1/clips/${encodeURIComponent(clipId)}`);
  if (res.status === 404) throw new ClipNotFoundError();
  if (!res.ok) throw new Error(`Clip fetch failed (${res.status})`);
  return res.blob();
}
