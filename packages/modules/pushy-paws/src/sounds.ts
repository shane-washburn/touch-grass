import { getAudioBus, getNoiseBuffer } from "@scroll-goblin/ui";

export type SoundKind =
  | "potion"
  | "crystal"
  | "scroll"
  | "wand"
  | "mug"
  | "plant"
  | "books"
  | "portrait"
  | "chalice"
  | "rune"
  | "mouse";

function noiseBurst(
  ac: AudioContext,
  out: GainNode,
  start: number,
  duration: number,
  gainValue: number,
  filterType: BiquadFilterType,
  frequency: number
) {
  const src = ac.createBufferSource();
  src.buffer = getNoiseBuffer(ac);
  const filter = ac.createBiquadFilter();
  filter.type = filterType;
  filter.frequency.value = frequency;
  const gain = ac.createGain();
  gain.gain.setValueAtTime(gainValue, start);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  src.connect(filter).connect(gain).connect(out);
  src.start(start);
  src.stop(start + duration + 0.02);
}

function tone(
  ac: AudioContext,
  out: GainNode,
  start: number,
  duration: number,
  freq: number,
  gainValue: number,
  type: OscillatorType = "sine",
  endFreq = freq
) {
  const osc = ac.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  if (endFreq !== freq) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), start + duration);
  }
  const gain = ac.createGain();
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(gainValue, start + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(gain).connect(out);
  osc.start(start);
  osc.stop(start + duration + 0.02);
}

export function playTap(strength: number): void {
  const { ctx: ac, out } = getAudioBus();
  const now = ac.currentTime;
  tone(ac, out, now, 0.06, 180 + strength * 34, 0.08, "triangle", 90);
  noiseBurst(ac, out, now, 0.045, 0.08, "lowpass", 900);
}

export function playLevelUp(): void {
  const { ctx: ac, out } = getAudioBus();
  const now = ac.currentTime;
  [0, 0.08, 0.16].forEach((offset, i) =>
    tone(ac, out, now + offset, 0.12, 360 + i * 180, 0.08, "sine")
  );
}

export const FALL_SOUND_MS = 760;

export function playFall(kind: SoundKind): void {
  const { ctx: ac, out } = getAudioBus();
  const now = ac.currentTime;

  noiseBurst(ac, out, now, 0.22, 0.09, "bandpass", 980);
  tone(ac, out, now + 0.04, 0.26, 220, 0.05, "triangle", 90);

  if (kind === "chalice") {
    tone(ac, out, now + 0.12, 0.32, 520, 0.05, "sine", 380);
  } else if (kind === "books" || kind === "plant" || kind === "crystal") {
    tone(ac, out, now + 0.14, 0.28, 120, 0.08, "sine", 54);
  } else if (kind === "mouse") {
    tone(ac, out, now + 0.08, 0.16, 760, 0.04, "square", 980);
  }
}

export function playBreak(kind: SoundKind): void {
  const { ctx: ac, out } = getAudioBus();
  const now = ac.currentTime;

  switch (kind) {
    case "potion":
      noiseBurst(ac, out, now, 0.28, 0.48, "highpass", 3200);
      noiseBurst(ac, out, now + 0.05, 0.2, 0.22, "bandpass", 5200);
      noiseBurst(ac, out, now + 0.12, 0.76, 0.16, "bandpass", 1800);
      tone(ac, out, now + 0.04, 0.2, 1800, 0.07, "sine", 780);
      tone(ac, out, now + 0.13, 0.36, 980, 0.05, "sawtooth", 360);
      break;
    case "crystal":
      tone(ac, out, now, 0.18, 86, 0.3, "sine", 42);
      noiseBurst(ac, out, now + 0.07, 0.32, 0.3, "highpass", 2600);
      noiseBurst(ac, out, now + 0.13, 0.22, 0.16, "bandpass", 5600);
      tone(ac, out, now + 0.18, 0.86, 760, 0.06, "sine", 1280);
      tone(ac, out, now + 0.24, 0.66, 1210, 0.035, "sine", 920);
      break;
    case "scroll":
      noiseBurst(ac, out, now, 0.22, 0.12, "lowpass", 560);
      tone(ac, out, now, 0.15, 105, 0.05, "triangle", 70);
      break;
    case "wand":
      noiseBurst(ac, out, now, 0.18, 0.18, "bandpass", 1200);
      tone(ac, out, now + 0.08, 0.09, 280, 0.08, "square", 190);
      tone(ac, out, now + 0.19, 0.15, 1600, 0.09, "sawtooth", 2400);
      break;
    case "mug":
      noiseBurst(ac, out, now, 0.24, 0.38, "highpass", 2500);
      noiseBurst(ac, out, now + 0.06, 0.18, 0.18, "bandpass", 4700);
      noiseBurst(ac, out, now + 0.12, 0.46, 0.2, "lowpass", 700);
      noiseBurst(ac, out, now + 0.2, 0.38, 0.13, "bandpass", 390);
      tone(ac, out, now + 0.16, 0.16, 180, 0.08, "triangle", 74);
      break;
    case "plant":
      tone(ac, out, now, 0.2, 82, 0.28, "sine", 44);
      noiseBurst(ac, out, now + 0.08, 0.18, 0.12, "bandpass", 700);
      noiseBurst(ac, out, now + 0.2, 0.36, 0.11, "highpass", 2400);
      break;
    case "books":
      [0, 0.1, 0.18, 0.27].forEach((offset, i) =>
        tone(ac, out, now + offset, 0.12, 96 - i * 10, 0.2, "triangle", 48)
      );
      break;
    case "portrait":
      tone(ac, out, now, 0.1, 240, 0.16, "triangle", 120);
      noiseBurst(ac, out, now + 0.07, 0.34, 0.34, "highpass", 3100);
      noiseBurst(ac, out, now + 0.14, 0.2, 0.16, "bandpass", 5400);
      break;
    case "chalice":
      tone(ac, out, now, 1.2, 420, 0.18, "sine", 380);
      tone(ac, out, now + 0.03, 1.05, 630, 0.08, "sine", 590);
      noiseBurst(ac, out, now, 0.08, 0.14, "bandpass", 900);
      break;
    case "rune":
      tone(ac, out, now, 0.55, 74, 0.48, "sine", 34);
      noiseBurst(ac, out, now, 0.5, 0.34, "lowpass", 520);
      break;
    case "mouse":
      tone(ac, out, now, 0.16, 980, 0.12, "square", 1320);
      tone(ac, out, now + 0.11, 0.13, 760, 0.08, "square", 1120);
      break;
  }
}
