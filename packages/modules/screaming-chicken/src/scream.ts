/**
 * Web Audio synthesis for the rubber chicken.
 *
 * Two sounds:
 *  - A breathy wheeze while the chicken is being squeezed (air leaving).
 *  - The scream on release: a sawtooth with a falling pitch envelope,
 *    vibrato, formant bandpass filters, and a noise rasp layer. Depth of
 *    the squeeze (0..1) controls pitch, duration, and loudness.
 *
 * No assets — everything is generated, so the scream scales continuously
 * with how hard the chicken was squeezed.
 */

let ctx: AudioContext | null = null;

function getCtx(): AudioContext {
  if (!ctx) ctx = new AudioContext();
  // Browsers suspend contexts created before a user gesture; resume lazily.
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

/** Shared looping white-noise buffer (lazy, ~1s). */
let noiseBuffer: AudioBuffer | null = null;
function getNoiseBuffer(ac: AudioContext): AudioBuffer {
  if (!noiseBuffer) {
    noiseBuffer = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  return noiseBuffer;
}

/** Soft tanh saturation curve for that strangled-kazoo edge. */
function makeSaturationCurve(amount: number): Float32Array {
  const n = 256;
  const curve = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    curve[i] = Math.tanh(x * amount);
  }
  return curve;
}

export interface Wheeze {
  /** Feed the current squeeze pressure (0..1) every frame. */
  setPressure(p: number): void;
  stop(): void;
}

/** Quiet filtered-noise hiss while air is squeezed out of the chicken. */
export function startWheeze(): Wheeze {
  const ac = getCtx();
  const src = ac.createBufferSource();
  src.buffer = getNoiseBuffer(ac);
  src.loop = true;

  const filter = ac.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = 900;
  filter.Q.value = 1.2;

  const gain = ac.createGain();
  gain.gain.value = 0;

  src.connect(filter).connect(gain).connect(ac.destination);
  src.start();

  let last = 0;
  return {
    setPressure(p: number) {
      const now = ac.currentTime;
      // Louder while the squeeze is actively deepening (air rushing out).
      const delta = Math.max(0, p - last) * 25;
      last = p;
      const target = Math.min(0.1, 0.015 + p * 0.035 + delta);
      gain.gain.setTargetAtTime(target, now, 0.05);
      filter.frequency.setTargetAtTime(800 + p * 1600, now, 0.05);
    },
    stop() {
      const now = ac.currentTime;
      gain.gain.setTargetAtTime(0, now, 0.04);
      src.stop(now + 0.3);
    },
  };
}

/** A short hollow "pop" for when an egg is squeezed out. */
export function playPop(): void {
  const ac = getCtx();
  const now = ac.currentTime;

  const osc = ac.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(420, now);
  osc.frequency.exponentialRampToValueAtTime(130, now + 0.12);

  const gain = ac.createGain();
  gain.gain.setValueAtTime(0.001, now);
  gain.gain.exponentialRampToValueAtTime(0.4, now + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);

  osc.connect(gain).connect(ac.destination);
  osc.start(now);
  osc.stop(now + 0.16);
}

/**
 * Play the scream. `depth` is how deep the squeeze was (0..1).
 * Returns the scream duration in milliseconds so the UI can animate along.
 */
export function playScream(depth: number): number {
  const ac = getCtx();
  const now = ac.currentTime;
  const d = Math.min(Math.max(depth, 0.05), 1);
  const dur = 0.35 + d * 1.15;

  // --- Voice: sawtooth with rise-then-fall pitch + vibrato ---
  const osc = ac.createOscillator();
  osc.type = "sawtooth";
  const startHz = 330 + d * 360;
  osc.frequency.setValueAtTime(startHz, now);
  osc.frequency.linearRampToValueAtTime(startHz * 1.08, now + dur * 0.2);
  osc.frequency.exponentialRampToValueAtTime(150, now + dur);

  const vibrato = ac.createOscillator();
  vibrato.type = "sine";
  vibrato.frequency.value = 9 + d * 5;
  const vibratoGain = ac.createGain();
  vibratoGain.gain.value = 12 + d * 38;
  vibrato.connect(vibratoGain).connect(osc.frequency);

  // --- Timbre: saturation into two parallel formant bandpasses ---
  const shaper = ac.createWaveShaper();
  shaper.curve = makeSaturationCurve(2.5 + d * 3) as typeof shaper.curve;

  const formant1 = ac.createBiquadFilter();
  formant1.type = "bandpass";
  formant1.frequency.value = 680;
  formant1.Q.value = 2;

  const formant2 = ac.createBiquadFilter();
  formant2.type = "bandpass";
  formant2.frequency.value = 1900;
  formant2.Q.value = 3;

  // --- Rasp: a thin noise layer riding the same envelope ---
  const rasp = ac.createBufferSource();
  rasp.buffer = getNoiseBuffer(ac);
  rasp.loop = true;
  const raspFilter = ac.createBiquadFilter();
  raspFilter.type = "bandpass";
  raspFilter.frequency.value = 1500;
  raspFilter.Q.value = 1.5;
  const raspGain = ac.createGain();
  raspGain.gain.value = 0.12 + d * 0.1;

  // --- Amplitude envelope: snap on, hold, wheeze out ---
  const gain = ac.createGain();
  const peak = 0.25 + d * 0.3;
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(peak, now + 0.025);
  gain.gain.setValueAtTime(peak, now + dur * 0.55);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);

  osc.connect(shaper);
  shaper.connect(formant1).connect(gain);
  shaper.connect(formant2).connect(gain);
  rasp.connect(raspFilter).connect(raspGain).connect(gain);
  gain.connect(ac.destination);

  osc.start(now);
  vibrato.start(now);
  rasp.start(now);
  const stopAt = now + dur + 0.05;
  osc.stop(stopAt);
  vibrato.stop(stopAt);
  rasp.stop(stopAt);
  osc.addEventListener("ended", () => gain.disconnect());

  return dur * 1000;
}
