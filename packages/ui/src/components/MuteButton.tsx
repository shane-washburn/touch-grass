import { useSyncExternalStore } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { isMuted, subscribeMuted, toggleMuted } from "../audio";

/**
 * Site-wide sound toggle. The mute state is shared and persisted, so flipping
 * it in any module silences (or restores) sound effects everywhere.
 */
export function MuteButton({ className = "" }: { className?: string }) {
  const muted = useSyncExternalStore(subscribeMuted, isMuted);

  return (
    <button
      onClick={toggleMuted}
      aria-pressed={muted}
      title={muted ? "Unmute sound effects" : "Mute sound effects"}
      className={`inline-flex items-center gap-1.5 rounded-neobrutal border-thin border-brand-border bg-brand-background px-3 py-1.5 text-xs font-bold text-brand-text shadow-neo-sm transition-[transform,box-shadow] duration-100 active:translate-x-0.5 active:translate-y-0.5 active:shadow-neo-pressed ${className}`}
    >
      {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
      {muted ? "Muted" : "Sound"}
    </button>
  );
}
