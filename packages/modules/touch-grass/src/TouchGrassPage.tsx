import { useEffect, useRef, useState } from "react";
import {
  Card,
  ShareButton,
  consumeShareSnapshot,
  trackStat,
} from "@scroll-goblin/ui";

/** Number of grass blades in the field. */
const BLADE_COUNT = 110;
/** Pointer influence radius in px. */
const RADIUS = 80;
/** How long a plucked blade takes to regrow (ms). */
const REGROW_MS = 4000;

interface Blade {
  /** Horizontal position as a fraction of field width. */
  x: number;
  /** Blade height in px. */
  h: number;
  /** Blade width in px. */
  w: number;
  /** Green hue for variety. */
  hue: number;
  /** Resting lean so the field looks natural. */
  rest: number;
  /** Phase offset so the ambient breeze doesn't move every blade in lockstep. */
  phase: number;
  // -- live physics state (mutated per frame, never in React state) --
  angle: number;
  vel: number;
  squash: number;
  squashVel: number;
  plucked: boolean;
  regrowAt: number;
  /** 1..MAX_GROWTH — watered grass grows taller. */
  growth: number;
  /** 0..1 — watered grass turns a richer green. */
  wet: number;
  /** Set when growth/wet changed and the element style needs refreshing. */
  dirty: boolean;
}

/** How tall watered grass can get, as a multiple of its natural height. */
const MAX_GROWTH = 1.35;

function makeBlades(): Blade[] {
  return Array.from({ length: BLADE_COUNT }, () => ({
    x: Math.random(),
    h: 50 + Math.random() * 80,
    w: 3 + Math.random() * 3,
    hue: 95 + Math.random() * 40,
    rest: (Math.random() - 0.5) * 14,
    phase: Math.random() * Math.PI * 2,
    angle: 0,
    vel: 0,
    squash: 1,
    squashVel: 0,
    plucked: false,
    regrowAt: 0,
    growth: 1,
    wet: 0,
    dirty: false,
  }));
}

/**
 * Compact per-blade tuple for share links: [x, h, w, hue, rest, growth, wet].
 * Live physics values (angle, squash, ...) are transient and regenerate.
 */
type BladeTuple = [number, number, number, number, number, number, number];

/** State captured in a shareable link. Bump SHARE_VERSION on shape changes. */
interface ShareState {
  touches: number;
  plucks: number;
  waters: number;
  blades: BladeTuple[];
}

const MODULE_ID = "touch-grass";
const SHARE_VERSION = 1;

const round = (n: number, places: number) => {
  const f = 10 ** places;
  return Math.round(n * f) / f;
};

function toTuples(blades: Blade[]): BladeTuple[] {
  return blades.map((b) => [
    round(b.x, 3),
    round(b.h, 1),
    round(b.w, 2),
    round(b.hue, 1),
    round(b.rest, 1),
    round(b.growth, 3),
    round(b.wet, 2),
  ]);
}

function fromTuples(tuples: BladeTuple[]): Blade[] {
  return tuples.map(([x, h, w, hue, rest, growth, wet]) => ({
    x,
    h,
    w,
    hue,
    rest,
    phase: Math.random() * Math.PI * 2,
    angle: 0,
    vel: 0,
    squash: 1,
    squashVel: 0,
    plucked: false,
    regrowAt: 0,
    growth,
    wet,
    // Force a first-frame restyle so growth/wetness render immediately.
    dirty: true,
  }));
}

const MESSAGES: Record<string, string> = {
  idle: "The grass awaits your touch.",
  brush: "The grass sways gently under your hand. 🍃",
  pat: "You patted the grass. It appreciates the attention.",
  hold: "You're really pressing into it now. The grass forgives you.",
  pluck: "You plucked a blade! It'll grow back... eventually. 🌿",
  regrow: "A new blade has grown back. Nature heals. 🌱",
  water: "Glug glug. The grass drinks happily. 💧",
  thriving: "The grass has never looked greener. It's thriving!",
};

type Mode = "touch" | "water";

