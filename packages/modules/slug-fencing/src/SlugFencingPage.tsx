import { useEffect, useRef, useState } from "react";
import {
  Card,
  MuteButton,
  ShareButton,
  consumeShareSnapshot,
  trackStat,
} from "@scroll-goblin/ui";
import {
  playGotHit,
  playHit,
  playLunge,
  playMiss,
  playReady,
  playTired,
} from "./sounds";

/** State captured in a shareable link. Bump SHARE_VERSION on shape changes. */
interface ShareState {
  playerScore: number;
  rivalScore: number;
  lunges: number;
}

const MODULE_ID = "slug-fencing";
const SHARE_VERSION = 1;
/** localStorage key for the player's preferred side (handedness). */
const SIDE_KEY = "slug-fencing:side";

/* --- Arena geometry (SVG viewBox units) --- */
const VW = 640;
const VH = 380;
const TOP_Y = 72;
const BOTTOM_Y = 312;
const LEFT_X = 150;
const RIGHT_X = 490;
const MID_X = (LEFT_X + RIGHT_X) / 2;
/** How far a lunge thrusts the head toward the rival, in viewBox units. */
const LUNGE_REACH = 260;
/** Vertical alignment window for a lunge to count as a hit. */
const HIT_Y_TOL = 34;

/* --- Lunge timing --- */
const LUNGE_MS = 360;
/** Fraction of the lunge at which contact is evaluated (the thrust apex). */
const HIT_AT = 0.46;
/** Minimum gap between lunges — "you can only lunge every so often". */
const LUNGE_COOLDOWN_MS = 450;

/* --- Energy economy --- */
const ENERGY_MAX = 100;
const ENERGY_REGEN = 26; // per second
const LUNGE_COST = 30;
const MOVE_COST_PER_UNIT = 0.05; // energy per viewBox unit travelled
const MOVE_SPEED = 380; // max vertical units per second

const clamp = (v: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, v));

interface Fencer {
  y: number;
  targetY: number;
  energy: number;
  lungeStart: number; // performance.now() of active lunge, 0 = idle
  lastLungeEnd: number; // for cooldown
  hitResolved: boolean; // contact already evaluated for current lunge
}

function makeFencer(y: number): Fencer {
  return {
    y,
    targetY: y,
    energy: ENERGY_MAX,
    lungeStart: 0,
    lastLungeEnd: 0,
    hitResolved: true,
  };
}

/** Eased out-and-back thrust offset for a lunge in progress (0..reach..0). */
function lungeOffset(now: number, start: number): number {
  if (start === 0) return 0;
  const t = (now - start) / LUNGE_MS;
  if (t >= 1) return 0;
  return Math.sin(t * Math.PI) * LUNGE_REACH;
}

const MESSAGES = {
  idle: "En garde! Slide up and down, then click to lunge.",
  hit: "TOUCHÉ! Your slug lands a slimy strike.",
  hitStreak: "Another hit! The rival recoils in disgust.",
  gotHit: "Splat — the rival lunged and got you.",
  miss: "Whiff. Your lunge slurps through empty air.",
  tired: "Too pooped to lunge. Let the energy meter refill.",
};

