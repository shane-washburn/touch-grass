/**
 * Synthesized sound effects for touch grass.
 *
 * Continuous layers (started on first interaction, never on page load —
 * browsers block audio before a user gesture):
 *  - A faint ambient breeze that slowly swells and fades.
 *  - A rustle that follows how fast the pointer brushes through the blades.
 *  - A pour while watering, with a slow bubbly wobble.
 *
 * One-shots: a snap when a blade is plucked, a boing when one regrows, and a
 * little chime when a blade reaches full wetness.
 *
 * Everything routes through the shared @scroll-goblin/ui audio bus so the
 * global mute toggle applies.
 */

import { getAudioBus, getNoiseBuffer } from "@scroll-goblin/ui";

export interface GrassAudio {
  /** Rustle intensity (0..1), fed every frame from pointer speed. */
  setBrush(level: number): void;
  /** Whether water is currently pouring. */
  setPour(on: boolean): void;
  stop(): void;
}

export function startGrassAudio(): GrassAudio {
  const { ctx: ac, out } = getAudioBus();
  const noise = getNoiseBuffer(ac);

  // --- Ambient breeze: soft low noise, swelling on a slow LFO ---
  const breezeSrc = ac.createBufferSource();
  breezeSrc.buffer = noise;
  breezeSrc.loop = true;
  const breezeFilter = ac.createBiquadFilter();
  breezeFilter.type = "lowpass";
  breezeFilter.frequency.value = 420;
  const breezeGain = ac.createGain();
  breezeGain.gain.value = 0;
  breezeGain.gain.setTargetAtTime(0.018, ac.currentTime, 1.5);
  const breezeLfo = ac.createOscillator();
  breezeLfo.type = "sine";
  breezeLfo.frequency.value = 0.13;
  const breezeLfoGain = ac.createGain();
  breezeLfoGain.gain.value = 0.01;
  breezeLfo.connect(breezeLfoGain).connect(breezeGain.gain);
  breezeSrc.connect(breezeFilter).connect(breezeGain).connect(out);
  breezeSrc.start();
  breezeLfo.start();

  // --- Brush rustle: brighter noise band, gain driven by pointer speed ---
  const rustleSrc = ac.createBufferSource();
  rustleSrc.buffer = noise;
  rustleSrc.loop = true;
  const rustleFilter = ac.createBiquadFilter();
  rustleFilter.type = "bandpass";
  rustleFilter.frequency.value = 2800;
  rustleFilter.Q.value = 0.8;
  const rustleGain = ac.createGain();
  rustleGain.gain.value = 0;
  rustleSrc.connect(rustleFilter).connect(rustleGain).connect(out);
  rustleSrc.start();

  // --- Watering pour: low noise with a gentle bubbly wobble ---
  const pourSrc = ac.createBufferSource();
  pourSrc.buffer = noise;
  pourSrc.loop = true;
  const pourFilter = ac.createBiquadFilter();
  pourFilter.type = "lowpass";
  pourFilter.frequency.value = 950;
  const pourGain = ac.createGain();
  pourGain.gain.value = 0;
  const pourLfo = ac.createOscillator();
  pourLfo.type = "sine";
  pourLfo.frequency.value = 7;
  const pourLfoGain = ac.createGain();
  pourLfoGain.gain.value = 0;
  pourLfo.connect(pourLfoGain).connect(pourGain.gain);
  pourSrc.connect(pourFilter).connect(pourGain).connect(out);
  pourSrc.start();
  pourLfo.start();

  return {
    setBrush(level) {
      const v = Math.max(0, Math.min(1, level));
      rustleGain.gain.setTargetAtTime(v * 0.11, ac.currentTime, 0.05);
    },
    setPour(on) {
      const now = ac.currentTime;
      pourGain.gain.setTargetAtTime(on ? 0.1 : 0, now, on ? 0.06 : 0.12);
      pourLfoGain.gain.setTargetAtTime(on ? 0.025 : 0, now, 0.1);
    },
    stop() {
      const now = ac.currentTime;
      for (const g of [breezeGain, rustleGain, pourGain]) {
        g.gain.setTargetAtTime(0, now, 0.05);
      }
      for (const s of [breezeSrc, rustleSrc, pourSrc, breezeLfo, pourLfo]) {
        s.stop(now + 0.4);
      }
    },
  };
}

/** Snap + pop for plucking a blade. */
export function playPluck(): void {
  const { ctx: ac, out } = getAudioBus();
  const now = ac.currentTime;

  const snap = ac.createBufferSource();
  snap.buffer = getNoiseBuffer(ac);
  const snapFilter = ac.createBiquadFilter();
  snapFilter.type = "highpass";
  snapFilter.frequency.value = 2000;
  const snapGain = ac.createGain();
  snapGain.gain.setValueAtTime(0.18, now);
  snapGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.05);
  snap.connect(snapFilter).connect(snapGain).connect(out);
  snap.start(now);
  snap.stop(now + 0.06);

  const pop = ac.createOscillator();
  pop.type = "triangle";
  pop.frequency.setValueAtTime(520, now);
  pop.frequency.exponentialRampToValueAtTime(170, now + 0.1);
  const popGain = ac.createGain();
  popGain.gain.setValueAtTime(0.2, now);
  popGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
  pop.connect(popGain).connect(out);
  pop.start(now);
  pop.stop(now + 0.14);
}

/** Springy boing for a blade growing back. */
export function playRegrow(): void {
  const { ctx: ac, out } = getAudioBus();
  const now = ac.currentTime;

  const boing = ac.createOscillator();
  boing.type = "sine";
  boing.frequency.setValueAtTime(240, now);
  boing.frequency.exponentialRampToValueAtTime(540, now + 0.16);
  const gain = ac.createGain();
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.1, now + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);
  boing.connect(gain).connect(out);
  boing.start(now);
  boing.stop(now + 0.22);
}

/** Sparkle chime when a blade reaches full wetness. */
export function playThriving(): void {
  const { ctx: ac, out } = getAudioBus();
  for (const [delay, hz] of [
    [0, 880],
    [0.11, 1320],
  ] as const) {
    const start = ac.currentTime + delay;
    const osc = ac.createOscillator();
    osc.type = "sine";
    osc.frequency.value = hz;
    const gain = ac.createGain();
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.08, start + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.25);
    osc.connect(gain).connect(out);
    osc.start(start);
    osc.stop(start + 0.28);
  }
}
