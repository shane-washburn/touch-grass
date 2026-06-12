/**
 * Shared Web Audio plumbing for module sound effects.
 *
 * Provides a lazy singleton AudioContext routed through a master gain so a
 * single persisted mute toggle silences every module. All sounds are
 * synthesized (no asset files), following the pattern established by
 * screaming-chicken. Browsers suspend contexts created before a user
 * gesture, so the context is resumed lazily on every access — callers should
 * only start continuous loops in response to user interaction.
 */

const MUTE_KEY = "scroll-goblin:muted";

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noiseBuffer: AudioBuffer | null = null;

let muted = (() => {
  try {
    return localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    return false;
  }
})();

const muteListeners = new Set<() => void>();

export interface AudioBus {
  ctx: AudioContext;
  /** Master output — connect sounds here, never to ctx.destination. */
  out: GainNode;
}

/** Lazily create (and resume) the shared context + master gain. */
export function getAudioBus(): AudioBus {
  if (!ctx) {
    // iOS Safari < 14.5 only exposes the prefixed constructor.
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    ctx = new Ctor();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 1;
    master.connect(ctx.destination);
  }
  if (ctx.state === "suspended") void ctx.resume();
  return { ctx, out: master! };
}

/** Shared looping white-noise buffer (lazy, ~1s). */
export function getNoiseBuffer(ac: AudioContext): AudioBuffer {
  if (!noiseBuffer) {
    noiseBuffer = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  return noiseBuffer;
}

export function isMuted(): boolean {
  return muted;
}

export function setMuted(next: boolean): void {
  muted = next;
  try {
    localStorage.setItem(MUTE_KEY, next ? "1" : "0");
  } catch {
    /* private mode — preference just won't persist */
  }
  if (master && ctx) {
    master.gain.setTargetAtTime(next ? 0 : 1, ctx.currentTime, 0.02);
  }
  muteListeners.forEach((l) => l());
}

export function toggleMuted(): void {
  setMuted(!muted);
}

/** Subscribe to mute changes; returns an unsubscribe (useSyncExternalStore-compatible). */
export function subscribeMuted(listener: () => void): () => void {
  muteListeners.add(listener);
  return () => muteListeners.delete(listener);
}
