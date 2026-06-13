import { useState } from "react";
import { Check, Link2, Share2 } from "lucide-react";
import { buildShareUrl } from "../share";
import { trackShareButtonPress } from "../analytics";

interface ShareButtonProps {
  /** Module id used to namespace the share payload. */
  moduleId: string;
  /** Module-defined schema version for the payload. */
  version: number;
  /** Returns the serializable state to capture at share time. */
  getState: () => unknown;
  /** Disable when there is nothing worth sharing yet. */
  disabled?: boolean;
  /** Override the max share-URL length (for modules with larger payloads). */
  maxLength?: number;
  className?: string;
}

/**
 * Copies a link to the current module with its state encoded in the URL.
 * The recipient sees the captured state once; the link self-cleans on load.
 */
export function ShareButton({
  moduleId,
  version,
  getState,
  disabled = false,
  maxLength,
  className = "",
}: ShareButtonProps) {
  const [status, setStatus] = useState<"idle" | "copied" | "too-long">("idle");

  const onShare = async () => {
    const url = buildShareUrl(moduleId, version, getState(), maxLength);
    if (!url) {
      trackShareButtonPress({ moduleId, result: "too_long" });
      setStatus("too-long");
      setTimeout(() => setStatus("idle"), 2000);
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      trackShareButtonPress({ moduleId, result: "copied" });
      setStatus("copied");
      setTimeout(() => setStatus("idle"), 1500);
    } catch {
      trackShareButtonPress({ moduleId, result: "failed" });
      setStatus("idle");
    }
  };

  return (
    <button
      onClick={onShare}
      disabled={disabled}
      title="Copy a shareable link"
      className={`inline-flex items-center gap-2 rounded-neobrutal border-thick border-brand-border bg-brand-secondary px-4 py-2.5 text-sm font-bold text-brand-text shadow-neo-md transition-[transform,box-shadow,background-color] duration-100 active:translate-x-1 active:translate-y-1 active:shadow-neo-pressed disabled:cursor-not-allowed disabled:opacity-50 disabled:active:translate-x-0 disabled:active:translate-y-0 disabled:active:shadow-neo-md ${className}`}
    >
      {status === "copied" ? (
        <>
          <Check className="h-4 w-4" />
          Link copied!
        </>
      ) : status === "too-long" ? (
        <>
          <Link2 className="h-4 w-4" />
          Too big to share
        </>
      ) : (
        <>
          <Share2 className="h-4 w-4" />
          Share
        </>
      )}
    </button>
  );
}
