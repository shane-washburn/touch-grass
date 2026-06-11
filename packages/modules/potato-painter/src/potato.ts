/**
 * Procedural potato generation. Every potato is a smooth, lumpy blob built
 * from randomized polar points, so no two potatoes are ever the same — but
 * they are all unmistakably potato-shaped.
 */

export interface PotatoVariety {
  name: string;
  blurb: string;
  /** Base skin color in HSL components. */
  hue: number;
  sat: number;
  light: number;
  /** Width-to-height ratio range — fingerlings are long, reds are round. */
  aspect: [number, number];
  /** Rendered width range in px. */
  size: [number, number];
}

export const VARIETIES: PotatoVariety[] = [
  {
    name: "Russet",
    blurb: "The classic. Reliable. Earthy.",
    hue: 30,
    sat: 32,
    light: 42,
    aspect: [1.25, 1.6],
    size: [72, 100],
  },
  {
    name: "Yukon Gold",
    blurb: "Buttery and smug about it.",
    hue: 45,
    sat: 55,
    light: 55,
    aspect: [1.05, 1.3],
    size: [60, 86],
  },
  {
    name: "Red Bliss",
    blurb: "Small, round, full of joy.",
    hue: 8,
    sat: 42,
    light: 46,
    aspect: [1.0, 1.2],
    size: [50, 72],
  },
  {
    name: "Purple Majesty",
    blurb: "Royalty among tubers.",
    hue: 276,
    sat: 28,
    light: 36,
    aspect: [1.2, 1.5],
    size: [56, 82],
  },
  {
    name: "Sweet Potato",
    blurb: "Technically not a potato. Don't tell it.",
    hue: 18,
    sat: 68,
    light: 46,
    aspect: [1.6, 2.1],
    size: [78, 108],
  },
  {
    name: "Fingerling",
    blurb: "Long. Weird. Beautiful.",
    hue: 42,
    sat: 42,
    light: 60,
    aspect: [2.2, 3.0],
    size: [70, 98],
  },
];

export interface Potato {
  id: string;
  varietyIndex: number;
  /** Closed SVG path in a normalized -1..1 coordinate space. */
  path: string;
  /** Rendered footprint in px. */
  w: number;
  h: number;
  /** Resting tilt so the tray looks like a pile, not a lineup. */
  rotation: number;
  skin: string;
  spotColor: string;
  outline: string;
  /** Potato eyes/spots, in the same normalized space. */
  spots: { x: number; y: number; r: number }[];
}

const rand = (min: number, max: number) => min + Math.random() * (max - min);

let potatoCounter = 0;

/**
 * Build the lumpy outline: points around a circle with low-frequency sine
 * bulges plus per-point jitter, then smoothed with quadratic curves through
 * segment midpoints so the result is organic rather than polygonal.
 */
function blobPath(): string {
  const N = 12;
  const freq = Math.random() < 0.5 ? 2 : 3;
  const phase = Math.random() * Math.PI * 2;
  const bulge = rand(0.1, 0.2);

  const pts: { x: number; y: number }[] = [];
  let maxR = 0;
  for (let i = 0; i < N; i++) {
    const ang = (i / N) * Math.PI * 2;
    const r =
      1 + Math.sin(ang * freq + phase) * bulge + (Math.random() - 0.5) * 0.14;
    maxR = Math.max(maxR, r);
    pts.push({ x: Math.cos(ang) * r, y: Math.sin(ang) * r });
  }
  // Normalize so the blob always fills its -1..1 box.
  for (const p of pts) {
    p.x /= maxR;
    p.y /= maxR;
  }

  const mid = (a: { x: number; y: number }, b: { x: number; y: number }) => ({
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
  });

  const f = (n: number) => n.toFixed(3);
  const start = mid(pts[N - 1], pts[0]);
  let d = `M ${f(start.x)} ${f(start.y)}`;
  for (let i = 0; i < N; i++) {
    const p = pts[i];
    const next = mid(p, pts[(i + 1) % N]);
    d += ` Q ${f(p.x)} ${f(p.y)} ${f(next.x)} ${f(next.y)}`;
  }
  return d + " Z";
}

export function makePotato(varietyIndex: number): Potato {
  const v = VARIETIES[varietyIndex];
  const w = rand(v.size[0], v.size[1]);
  const h = w / rand(v.aspect[0], v.aspect[1]);

  // Slight per-potato color jitter so siblings don't look cloned.
  const hue = v.hue + rand(-4, 4);
  const sat = v.sat + rand(-5, 5);
  const light = v.light + rand(-4, 4);

  const spotCount = 4 + Math.floor(Math.random() * 5);
  const spots = Array.from({ length: spotCount }, () => {
    const ang = Math.random() * Math.PI * 2;
    const dist = Math.random() * 0.62;
    return {
      x: Math.cos(ang) * dist,
      y: Math.sin(ang) * dist,
      r: rand(0.04, 0.1),
    };
  });

  return {
    id: `potato-${++potatoCounter}`,
    varietyIndex,
    path: blobPath(),
    w,
    h,
    rotation: rand(-14, 14),
    skin: `hsl(${hue}, ${sat}%, ${light}%)`,
    spotColor: `hsl(${hue}, ${Math.min(sat + 8, 100)}%, ${Math.max(light - 14, 8)}%)`,
    outline: `hsl(${hue}, ${sat}%, ${Math.max(light - 26, 5)}%)`,
    spots,
  };
}

/** Stamp a potato print onto a 2D canvas at (x, y) with a little jitter. */
export function stampPotato(
  ctx: CanvasRenderingContext2D,
  potato: Potato,
  x: number,
  y: number,
  rotation: number
) {
  const shape = new Path2D(potato.path);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate((rotation * Math.PI) / 180);
  ctx.scale(potato.w / 2, potato.h / 2);

  ctx.fillStyle = potato.skin;
  ctx.fill(shape);
  ctx.lineWidth = 0.07;
  ctx.strokeStyle = potato.outline;
  ctx.stroke(shape);

  ctx.fillStyle = potato.spotColor;
  for (const s of potato.spots) {
    ctx.beginPath();
    ctx.ellipse(s.x, s.y, s.r, s.r * rand(0.7, 1), rand(0, Math.PI), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}
