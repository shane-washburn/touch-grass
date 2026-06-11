import type { ComponentType } from "react";

/**
 * The contract every module in the suite must fulfill.
 *
 * The shell discovers modules exclusively through this manifest: the landing
 * page renders a card from the metadata, and the router lazy-loads the
 * component via `load` so each module is its own code-split chunk.
 */
export interface ModuleManifest {
  /** Stable unique id, also used as the API route namespace (`/api/<id>/...`). */
  id: string;
  /** Display name shown on the landing page card. */
  title: string;
  /** One-or-two sentence blurb for the landing page card. */
  description: string;
  /** Emoji used as the module's icon. */
  emoji: string;
  /** Route the module is mounted at, e.g. `/apps/emoji-translator`. */
  path: string;
  /** Lifecycle state; `hidden` modules are routable but not listed. */
  status?: "active" | "beta" | "hidden";
  /**
   * Optional override when a module's backend lives in a separate deployment.
   * When omitted, the module uses the suite's default API base URL.
   */
  apiBaseUrl?: string;
  /** Lazy entry point — keeps the landing page bundle small. */
  load: () => Promise<{ default: ComponentType }>;
}