export default function TouchGrassPage() {
  // Consume a share snapshot exactly once; the URL param is stripped so a
  // refresh or fresh navigation starts the module blank.
  const [snapshot] = useState(() =>
    consumeShareSnapshot<ShareState>(MODULE_ID, SHARE_VERSION)
  );

  const fieldRef = useRef<HTMLDivElement>(null);
  const bladeEls = useRef<(HTMLDivElement | null)[]>([]);
  const blades = useRef<Blade[]>([]);
  if (blades.current.length === 0) {
    blades.current = snapshot?.blades?.length
      ? fromTuples(snapshot.blades)
      : makeBlades();
  }

  // Pointer state lives in a ref: it changes every frame and must not re-render.
  const pointer = useRef({ x: -9999, y: -9999, vx: 0, down: false, active: false });
  const lastBrushMsg = useRef(0);
  const lastDroplet = useRef(0);
  const saidThriving = useRef(false);
  // The rAF loop closes over this ref so mode switches apply without restarting it.
  const modeRef = useRef<Mode>("touch");

  const [mode, setModeState] = useState<Mode>("touch");
  const [touches, setTouches] = useState(snapshot?.touches ?? 0);
  const [plucks, setPlucks] = useState(snapshot?.plucks ?? 0);
  const [waters, setWaters] = useState(snapshot?.waters ?? 0);
  const [message, setMessage] = useState(
    snapshot
      ? "Someone shared their patch of grass with you. Treat it well."
      : MESSAGES.idle
  );

  const setMode = (m: Mode) => {
    modeRef.current = m;
    setModeState(m);
  };

  // Physics loop: springs pull each blade back to rest; the pointer pushes
  // blades away (brush), flattens them (press), and plucks remove them.
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const field = fieldRef.current;
      if (field) {
        const W = field.clientWidth;
        const H = field.clientHeight;
        const p = pointer.current;
        const now = performance.now();

        const watering = modeRef.current === "water" && p.down && p.active;

        // Spawn falling droplets under the pointer while watering.
        if (watering && now - lastDroplet.current > 55) {
          lastDroplet.current = now;
          for (let d = 0; d < 2; d++) {
            const drop = document.createElement("span");
            const dropX = p.x + (Math.random() - 0.5) * 44;
            drop.style.cssText = `position:absolute;left:${dropX}px;top:${p.y}px;width:3px;height:9px;border-radius:9999px;background:rgba(59,130,246,0.65);pointer-events:none;`;
            field.appendChild(drop);
            drop
              .animate(
                [
                  { transform: "translateY(0)", opacity: 0.9 },
                  { transform: `translateY(${Math.max(H - p.y - 10, 0)}px)`, opacity: 0.4 },
                ],
                { duration: 450 + Math.random() * 200, easing: "ease-in" }
              )
              .addEventListener("finish", () => drop.remove());
          }
        }

        blades.current.forEach((b, i) => {
          const el = bladeEls.current[i];
          if (!el) return;

          // Regrow plucked blades.
          if (b.plucked && now >= b.regrowAt) {
            b.plucked = false;
            b.squash = 0.05;
            b.angle = b.rest;
            setMessage(MESSAGES.regrow);
          }

          // Ambient breeze: a gentle, per-blade offset sine so the field is
          // always alive and motion blends smoothly into interactions.
          let target = b.rest + Math.sin(now / 1100 + b.phase + b.x * 5) * 2.5;
          let squashTarget = 1;

          if (!b.plucked && p.active) {
            const bx = b.x * W;
            const dx = bx - p.x;
            const dist = Math.abs(dx);
            const falloff = dist < RADIUS ? 1 - dist / RADIUS : 0;
            const dir = dx === 0 ? (Math.random() < 0.5 ? -1 : 1) : Math.sign(dx);
            const overBlade = p.y > H - b.h * b.growth - 30;

            if (watering && falloff > 0) {
              // Water lands anywhere below the pointer: grow, green up, and
              // bob slightly under the falling drops.
              b.wet = Math.min(1, b.wet + 0.008 * falloff);
              b.growth = Math.min(MAX_GROWTH, b.growth + 0.0018 * falloff);
              b.dirty = true;
              target += dir * falloff * 3;
              if (b.wet >= 1 && !saidThriving.current) {
                saidThriving.current = true;
                setMessage(MESSAGES.thriving);
              }
            } else if (!watering && falloff > 0 && overBlade) {
              if (p.down && modeRef.current === "touch") {
                // Press: flatten and splay outward (gentler than before).
                target = dir * falloff * 45;
                squashTarget = 1 - falloff * 0.35;
              } else if (!p.down) {
                // Brush: subtle sway away, easing up with pointer speed.
                const speed = Math.min(Math.abs(p.vx), 18);
                target += dir * falloff * (6 + speed * 0.6);
              }
            }
          }

          // Softer angle spring: lower stiffness + light damping = smooth,
          // wavy motion instead of a snappy twitch.
          b.vel += (target - b.angle) * 0.045 - b.vel * 0.1;
          b.angle += b.vel;

          // Squash spring (also animates regrowth).
          const sTarget = b.plucked ? 0 : squashTarget;
          b.squashVel += (sTarget - b.squash) * 0.12 - b.squashVel * 0.25;
          b.squash += b.squashVel;

          el.style.transform = `rotate(${b.angle}deg) scaleY(${Math.max(b.squash, 0)})`;

          // Watered blades get taller and greener; only restyle when changed.
          if (b.dirty) {
            b.dirty = false;
            el.style.height = `${b.h * b.growth}px`;
            el.style.background = `linear-gradient(to top, hsl(${b.hue}, ${55 + b.wet * 25}%, ${30 - b.wet * 4}%), hsl(${b.hue}, ${65 + b.wet * 25}%, ${45 + b.wet * 5}%))`;
          }
        });

        // Pointer velocity decays so brush force fades between move events.
        p.vx *= 0.8;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const toLocal = (e: { clientX: number; clientY: number }) => {
    const rect = fieldRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const { x, y } = toLocal(e);
    const p = pointer.current;
    p.vx = x - (p.active ? p.x : x);
    p.x = x;
    p.y = y;
    p.active = true;

    const now = performance.now();
    if (!p.down && modeRef.current === "touch" && now - lastBrushMsg.current > 2500) {
      lastBrushMsg.current = now;
      setMessage(MESSAGES.brush);
    }
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const { x, y } = toLocal(e);
    const p = pointer.current;
    p.x = x;
    p.y = y;
    p.down = true;
    p.active = true;
    if (modeRef.current === "water") {
      setWaters((w) => w + 1);
      trackStat(MODULE_ID, "waters");
      setMessage(MESSAGES.water);
    } else {
      setTouches((t) => t + 1);
      trackStat(MODULE_ID, "touches");
      setMessage(MESSAGES.pat);
    }
  };

  const endPress = () => {
    pointer.current.down = false;
  };

  const onPointerLeave = () => {
    pointer.current.active = false;
    pointer.current.down = false;
  };

  const onDoubleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const field = fieldRef.current;
    if (!field || modeRef.current !== "touch") return;
    const { x } = toLocal(e);
    const W = field.clientWidth;

    // Pluck the nearest standing blade within reach.
    let best = -1;
    let bestDist = RADIUS;
    blades.current.forEach((b, i) => {
      if (b.plucked) return;
      const d = Math.abs(b.x * W - x);
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    });
    if (best === -1) return;

    const blade = blades.current[best];
    blade.plucked = true;
    blade.regrowAt = performance.now() + REGROW_MS;
    setPlucks((n) => n + 1);
    trackStat(MODULE_ID, "plucks");
    setMessage(MESSAGES.pluck);

    // A little leaf pops out where the blade was plucked.
    const pop = document.createElement("span");
    pop.textContent = "🌿";
    pop.style.cssText = `position:absolute;left:${blade.x * 100}%;bottom:${blade.h}px;font-size:20px;pointer-events:none;`;
    field.appendChild(pop);
    pop
      .animate(
        [
          { transform: "translateY(0) rotate(0deg)", opacity: 1 },
          { transform: "translateY(-70px) rotate(140deg)", opacity: 0 },
        ],
        { duration: 900, easing: "ease-out" }
      )
      .addEventListener("finish", () => pop.remove());
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:py-12">
      <header className="mb-bento grid gap-bento sm:grid-cols-[1fr_1fr]">
        <div className="rounded-neobrutal border-thick border-brand-border bg-brand-primary p-5 shadow-neo-lg">
          <div className="mb-4 inline-flex items-center gap-2 rounded-neobrutal border-thin border-brand-border bg-brand-background px-3 py-1 text-xs font-bold uppercase shadow-neo-sm">
          🌱 Touch Grass
          </div>
          <h1 className="font-heading text-4xl uppercase leading-none text-brand-text sm:text-5xl">
          Go ahead. Touch the grass.
          </h1>
        </div>
        <p className="rounded-neobrutal border-thick border-brand-border bg-brand-surface p-5 text-sm font-bold leading-relaxed shadow-neo-lg">
          Brush it, press to flatten it, double-click to pluck a blade — or
          grab the watering can and help it grow.
        </p>
      </header>

      <Card className="overflow-hidden bg-brand-background">
        {/* Mode toggle */}
        <div className="flex flex-col gap-3 border-b-thick border-brand-border bg-brand-warning p-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-sm font-bold">
            <button
              onClick={() => setMode("touch")}
              className={`rounded-neobrutal border-thin border-brand-border px-3 py-1.5 shadow-neo-sm transition-[transform,box-shadow,background-color] duration-100 active:translate-x-0.5 active:translate-y-0.5 active:shadow-neo-pressed ${
                mode === "touch"
                  ? "bg-brand-background text-brand-text"
                  : "bg-brand-surface text-brand-text"
              }`}
            >
              ✋ Touch
            </button>
            <button
              onClick={() => setMode("water")}
              className={`rounded-neobrutal border-thin border-brand-border px-3 py-1.5 shadow-neo-sm transition-[transform,box-shadow,background-color] duration-100 active:translate-x-0.5 active:translate-y-0.5 active:shadow-neo-pressed ${
                mode === "water"
                  ? "bg-brand-background text-brand-text"
                  : "bg-brand-surface text-brand-text"
              }`}
            >
              🚿 Water
            </button>
          </div>
          <p className="text-xs font-bold text-brand-text">
            {mode === "water"
              ? "Press and hold to pour"
              : "Brush, press, or double-click"}
          </p>
        </div>

        <div
          ref={fieldRef}
          onPointerMove={onPointerMove}
          onPointerDown={onPointerDown}
          onPointerUp={endPress}
          onPointerCancel={onPointerLeave}
          onPointerLeave={onPointerLeave}
          onDoubleClick={onDoubleClick}
          className="relative h-80 w-full cursor-pointer touch-none select-none overflow-hidden bg-gradient-to-b from-brand-secondary via-white to-brand-primary"
        >
          {/* Sun */}
          <div className="absolute right-8 top-6 h-14 w-14 rounded-full border-thick border-brand-border bg-brand-warning shadow-neo-md" />

          {/* Ground */}
          <div className="absolute bottom-0 h-10 w-full border-t-thick border-brand-border bg-brand-primary" />

          {/* Grass blades */}
          {blades.current.map((b, i) => (
            <div
              key={i}
              ref={(el) => (bladeEls.current[i] = el)}
              className="absolute bottom-0 origin-bottom rounded-t-full will-change-transform"
              style={{
                left: `${b.x * 100}%`,
                width: b.w,
                height: b.h,
                background: `linear-gradient(to top, hsl(${b.hue}, 55%, 30%), hsl(${b.hue}, 65%, 45%))`,
              }}
            />
          ))}
        </div>

        <div className="flex flex-col gap-3 border-t-thick border-brand-border bg-brand-surface p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-bold text-brand-text">{message}</p>
          <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-brand-text">
            <span>
              Touches: <span className="bg-brand-primary px-1">{touches}</span>
            </span>
            <span>
              Plucked: <span className="bg-brand-secondary px-1">{plucks}</span>
            </span>
            <span>
              Waterings: <span className="bg-brand-warning px-1">{waters}</span>
            </span>
            <ShareButton
              moduleId={MODULE_ID}
              version={SHARE_VERSION}
              disabled={touches === 0 && plucks === 0 && waters === 0}
              getState={(): ShareState => ({
                touches,
                plucks,
                waters,
                blades: toTuples(blades.current),
              })}
              className="!px-3 !py-1.5 !shadow-neo-sm"
            />
          </div>
        </div>
      </Card>
    </div>
  );
}
