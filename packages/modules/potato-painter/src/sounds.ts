/**
 * Synthesized sound effects for the potato painter.
 *
 *  - A small blip when a potato is picked up from the tray.
 *  - A wet thud when it stamps onto the canvas.
 *  - A descending womp when it rolls back to the tray unused.
 *  - A swoosh when the canvas is wiped.
 *
 * Everything routes through the shared @scroll-goblin/ui audio bus so the
 * global mute toggle applies.
 */

import { getAudioBus, getNoiseBuffer } from "@scroll-goblin/ui";

/** Cheery little blip when a spud is picked up. */
export function playPickup(): void {
  const { ctx: ac, out } = getAudioBus();
  const now = ac.currentTime;

  const osc = ac.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(330, now);
  osc.frequency.exponentialRampToValueAtTime(480, now + 0.06);
  const gain = ac.createGain();
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.12, now + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);
  osc.connect(gain).connect(out);
  osc.start(now);
  osc.stop(now + 0.1);
}

/** Wet potato-on-canvas thud for a stamp. */
export function playStamp(): void {
  const { ctx: ac, out } = getAudioBus();
  const now = ac.currentTime;

  const splat = ac.createBufferSource();
  splat.buffer = getNoiseBuffer(ac);
  const filter = ac.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(2200, now);
  filter.frequency.exponentialRampToValueAtTime(400, now + 0.1);
  const gain = ac.createGain();
  gain.gain.setValueAtTime(0.28, now);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
  splat.connect(filter).connect(gain).connect(out);
  splat.start(now);
  splat.stop(now + 0.14);

  const thud = ac.createOscillator();
  thud.type = "sine";
  thud.frequency.setValueAtTime(210, now);
  thud.frequency.exponentialRampToValueAtTime(70, now + 0.12);
  const tGain = ac.createGain();
  tGain.gain.setValueAtTime(0.3, now);
  tGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);
  thud.connect(tGain).connect(out);
  thud.start(now);
  thud.stop(now + 0.16);
}

/** Sad descending womp for a potato returned to the tray. */
export function playReturn(): void {
  const { ctx: ac, out } = getAudioBus();
  const now = ac.currentTime;

  const osc = ac.createOscillator();
  osc.type = "triangle";
  osc.frequency.setValueAtTime(300, now);
  osc.frequency.exponentialRampToValueAtTime(120, now + 0.18);
  const gain = ac.createGain();
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.1, now + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);
  osc.connect(gain).connect(out);
  osc.start(now);
  osc.stop(now + 0.22);
}

/** Sweeping swoosh for wiping the canvas clean. */
export function playWipe(): void {
  const { ctx: ac, out } = getAudioBus();
  const now = ac.currentTime;

  const swoosh = ac.createBufferSource();
  swoosh.buffer = getNoiseBuffer(ac);
  const filter = ac.createBiquadFilter();
  filter.type = "bandpass";
  filter.Q.value = 1;
  filter.frequency.setValueAtTime(700, now);
  filter.frequency.exponentialRampToValueAtTime(3200, now + 0.25);
  const gain = ac.createGain();
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.1, now + 0.04);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);
  swoosh.connect(filter).connect(gain).connect(out);
  swoosh.start(now);
  swoosh.stop(now + 0.3);
}
