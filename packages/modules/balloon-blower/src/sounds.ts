/**
 * Synthesized sound effects for the balloon blower.
 *
 *  - A continuous air hiss while inflating, pitched up as the balloon fills.
 *  - A rubbery stress creak while past full (the danger zone).
 *  - A bang + thump when the balloon pops.
 *  - A squeaky double-chirp when a balloon is tied off.
 *
 * Everything routes through the shared @scroll-goblin/ui audio bus so the
 * global mute toggle applies.
 */

import { getAudioBus, getNoiseBuffer } from "@scroll-goblin/ui";

export interface InflateHiss {
  /** Feed blow strength (0..1) and fill fraction (0..1) every frame. */
  update(blow: number, fillFrac: number): void;
  stop(): void;
}

/** Filtered-noise hiss that tracks how hard the user is blowing. */
export function startInflateHiss(): InflateHiss {
  const { ctx: ac, out } = getAudioBus();

  const src = ac.createBufferSource();
  src.buffer = getNoiseBuffer(ac);
  src.loop = true;

  const filter = ac.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = 1000;
  filter.Q.value = 0.9;

  const gain = ac.createGain();
  gain.gain.value = 0;

  src.connect(filter).connect(gain).connect(out);
  src.start();

  return {
    update(blow, fillFrac) {
      const now = ac.currentTime;
      const target = blow > 0.05 ? Math.min(0.14, blow * 0.18) : 0;
      gain.gain.setTargetAtTime(target, now, 0.06);
      // Pitch rises with fill so a near-full balloon hisses tighter.
      filter.frequency.setTargetAtTime(
        900 + fillFrac * 1800 + blow * 400,
        now,
        0.08
      );
    },
    stop() {
      const now = ac.currentTime;
      gain.gain.setTargetAtTime(0, now, 0.04);
      src.stop(now + 0.3);
    },
  };
}

/** Short rubbery creak; intensity (0..1) raises pitch and volume. */
export function playCreak(intensity: number): void {
  const { ctx: ac, out } = getAudioBus();
  const now = ac.currentTime;
  const i = Math.max(0, Math.min(1, intensity));

  const osc = ac.createOscillator();
  osc.type = "sawtooth";
  const hz = 70 + i * 60;
  osc.frequency.setValueAtTime(hz, now);
  osc.frequency.linearRampToValueAtTime(hz * 1.5, now + 0.16);

  const filter = ac.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = 320 + i * 280;
  filter.Q.value = 4;

  const gain = ac.createGain();
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.05 + i * 0.07, now + 0.03);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);

  osc.connect(filter).connect(gain).connect(out);
  osc.start(now);
  osc.stop(now + 0.2);
}

/** The burst: a broadband noise bang plus a low sine thump. */
export function playPop(): void {
  const { ctx: ac, out } = getAudioBus();
  const now = ac.currentTime;

  const bang = ac.createBufferSource();
  bang.buffer = getNoiseBuffer(ac);
  const bangFilter = ac.createBiquadFilter();
  bangFilter.type = "lowpass";
  bangFilter.frequency.setValueAtTime(8000, now);
  bangFilter.frequency.exponentialRampToValueAtTime(700, now + 0.2);
  const bangGain = ac.createGain();
  bangGain.gain.setValueAtTime(0.5, now);
  bangGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
  bang.connect(bangFilter).connect(bangGain).connect(out);
  bang.start(now);
  bang.stop(now + 0.25);

  const thump = ac.createOscillator();
  thump.type = "sine";
  thump.frequency.setValueAtTime(160, now);
  thump.frequency.exponentialRampToValueAtTime(40, now + 0.25);
  const thumpGain = ac.createGain();
  thumpGain.gain.setValueAtTime(0.45, now);
  thumpGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);
  thump.connect(thumpGain).connect(out);
  thump.start(now);
  thump.stop(now + 0.3);
}

/** Squeaky double-chirp for banking a balloon. */
export function playTieOff(): void {
  const { ctx: ac, out } = getAudioBus();
  for (const [delay, from, to] of [
    [0, 620, 1050],
    [0.1, 740, 1250],
  ] as const) {
    const start = ac.currentTime + delay;
    const osc = ac.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(from, start);
    osc.frequency.exponentialRampToValueAtTime(to, start + 0.07);
    const gain = ac.createGain();
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.12, start + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.09);
    osc.connect(gain).connect(out);
    osc.start(start);
    osc.stop(start + 0.1);
  }
}
