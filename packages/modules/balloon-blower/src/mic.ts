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
 *
 * Two extra guards keep random noise from inflating the balloon:
 * 1. Spectral flatness — a blow has a flat, noise-like spectrum, while
 *    speech/music/clatter concentrate energy in a few peaky bins. Tonal
 *    sounds are scaled way down before they reach the meter.
 * 2. Sustain fatigue — a real breath lasts a few seconds at most. Signal
 *    that stays loud beyond that window has its contribution progressively
 *    degraded, so droning background noise can't keep the balloon growing.
 *    Fatigue recovers during quiet, mimicking the user taking a breath.
 */

const clamp = (v: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, v));

export interface BlowMic {
  /** Current blow strength, 0..1, smoothed for animation. */
  level(): number;
  /** Release the mic stream and close the audio context. */
  stop(): void;
}

/**
 * Mobile detection for mic tuning. Phone/tablet mics run aggressive
 * hardware-level wind/noise suppression that we can't fully disable via
 * getUserMedia constraints, so a blow registers far weaker than on a desktop
 * mic. The coarse-pointer check catches iPadOS, which masquerades as macOS
 * in its user agent.
 */
const IS_MOBILE =
  /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) ||
  (typeof window.matchMedia === "function" &&
    window.matchMedia("(pointer: coarse)").matches);

/**
 * Tuning constants — chosen to map a comfortable blow to the upper range.
 * Mobile gets a much lower gate and scale (~2× sensitivity) to compensate
 * for the suppressed signal; desktop mics are already plenty sensitive.
 */
const GATE = IS_MOBILE ? 0.015 : 0.05; // headroom above the noise floor before anything registers
const SCALE = IS_MOBILE ? 0.35 : 1.05; // raw signal that maps to full strength
const ATTACK = 0.35; // how fast the meter rises toward a louder target
const RELEASE = 0.45; // how fast it falls toward a quieter target

/**
 * Spectral-flatness gate. Flatness (geometric mean / arithmetic mean of the
 * spectrum) is ~1 for noise-like blows and approaches 0 for tonal sounds
 * like voices or music. Signal below FLAT_LO is fully rejected; full credit
 * is restored by FLAT_HI. Mobile mics' wind suppression smears the spectrum,
 * so the band sits lower there.
 */
const FLAT_LO = IS_MOBILE ? 0.05 : 0.18;
const FLAT_HI = IS_MOBILE ? 0.18 : 0.45;

/**
 * Sustain fatigue. A signal can stay loud for SUSTAIN_GRACE seconds at full
 * credit (roughly one solid exhale); beyond that, credit decays toward
 * FATIGUE_FLOOR over FATIGUE_RAMP seconds. Quiet time refunds the budget at
 * RECOVERY_RATE× speed, so normal blow–breathe–blow rhythm never fatigues.
 */
const SUSTAIN_GRACE = 2.5; // seconds of continuous signal at full credit
const FATIGUE_RAMP = 2.0; // seconds over which credit fades after the grace
const FATIGUE_FLOOR = 0.15; // residual credit for endless noise
const RECOVERY_RATE = 2.0; // quiet seconds counted double when recovering

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
  analyser.smoothingTimeConstant = 0.3;

  // iOS Safari only processes an AnalyserNode if the graph reaches the
  // destination. Route the analyser through a muted (gain 0) node so the
  // graph actually runs — without this the analyser reads pure silence on
  // mobile and the balloon never inflates. Gain 0 means no audible feedback.
  const sink = ac.createGain();
  sink.gain.value = 0;
  source.connect(analyser);
  analyser.connect(sink);
  sink.connect(ac.destination);

  const timeData = new Float32Array(analyser.fftSize);
  const freqData = new Uint8Array(analyser.frequencyBinCount);
  const lowBins = Math.max(1, Math.floor(analyser.frequencyBinCount * 0.12));

  let smoothed = 0;
  let noiseFloor = 0.02;
  let sustained = 0; // seconds of continuous above-gate signal
  let lastTime = performance.now();

  return {
    level() {
      const now = performance.now();
      const dt = Math.min((now - lastTime) / 1000, 0.1);
      lastTime = now;
      // Mobile browsers can re-suspend the context (e.g. after the permission
      // prompt or a tab switch); keep nudging it back to life.
      if (ac.state === "suspended") void ac.resume();

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

      // Spectral flatness over the speech-and-blow band (skip DC, ignore the
      // empty top of the spectrum): geometric/arithmetic mean of bin energy.
      // Noise-like blows score high; tonal sounds (voice, music) score low.
      const flatBins = Math.floor(analyser.frequencyBinCount * 0.5);
      let logSum = 0;
      let linSum = 0;
      for (let i = 1; i < flatBins; i++) {
        const v = freqData[i] / 255 + 1e-4;
        logSum += Math.log(v);
        linSum += v;
      }
      const n = flatBins - 1;
      const flatness = Math.exp(logSum / n) / (linSum / n);
      const blowiness = clamp((flatness - FLAT_LO) / (FLAT_HI - FLAT_LO), 0, 1);

      const raw = (rms * 2 + lowAvg * 0.6) * blowiness;

      // Adaptive floor: drop quickly toward quiet, creep up slowly so a
      // sustained blow can't be "learned" as background and ignored. The
      // creep is slower on mobile, where suppressed blows sit much closer
      // to the floor and would otherwise get absorbed into it.
      if (raw < noiseFloor) noiseFloor = noiseFloor * 0.9 + raw * 0.1;
      else noiseFloor = Math.min(noiseFloor + (IS_MOBILE ? 0.0003 : 0.0006), raw);

      let target = clamp((raw - noiseFloor - GATE) / SCALE, 0, 1);

      // Sustain fatigue: track how long the signal has stayed above the gate.
      // Within the grace window a blow gets full credit; past it, credit
      // ramps down toward the floor. Quiet time pays the budget back faster
      // than it accrues, so pausing for a breath fully resets it.
      if (target > 0.05) {
        sustained += dt;
      } else {
        sustained = Math.max(0, sustained - dt * RECOVERY_RATE);
      }
      const over = Math.max(0, sustained - SUSTAIN_GRACE);
      const fatigue =
        1 - (1 - FATIGUE_FLOOR) * clamp(over / FATIGUE_RAMP, 0, 1);
      target *= fatigue;

      const rate = target > smoothed ? ATTACK : RELEASE;
      smoothed += (target - smoothed) * rate;
      return smoothed;
    },
    stop() {
      for (const track of stream.getTracks()) track.stop();
      source.disconnect();
      analyser.disconnect();
      sink.disconnect();
      void ac.close();
    },
  };
}