export default function SlugFencingPage() {
  const svgRef = useRef<SVGSVGElement>(null);
  const playerGRef = useRef<SVGGElement>(null);
  const rivalGRef = useRef<SVGGElement>(null);
  const playerEnergyRef = useRef<HTMLDivElement>(null);
  const rivalEnergyRef = useRef<HTMLDivElement>(null);
  const impactRef = useRef<SVGGElement>(null);

  // Per-frame simulation lives entirely in refs — never in React state.
  const player = useRef<Fencer>(makeFencer((TOP_Y + BOTTOM_Y) / 2));
  const rival = useRef<Fencer>(makeFencer((TOP_Y + BOTTOM_Y) / 2));
  const keyDir = useRef(0); // -1 up, +1 down, from keyboard
  const ai = useRef({ nextThink: 0, nextLunge: 0 });
  // Whether the player last had enough energy to lunge, for the ready tick.
  const couldLunge = useRef(true);
  // Tracks the active pointer gesture so we can tell a drag (move) from a
  // tap (lunge) — essential on touch, where there is no hover to steer with.
  const gesture = useRef({ x: 0, y: 0, t: 0, moved: false });

  const snapshot = useRef(
    consumeShareSnapshot<ShareState>(MODULE_ID, SHARE_VERSION)
  ).current;

  const [playerScore, setPlayerScore] = useState(snapshot?.playerScore ?? 0);
  const [rivalScore, setRivalScore] = useState(snapshot?.rivalScore ?? 0);
  const [lunges, setLunges] = useState(snapshot?.lunges ?? 0);
  const [message, setMessage] = useState(
    snapshot
      ? "A challenger shared their duel. Can you out-slime them?"
      : MESSAGES.idle
  );
  // Which side the player's slug sits on. Defaults to the right so a
  // right-handed thumb doesn't cross (and block) the arena; lefties can swap.
  const [side, setSide] = useState<"left" | "right">(() => {
    try {
      return localStorage.getItem(SIDE_KEY) === "left" ? "left" : "right";
    } catch {
      return "right";
    }
  });
  const sideRef = useRef(side);
  sideRef.current = side;
  const toggleSide = () =>
    setSide((s) => {
      const next = s === "right" ? "left" : "right";
      try {
        localStorage.setItem(SIDE_KEY, next);
      } catch {
        /* private mode — preference just won't persist */
      }
      return next;
    });
  // Mirror scores into refs so the rAF loop reads fresh values without
  // re-subscribing the effect.
  const scoreRef = useRef({ player: playerScore, rival: rivalScore });
  scoreRef.current = { player: playerScore, rival: rivalScore };

  /** Flash an impact burst at a contact point (in viewBox coords). */
  const flashImpact = (x: number, y: number) => {
    const g = impactRef.current;
    if (!g) return;
    g.setAttribute("transform", `translate(${x} ${y})`);
    g.style.opacity = "1";
    // No `fill: "forwards"`: a persisted CSS transform would permanently
    // override the SVG transform attribute used to position the burst.
    // try/catch because this runs inside the rAF tick — a WAAPI quirk on
    // older Safari must never kill the game loop.
    try {
      const anim = g.animate(
        [
          { transform: `translate(${x}px, ${y}px) scale(0.3)`, opacity: 1 },
          { transform: `translate(${x}px, ${y}px) scale(1.4)`, opacity: 0 },
        ],
        { duration: 320, easing: "ease-out" }
      );
      anim.onfinish = () => {
        g.style.opacity = "0";
      };
    } catch {
      g.style.opacity = "0";
    }
  };

  /** Attempt to start a lunge for the given fencer; returns true if launched. */
  const tryLunge = (f: Fencer, now: number): boolean => {
    if (f.lungeStart !== 0) return false; // already lunging
    if (now - f.lastLungeEnd < LUNGE_COOLDOWN_MS) return false;
    if (f.energy < LUNGE_COST) return false;
    f.energy -= LUNGE_COST;
    f.lungeStart = now;
    f.hitResolved = false;
    return true;
  };

  const playerLunge = () => {
    const now = performance.now();
    if (tryLunge(player.current, now)) {
      setLunges((n) => n + 1);
      trackStat(MODULE_ID, "lunges");
      playLunge();
    } else if (
      player.current.energy < LUNGE_COST &&
      player.current.lungeStart === 0
    ) {
      setMessage(MESSAGES.tired);
      playTired();
    }
  };

  // Main fixed-ish timestep loop.
  useEffect(() => {
    let raf = 0;
    let last = performance.now();

    const tick = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;

      stepPlayer(player.current, dt, now);
      stepRival(rival.current, player.current, dt, now);
      resolveLunges(now);
      render(now);

      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Move a fencer toward its target, spending energy, then regen the rest. */
  function applyMovement(f: Fencer, dt: number) {
    const desired = f.targetY - f.y;
    const maxStep = MOVE_SPEED * dt;
    let step = clamp(desired, -maxStep, maxStep);
    const cost = Math.abs(step) * MOVE_COST_PER_UNIT;
    if (cost > f.energy) {
      // Not enough juice to cover the full move — travel only what we can.
      const afford = f.energy / MOVE_COST_PER_UNIT;
      step = Math.sign(step) * afford;
      f.energy = 0;
    } else {
      f.energy -= cost;
    }
    f.y = clamp(f.y + step, TOP_Y, BOTTOM_Y);
    f.energy = Math.min(ENERGY_MAX, f.energy + ENERGY_REGEN * dt);
  }

  function stepPlayer(f: Fencer, dt: number, now: number) {
    if (keyDir.current !== 0) {
      f.targetY = clamp(f.targetY + keyDir.current * MOVE_SPEED * dt, TOP_Y, BOTTOM_Y);
    }
    applyMovement(f, dt);
    // A soft tick the moment a spent meter refills enough to lunge again.
    const ready = f.energy >= LUNGE_COST;
    if (ready && !couldLunge.current) playReady();
    couldLunge.current = ready;
    if (f.lungeStart !== 0 && now - f.lungeStart >= LUNGE_MS) {
      f.lungeStart = 0;
      f.lastLungeEnd = now;
    }
  }

  function stepRival(f: Fencer, foe: Fencer, dt: number, now: number) {
    // Rethink target periodically. The rival ALWAYS keeps repositioning —
    // it never freezes in place — usually shadowing the player to set up a
    // strike, sometimes juking to a random spot, sometimes dodging away.
    if (now >= ai.current.nextThink) {
      ai.current.nextThink = now + 240 + Math.random() * 360;
      const roll = Math.random();
      if (roll < 0.6) {
        // Shadow the player, with a little offset so it isn't a perfect lock.
        f.targetY = clamp(foe.y + (Math.random() * 50 - 25), TOP_Y, BOTTOM_Y);
      } else if (roll < 0.85) {
        // Juke to a fresh random spot to stay unpredictable.
        f.targetY = TOP_Y + Math.random() * (BOTTOM_Y - TOP_Y);
      } else {
        // Dodge toward the far end from the player.
        const mid = (TOP_Y + BOTTOM_Y) / 2;
        f.targetY =
          foe.y > mid
            ? TOP_Y + Math.random() * 70
            : BOTTOM_Y - Math.random() * 70;
      }
    }
    applyMovement(f, dt);

    // Lunge only when lined up AND holding an energy buffer, so it always
    // keeps enough in reserve to keep moving instead of stab-camping. A
    // reaction delay after each lunge keeps it beatable.
    if (
      now >= ai.current.nextLunge &&
      f.lungeStart === 0 &&
      f.energy > LUNGE_COST + 25
    ) {
      const aligned = Math.abs(f.y - foe.y) <= HIT_Y_TOL * 1.1;
      if (aligned && Math.random() < 0.6 && tryLunge(f, now)) {
        ai.current.nextLunge = now + 450 + Math.random() * 450;
        playLunge(0.55);
      }
    }
    if (f.lungeStart !== 0 && now - f.lungeStart >= LUNGE_MS) {
      f.lungeStart = 0;
      f.lastLungeEnd = now;
    }
  }

  /** Evaluate contact for any lunge that has reached its apex. */
  function resolveLunges(now: number) {
    const p = player.current;
    const r = rival.current;

    const apex = (f: Fencer) =>
      f.lungeStart !== 0 &&
      !f.hitResolved &&
      (now - f.lungeStart) / LUNGE_MS >= HIT_AT;

    // Player thrusts toward the rival: -x when on the right, +x on the left.
    const dir = sideRef.current === "right" ? -1 : 1;

    if (apex(p)) {
      p.hitResolved = true;
      if (Math.abs(p.y - r.y) <= HIT_Y_TOL) {
        const next = scoreRef.current.player + 1;
        setPlayerScore(next);
        trackStat(MODULE_ID, "hits");
        setMessage(next > 1 ? MESSAGES.hitStreak : MESSAGES.hit);
        flashImpact(MID_X + 60 * dir, r.y);
        playHit();
      } else {
        setMessage(MESSAGES.miss);
        playMiss();
      }
    }

    if (apex(r)) {
      r.hitResolved = true;
      if (Math.abs(r.y - p.y) <= HIT_Y_TOL) {
        setRivalScore((n) => n + 1);
        setMessage(MESSAGES.gotHit);
        flashImpact(MID_X - 60 * dir, p.y);
        playGotHit();
      }
    }
  }

  function render(now: number) {
    const p = player.current;
    const r = rival.current;

    // Sides depend on handedness; both slugs face the centre line, so the
    // right-side slug is flipped horizontally and thrusts toward -x.
    const rightHanded = sideRef.current === "right";
    const playerX = rightHanded ? RIGHT_X : LEFT_X;
    const rivalX = rightHanded ? LEFT_X : RIGHT_X;
    const dir = rightHanded ? -1 : 1; // player's thrust direction

    const pOff = lungeOffset(now, p.lungeStart);
    playerGRef.current?.setAttribute(
      "transform",
      `translate(${playerX + dir * pOff} ${p.y})${
        rightHanded ? " scale(-1 1)" : ""
      }`
    );

    const rOff = lungeOffset(now, r.lungeStart);
    rivalGRef.current?.setAttribute(
      "transform",
      `translate(${rivalX - dir * rOff} ${r.y})${
        rightHanded ? "" : " scale(-1 1)"
      }`
    );

    if (playerEnergyRef.current) {
      playerEnergyRef.current.style.width = `${(p.energy / ENERGY_MAX) * 100}%`;
    }
    if (rivalEnergyRef.current) {
      rivalEnergyRef.current.style.width = `${(r.energy / ENERGY_MAX) * 100}%`;
    }
  }

  /* --- Input handling --- */
  const toSvgY = (clientY: number) => {
    // The SVG uses the default preserveAspectRatio ("meet"), so on narrow
    // screens the drawing is letterboxed inside the element. Map through the
    // actual rendered scale/offset, otherwise the slug lags the finger badly
    // on phones.
    const rect = svgRef.current!.getBoundingClientRect();
    const scale = Math.min(rect.width / VW, rect.height / VH);
    const offsetY = (rect.height - VH * scale) / 2;
    return clamp((clientY - rect.top - offsetY) / scale, TOP_Y, BOTTOM_Y);
  };

  /**
   * Movement threshold (client px) past which a press counts as a drag.
   * Generous because thumbs on phones jitter well past a mouse's precision.
   */
  const DRAG_SLOP = 14;
  /** Max press duration (ms) that can still register as a lunge tap. */
  const TAP_MS = 500;

  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    player.current.targetY = toSvgY(e.clientY);
    const g = gesture.current;
    if (
      Math.abs(e.clientX - g.x) > DRAG_SLOP ||
      Math.abs(e.clientY - g.y) > DRAG_SLOP
    ) {
      g.moved = true;
    }
  };
  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    // Capture the pointer so drag-to-move keeps tracking even if it strays
    // outside the SVG bounds. Touch pointers already get implicit capture per
    // the spec, and explicitly re-capturing them is a known iOS Safari bug
    // source (dropped pointermove/pointerup) — so only capture mouse/pen.
    if (e.pointerType !== "touch") {
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        /* capture is an optimisation — never fatal */
      }
    }
    player.current.targetY = toSvgY(e.clientY);
    gesture.current = {
      x: e.clientX,
      y: e.clientY,
      t: performance.now(),
      moved: false,
    };
  };
  const onPointerUp = () => {
    // A quick press that didn't turn into a drag is a lunge. Dragging just
    // moves the slug (no lunge), so movement and attacks don't fight on touch.
    const g = gesture.current;
    if (!g.moved && performance.now() - g.t < TAP_MS) {
      playerLunge();
    }
  };
  // iOS fires pointercancel liberally (system gestures, notification pulls).
  // A cancelled press must never count as a tap, so just void the gesture.
  const onPointerCancel = () => {
    gesture.current.moved = true;
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowUp" || e.key === "w" || e.key === "W") {
        keyDir.current = -1;
        e.preventDefault();
      } else if (e.key === "ArrowDown" || e.key === "s" || e.key === "S") {
        keyDir.current = 1;
        e.preventDefault();
      } else if (e.key === " " || e.key === "Enter") {
        playerLunge();
        e.preventDefault();
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (
        ((e.key === "ArrowUp" || e.key === "w" || e.key === "W") &&
          keyDir.current === -1) ||
        ((e.key === "ArrowDown" || e.key === "s" || e.key === "S") &&
          keyDir.current === 1)
      ) {
        keyDir.current = 0;
      }
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resetMatch = () => {
    player.current = makeFencer((TOP_Y + BOTTOM_Y) / 2);
    rival.current = makeFencer((TOP_Y + BOTTOM_Y) / 2);
    ai.current = { nextThink: 0, nextLunge: 0 };
    setPlayerScore(0);
    setRivalScore(0);
    setLunges(0);
    setMessage(MESSAGES.idle);
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:py-12">
      <header className="mb-bento grid gap-bento sm:grid-cols-[1fr_1fr]">
        <div className="rounded-neobrutal border-thick border-brand-border bg-brand-secondary p-5 shadow-neo-lg">
          <div className="mb-4 inline-flex items-center gap-2 rounded-neobrutal border-thin border-brand-border bg-brand-background px-3 py-1 text-xs font-bold uppercase shadow-neo-sm">
            🐌 Slug Fencing
          </div>
          <h1 className="font-heading text-4xl uppercase leading-none text-brand-text sm:text-5xl">
            Duel of the slugs.
          </h1>
        </div>
        <p className="rounded-neobrutal border-thick border-brand-border bg-brand-surface p-5 text-sm font-bold leading-relaxed shadow-neo-lg">
          Move your slug up and down — drag on touch, or use the mouse / W / S.
          Tap (or click, or Space) to lunge. Line up with your rival and strike
          to score. Every move and lunge burns energy, so watch your meter.
          Left-handed? Tap the hand button to swap sides.
        </p>
      </header>

      <Card className="overflow-hidden bg-brand-background">
        {/* Scoreboard — panels mirror the arena so "You" sits over your slug. */}
        <div className="grid grid-cols-2 border-b-thick border-brand-border">
          {(side === "right"
            ? ["rival", "you"]
            : ["you", "rival"]
          ).map((who, i) => {
            const isYou = who === "you";
            return (
              <div
                key={who}
                className={`p-3 ${isYou ? "bg-brand-primary" : "bg-brand-pink"} ${
                  i === 0 ? "border-r-thick border-brand-border" : "text-right"
                }`}
              >
                <p className="text-xs font-bold uppercase text-brand-text">
                  {isYou ? "You" : "Rival"}
                </p>
                <p className="font-heading text-3xl leading-none text-brand-text">
                  {isYou ? playerScore : rivalScore}
                </p>
                <div className="mt-2 h-3 w-full overflow-hidden rounded-neobrutal border-thin border-brand-border bg-brand-background">
                  <div
                    ref={isYou ? playerEnergyRef : rivalEnergyRef}
                    className={`h-full bg-brand-warning ${
                      i === 1 ? "ml-auto" : ""
                    }`}
                    style={{ width: "100%" }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        <div className="bg-gradient-to-b from-brand-secondary via-white to-brand-surface">
          <svg
            ref={svgRef}
            viewBox={`0 0 ${VW} ${VH}`}
            onPointerMove={onPointerMove}
            onPointerDown={onPointerDown}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerCancel}
            className="h-[360px] w-full cursor-crosshair touch-none select-none"
          >
            {/* Centre line */}
            <line
              x1={VW / 2}
              y1={TOP_Y - 24}
              x2={VW / 2}
              y2={BOTTOM_Y + 24}
              stroke="#1F2937"
              strokeWidth={3}
              strokeDasharray="8 10"
              opacity={0.4}
            />

            <g ref={playerGRef}>{slugBody("#22C55E", "#15803D")}</g>
            <g ref={rivalGRef}>{slugBody("#EC4899", "#BE185D")}</g>

            {/* Impact burst (positioned + animated on hit) */}
            <g ref={impactRef} style={{ opacity: 0 }}>
              <circle r={20} fill="none" stroke="#1F2937" strokeWidth={4} />
              <path
                d="M-28 0 L-14 0 M28 0 L14 0 M0 -28 L0 -14 M0 28 L0 14 M-20 -20 L-10 -10 M20 20 L10 10 M-20 20 L-10 10 M20 -20 L10 -10"
                stroke="#1F2937"
                strokeWidth={4}
                strokeLinecap="round"
              />
            </g>
          </svg>
        </div>

        <div className="flex flex-col gap-3 border-t-thick border-brand-border bg-brand-surface p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-bold text-brand-text">{message}</p>
          <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-brand-text">
            <span>
              Lunges: <span className="bg-brand-secondary px-1">{lunges}</span>
            </span>
            <button
              onClick={toggleSide}
              title="Swap which side your slug fights on"
              className="rounded-neobrutal border-thin border-brand-border bg-brand-background px-3 py-1.5 shadow-neo-sm transition-[transform,box-shadow] duration-100 active:translate-x-0.5 active:translate-y-0.5 active:shadow-neo-pressed"
            >
              {side === "right" ? "🫱 Righty" : "🫲 Lefty"}
            </button>
            <button
              onClick={resetMatch}
              className="rounded-neobrutal border-thin border-brand-border bg-brand-background px-3 py-1.5 shadow-neo-sm transition-[transform,box-shadow] duration-100 active:translate-x-0.5 active:translate-y-0.5 active:shadow-neo-pressed"
            >
              Reset
            </button>
            <MuteButton />
            <ShareButton
              moduleId={MODULE_ID}
              version={SHARE_VERSION}
              disabled={playerScore === 0 && rivalScore === 0}
              getState={(): ShareState => ({ playerScore, rivalScore, lunges })}
              className="!px-3 !py-1.5 !shadow-neo-sm"
            />
          </div>
        </div>
      </Card>
    </div>
  );
}

/** A slug drawn in local coordinates, body centred at the origin, facing right. */
function slugBody(fill: string, shade: string) {
  return (
    <>
      {/* Trail shadow on the ground */}
      <ellipse cx={-6} cy={26} rx={52} ry={8} fill="#00000020" />
      {/* Body */}
      <path
        d="M-54 8 Q-58 -14 -34 -16 Q-10 -18 6 -20 Q34 -24 46 -6 Q54 6 44 16 Q20 22 -10 22 Q-44 22 -54 8 Z"
        fill={fill}
        stroke="#1F2937"
        strokeWidth={4}
        strokeLinejoin="round"
      />
      {/* Belly highlight */}
      <path
        d="M-44 14 Q-6 20 38 12"
        fill="none"
        stroke={shade}
        strokeWidth={5}
        strokeLinecap="round"
        opacity={0.7}
      />
      {/* Head bump */}
      <circle cx={42} cy={-2} r={16} fill={fill} stroke="#1F2937" strokeWidth={4} />
      {/* Eye stalks */}
      <g stroke="#1F2937" strokeWidth={3.5} strokeLinecap="round">
        <line x1={46} y1={-14} x2={52} y2={-34} />
        <line x1={36} y1={-14} x2={40} y2={-32} />
      </g>
      <circle cx={53} cy={-37} r={5.5} fill="#fff" stroke="#1F2937" strokeWidth={2.5} />
      <circle cx={41} cy={-35} r={5.5} fill="#fff" stroke="#1F2937" strokeWidth={2.5} />
      <circle cx={54} cy={-37} r={2.2} fill="#1F2937" />
      <circle cx={42} cy={-35} r={2.2} fill="#1F2937" />
      {/* Mouth */}
      <path
        d="M48 6 Q54 8 56 4"
        fill="none"
        stroke="#1F2937"
        strokeWidth={3}
        strokeLinecap="round"
      />
    </>
  );
}
