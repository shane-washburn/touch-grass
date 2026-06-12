/**
 * Synthesized sound effects for slug fencing.
 *
 *  - A wet whoosh when a slug lunges (the rival's is quieter).
 *  - A bright splat when the player lands a hit.
 *  - An airy whiff for a missed lunge.
 *  - A dull thud when the rival lands one on the player.
 *  - A low buzz when too tired to lunge, and a tick when energy is ready.
 *
 * Everything routes through the shared @scroll-goblin/ui audio bus so the
 * global mute toggle applies.
 */

import { getAudioBus, getNoiseBuffer } from "@scroll-goblin/ui";

/** Wet whoosh for a lunge; volume scales the whole effect (rival = quieter). */
export function playLunge(volume = 1): void {
  const { ctx: ac, out } = getAudioBus();
  const now = ac.currentTime;

  const whoosh = ac.createBufferSource();
  whoosh.buffer = getNoiseBuffer(ac);
  const filter = ac.createBiquadFilter();
  filter.type = "bandpass";
  filter.Q.value = 1.2;
  filter.frequency.setValueAtTime(2400, now);
  filter.frequency.exponentialRampToValueAtTime(600, now + 0.18);
  const gain = ac.createGain();
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.18 * volume, now + 0.03);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);
  whoosh.connect(filter).connect(gain).connect(out);
  whoosh.start(now);
  whoosh.stop(now + 0.22);

  // A little downward squelch underneath the air.
  const squelch = ac.createOscillator();
  squelch.type = "sine";
  squelch.frequency.setValueAtTime(380, now);
  squelch.frequency.exponentialRampToValueAtTime(140, now + 0.14);
  const sGain = ac.createGain();
  sGain.gain.setValueAtTime(0.0001, now);
  sGain.gain.exponentialRampToValueAtTime(0.07 * volume, now + 0.02);
  sGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.15);
  squelch.connect(sGain).connect(out);
  squelch.start(now);
  squelch.stop(now + 0.17);
}

/** Bright slimy splat for the player's landed hit. */
export function playHit(): void {
  const { ctx: ac, out } = getAudioBus();
  const now = ac.currentTime;

  const splat = ac.createBufferSource();
  splat.buffer = getNoiseBuffer(ac);
  const filter = ac.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(3500, now);
  filter.frequency.exponentialRampToValueAtTime(500, now + 0.14);
  const gain = ac.createGain();
  gain.gain.setValueAtTime(0.35, now);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
  splat.connect(filter).connect(gain).connect(out);
  splat.start(now);
  splat.stop(now + 0.18);

  const smack = ac.createOscillator();
  smack.type = "triangle";
  smack.frequency.setValueAtTime(320, now);
  smack.frequency.exponentialRampToValueAtTime(90, now + 0.12);
  const sGain = ac.createGain();
  sGain.gain.setValueAtTime(0.3, now);
  sGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);
  smack.connect(sGain).connect(out);
  smack.start(now);
  smack.stop(now + 0.16);
}

/** Airy whiff for a lunge that found only empty air. */
export function playMiss(): void {
  const { ctx: ac, out } = getAudioBus();
  const now = ac.currentTime;

  const whiff = ac.createBufferSource();
  whiff.buffer = getNoiseBuffer(ac);
  const filter = ac.createBiquadFilter();
  filter.type = "highpass";
  filter.frequency.value = 3200;
  const gain = ac.createGain();
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.09, now + 0.03);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);
  whiff.connect(filter).connect(gain).connect(out);
  whiff.start(now);
  whiff.stop(now + 0.16);
}

/** Dull body-blow thud for when the rival lands a hit on the player. */
export function playGotHit(): void {
  const { ctx: ac, out } = getAudioBus();
  const now = ac.currentTime;

  const thud = ac.createOscillator();
  thud.type = "sine";
  thud.frequency.setValueAtTime(150, now);
  thud.frequency.exponentialRampToValueAtTime(48, now + 0.22);
  const gain = ac.createGain();
  gain.gain.setValueAtTime(0.4, now);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.24);
  thud.connect(gain).connect(out);
  thud.start(now);
  thud.stop(now + 0.26);

  const slap = ac.createBufferSource();
  slap.buffer = getNoiseBuffer(ac);
  const filter = ac.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 800;
  const nGain = ac.createGain();
  nGain.gain.setValueAtTime(0.18, now);
  nGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.1);
  slap.connect(filter).connect(nGain).connect(out);
  slap.start(now);
  slap.stop(now + 0.12);
}

/** Low "too pooped" buzz for lunging without enough energy. */
export function playTired(): void {
  const { ctx: ac, out } = getAudioBus();
  const now = ac.currentTime;

  const buzz = ac.createOscillator();
  buzz.type = "square";
  buzz.frequency.setValueAtTime(90, now);
  buzz.frequency.linearRampToValueAtTime(70, now + 0.16);
  const gain = ac.createGain();
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.07, now + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
  buzz.connect(gain).connect(out);
  buzz.start(now);
  buzz.stop(now + 0.2);
}

/** Tiny tick when energy refills enough to lunge again. */
export function playReady(): void {
  const { ctx: ac, out } = getAudioBus();
  const now = ac.currentTime;

  const tick = ac.createOscillator();
  tick.type = "sine";
  tick.frequency.value = 950;
  const gain = ac.createGain();
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.06, now + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.05);
  tick.connect(gain).connect(out);
  tick.start(now);
  tick.stop(now + 0.06);
}
