/**
 * Microphone "blow strength" meter.
 *
 * Opens the mic, runs the signal through an AnalyserNode, and exposes a single
 * smoothed `level()` in 0..1 representing how hard the user is blowing.
 *
 * Blowing is broadband, low-frequency-heavy turbulence, so we combine the
 * time-domain RMS with the energy in the lowest frequency bins. An adaptive
 * noise floor (which tracks the quietest recent level) lets the meter ignore
 * steady room noise without per-device calibration, so a silent room reads ~0
 * and a hard puff reads ~1.
 */

const clamp = (v: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, v));

export interface BlowMic {
  /** Current blow strength, 0..1, smoothed for animation. */
  level(): number;
  /** Release the mic stream and close the audio context. */
  stop(): void;
}

/** Tuning constants — chosen to map a comfortable blow to the upper range. */
const GATE = 0.04; // headroom above the noise floor before anything registers
const SCALE = 0.9; // raw signal that maps to full strength
const ATTACK = 0.35; // how fast the meter rises toward a louder target
const RELEASE = 0.22; // how fast it falls toward a quieter target

export async function startBlowMic(): Promise<BlowMic> {
  // Disable browser DSP: AGC/noise-suppression actively fight broadband puffs.
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
    },
  });

  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  const ac = new Ctor();
  if (ac.state === "suspended") await ac.resume();

  const source = ac.createMediaStreamSource(stream);
  const analyser = ac.createAnalyser();
  analyser.fftSize = 1024;
  analyser.smoothingTimeConstant = 0.5;
  source.connect(analyser);
  // Note: we deliberately do NOT connect to ac.destination — no feedback.

  const timeData = new Float32Array(analyser.fftSize);
  const freqData = new Uint8Array(analyser.frequencyBinCount);
  const lowBins = Math.max(1, Math.floor(analyser.frequencyBinCount * 0.12));

  let smoothed = 0;
  let noiseFloor = 0.02;

  return {
    level() {
      analyser.getFloatTimeDomainData(timeData);
      let sumSq = 0;
      for (let i = 0; i < timeData.length; i++) {
        sumSq += timeData[i] * timeData[i];
      }
      const rms = Math.sqrt(sumSq / timeData.length);

      analyser.getByteFrequencyData(freqData);
      let lowSum = 0;
      for (let i = 0; i < lowBins; i++) lowSum += freqData[i];
      const lowAvg = lowSum / lowBins / 255; // 0..1

      const raw = rms * 2 + lowAvg * 0.6;

      // Adaptive floor: drop quickly toward quiet, creep up slowly so a
      // sustained blow can't be "learned" as background and ignored.
      if (raw < noiseFloor) noiseFloor = noiseFloor * 0.9 + raw * 0.1;
      else noiseFloor = Math.min(noiseFloor + 0.0006, raw);

      const target = clamp((raw - noiseFloor - GATE) / SCALE, 0, 1);
      const rate = target > smoothed ? ATTACK : RELEASE;
      smoothed += (target - smoothed) * rate;
      return smoothed;
    },
    stop() {
      for (const track of stream.getTracks()) track.stop();
      source.disconnect();
      void ac.close();
    },
  };
}
