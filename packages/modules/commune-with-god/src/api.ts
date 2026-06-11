/// <reference types="vite/client" />
import {
  CommuneResponseSchema,
  type CommuneRequest,
  type CommuneResponse,
} from "@scroll-goblin/shared";

const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8787"
).replace(/\/+$/, "");

/** This module's API namespace on the suite backend. */
const MODULE_API = `${API_BASE_URL}/commune-with-god`;

/**
 * The ONLY place this module knows about the backend: a single typed client
 * that speaks the shared contract. Swap the backend by changing VITE_API_BASE_URL.
 */
export async function askTheDivine(
  req: CommuneRequest,
  signal?: AbortSignal
): Promise<CommuneResponse> {
  const res = await fetch(`${MODULE_API}/v1/ask`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
    signal,
  });

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    const message =
      (data && typeof data.error === "string" && data.error) ||
      `Request failed (${res.status})`;
    throw new Error(message);
  }

  // Validate the response against the shared contract too — defensive decoupling.
  return CommuneResponseSchema.parse(data);
}
