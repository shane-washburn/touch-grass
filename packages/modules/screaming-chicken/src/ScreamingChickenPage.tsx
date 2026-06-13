import { useEffect, useRef, useState } from "react";
import {
  Card,
  ShareButton,
  consumeShareSnapshot,
  trackStat,
} from "@scroll-goblin/ui";
import { playPop, playScream, startWheeze, type Wheeze } from "./scream";

/** State captured in a shareable link. Bump SHARE_VERSION on shape changes. */
interface ShareState {
  squeezes: number;
  screams: number;
  eggs: number;
  record: number;
}

const MODULE_ID = "screaming-chicken";
const SHARE_VERSION = 1;

/** SVG viewBox dimensions. */
const VW = 320;
const VH = 300;
/** Bottom of the body — the squash anchor (chicken is pinned to the ground). */
const ANCHOR_Y = 256;
const CENTER_X = 160;
/** How much the body flattens at full squeeze. */
const MAX_SQUASH = 0.45;
/** How much the body bulges sideways at full squeeze. */
const MAX_BULGE = 0.38;
/** Pressure above which the chicken counts as "fully squeezed". */
const EGG_PRESSURE = 0.92;
/** How long (ms) a full squeeze must be held before an egg pops out. */
const EGG_HOLD_MS = 1800;

const MESSAGES = {
  idle: "The chicken regards you with suspicion.",
  squeezeLight: "A gentle squeeze. The chicken tolerates this.",
  squeezeDeep: "The chicken is mostly flat now. It remembers everything.",
  screamSmall: "A modest little scream. Barely a squeak.",
  screamBig: "AAAAAAAAAA. The chicken screams back to shape.",
  screamHuge: "A scream heard by every chicken on Earth. Magnificent.",
  brewing: "The chicken is trembling. Something is happening in there...",
  egg: "POP. An egg?! You squeezed an entire egg out of the chicken.",
};

export default function ScreamingChickenPage() {
  const svgRef = useRef<SVGSVGElement>(null);
  const bodyRef = useRef<SVGGElement>(null);
  const headRef = useRef<SVGGElement>(null);
  const beakTopRef = useRef<SVGPathElement>(null);
  const beakBottomRef = useRef<SVGPathElement>(null);
  const eyeRef = useRef<SVGGElement>(null);
  const dentRef = useRef<SVGEllipseElement>(null);
  const legsRef = useRef<SVGGElement>(null);

  // All per-frame values live in a ref — never in React state.
  const sim = useRef({
    pressure: 0, // 0 = relaxed, 1 = fully squeezed
    velocity: 0, // spring velocity for the release wobble
    gape: 0, // beak opening (own spring so it stays open during the scream)
    pressing: false,
    pressX: CENTER_X,
    pressY: 170,
    screamUntil: 0, // performance.now() timestamp while screaming
    deepest: 0, // deepest point of the current squeeze
    saidDeep: false,
    fullSince: 0, // when the squeeze first hit EGG_PRESSURE (0 = not yet)
    saidBrewing: false,
  });
  const wheeze = useRef<Wheeze | null>(null);

  // Consume a share snapshot exactly once; the URL param is stripped so a
  // refresh or fresh navigation starts the module blank.
  const [snapshot] = useState(() =>
    consumeShareSnapshot<ShareState>(MODULE_ID, SHARE_VERSION)
  );

  const [squeezes, setSqueezes] = useState(snapshot?.squeezes ?? 0);
  const [screams, setScreams] = useState(snapshot?.screams ?? 0);
  const [eggs, setEggs] = useState(snapshot?.eggs ?? 0);
  const [record, setRecord] = useState(snapshot?.record ?? 0);
  const [message, setMessage] = useState(
    snapshot
      ? "Someone shared their chicken stats with you. Think you can do better?"
      : MESSAGES.idle
  );

  // Animation loop: pressure eases toward 1 while held, springs back with
  // overshoot on release. All deformation derives from that one value.
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const s = sim.current;
      const now = performance.now();

      if (s.pressing) {
        // Rubber resists: fast initial give, then harder to compress.
        s.pressure += (1 - s.pressure) * 0.045;
        s.velocity = 0;
        s.deepest = Math.max(s.deepest, s.pressure);
        wheeze.current?.setPressure(s.pressure);
        if (s.pressure > 0.75 && !s.saidDeep) {
          s.saidDeep = true;
          setMessage(MESSAGES.squeezeDeep);
        }
        // Egg timer: starts once the squeeze is (and stays) near-total.
        if (s.pressure > EGG_PRESSURE) {
          if (s.fullSince === 0) s.fullSince = now;
          if (now - s.fullSince > EGG_HOLD_MS * 0.5 && !s.saidBrewing) {
            s.saidBrewing = true;
            setMessage(MESSAGES.brewing);
          }
        }
      } else {
        // Re-inflation: underdamped spring so the chicken wobbles back.
        s.velocity += (0 - s.pressure) * 0.06 - s.velocity * 0.12;
        s.pressure += s.velocity;
      }

      // Beak gape: follows the squeeze, but stays wide open mid-scream.
      const screaming = now < s.screamUntil;
      // Tremble while the egg is brewing.
      const brewing =
        s.pressing && s.fullSince !== 0 && now - s.fullSince > EGG_HOLD_MS * 0.5;
      const gapeTarget = s.pressing ? s.pressure * 0.5 : screaming ? 1 : 0;
      s.gape += (gapeTarget - s.gape) * 0.25;

      const p = s.pressure;
      const tremble = brewing ? Math.sin(now / 28) * 0.012 : 0;
      const sy = 1 - MAX_SQUASH * p + tremble;
      const sx = 1 + MAX_BULGE * p - tremble;

      // Body: squash and stretch anchored at the ground.
      const body = bodyRef.current;
      if (body) {
        body.setAttribute(
          "transform",
          `translate(${CENTER_X} ${ANCHOR_Y}) scale(${sx} ${sy}) translate(${-CENTER_X} ${-ANCHOR_Y})`
        );
      }

      // Head: rides down as the body flattens, tips away from the press.
      const head = headRef.current;
      if (head) {
        const drop = 62 * Math.max(p, 0);
        const lean = s.pressing ? (CENTER_X - s.pressX) * 0.06 * p : 0;
        const tilt = -6 * p + (screaming ? Math.sin(now / 35) * 2.5 : 0);
        head.setAttribute(
          "transform",
          `translate(${lean} ${drop}) rotate(${tilt} 205 110)`
        );
      }

      // Beak: hinges open with gape.
      beakTopRef.current?.setAttribute("transform", `rotate(${-22 * s.gape} 236 86)`);
      beakBottomRef.current?.setAttribute("transform", `rotate(${30 * s.gape} 236 92)`);

      // Eye bulges under pressure.
      eyeRef.current?.setAttribute(
        "transform",
        `translate(218 74) scale(${1 + 0.7 * Math.max(p, 0)}) translate(-218 -74)`
      );

      // Legs splay outward as the body flattens onto them.
      legsRef.current?.setAttribute(
        "transform",
        `translate(${CENTER_X} ${ANCHOR_Y + 16}) scale(${1 + 0.45 * Math.max(p, 0)} 1) translate(${-CENTER_X} ${-(ANCHOR_Y + 16)})`
      );

      // Dent: a dark depression under the cursor, deepening with pressure.
      // It lives inside the body group, so map pointer coords to body-local
      // space by inverting the squash transform.
      const dent = dentRef.current;
      if (dent) {
        const show = s.pressing && p > 0.02;
        dent.setAttribute("opacity", show ? `${Math.min(0.55, p * 0.7)}` : "0");
        if (show) {
          const lx = CENTER_X + (s.pressX - CENTER_X) / sx;
          const ly = ANCHOR_Y + (s.pressY - ANCHOR_Y) / sy;
          dent.setAttribute("cx", `${lx}`);
          dent.setAttribute("cy", `${ly}`);
          dent.setAttribute("rx", `${16 + 30 * p}`);
          dent.setAttribute("ry", `${12 + 22 * p}`);
        }
      }

      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      wheeze.current?.stop();
      wheeze.current = null;
    };
  }, []);

  /** Map a pointer event to SVG viewBox coordinates. */
  const toSvg = (e: { clientX: number; clientY: number }) => {
    const rect = svgRef.current!.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * VW,
      y: ((e.clientY - rect.top) / rect.height) * VH,
    };
  };

  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    const s = sim.current;
    const { x, y } = toSvg(e);
    s.pressX = x;
    s.pressY = y;
    s.pressing = true;
    s.deepest = 0;
    s.saidDeep = false;
    s.fullSince = 0;
    s.saidBrewing = false;
    wheeze.current?.stop();
    wheeze.current = startWheeze();
    setSqueezes((n) => n + 1);
    trackStat(MODULE_ID, "squeezes");
    setMessage(MESSAGES.squeezeLight);
  };

  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const s = sim.current;
    if (!s.pressing) return;
    const { x, y } = toSvg(e);
    s.pressX = x;
    s.pressY = y;
  };

  /** Pop an egg out of the back of the chicken and let it settle on the ground. */
  const layEgg = () => {
    const svg = svgRef.current;
    if (!svg) return;
    const ns = "http://www.w3.org/2000/svg";
    const egg = document.createElementNS(ns, "ellipse");
    // Exit point: behind the chicken, near the tail.
    egg.setAttribute("cx", "92");
    egg.setAttribute("cy", "238");
    egg.setAttribute("rx", "13");
    egg.setAttribute("ry", "17");
    egg.setAttribute("fill", "#FEF3C7");
    egg.setAttribute("stroke", "#1F2937");
    egg.setAttribute("stroke-width", "3");
    // CSS transforms on SVG rotate around the viewport origin by default;
    // anchor them to the egg itself so it spins in place while flying.
    egg.style.transformBox = "fill-box";
    egg.style.transformOrigin = "center";
    svg.appendChild(egg);

    // Pop out in an arc, bounce once, settle, then fade away.
    const drift = -(34 + Math.random() * 26);
    egg
      .animate(
        [
          { transform: "translate(0px, 0px) rotate(0deg)", offset: 0 },
          { transform: `translate(${drift * 0.6}px, -52px) rotate(-60deg)`, offset: 0.3 },
          { transform: `translate(${drift}px, 28px) rotate(-110deg)`, offset: 0.62 },
          { transform: `translate(${drift - 6}px, 16px) rotate(-122deg)`, offset: 0.8 },
          { transform: `translate(${drift - 8}px, 28px) rotate(-128deg)`, offset: 1 },
        ],
        { duration: 900, easing: "cubic-bezier(0.3, 0, 0.6, 1)", fill: "forwards" }
      )
      .addEventListener("finish", () => {
        egg
          .animate([{ opacity: 1 }, { opacity: 0 }], {
            duration: 800,
            delay: 3500,
            fill: "forwards",
          })
          .addEventListener("finish", () => egg.remove());
      });

    playPop();
    setEggs((n) => n + 1);
    trackStat(MODULE_ID, "eggs");
  };

  const release = () => {
    const s = sim.current;
    if (!s.pressing) return;
    s.pressing = false;
    const laidEgg =
      s.fullSince !== 0 && performance.now() - s.fullSince > EGG_HOLD_MS;
    s.fullSince = 0;
    wheeze.current?.stop();
    wheeze.current = null;

    if (laidEgg) layEgg();

    if (s.deepest > 0.05) {
      const ms = playScream(s.deepest);
      s.screamUntil = performance.now() + ms;
      setScreams((n) => n + 1);
      trackStat(MODULE_ID, "screams");
      setRecord((r) => Math.max(r, Math.round(s.deepest * 100)));
      setMessage(
        laidEgg
          ? MESSAGES.egg
          : s.deepest > 0.85
            ? MESSAGES.screamHuge
            : s.deepest > 0.45
              ? MESSAGES.screamBig
              : MESSAGES.screamSmall
      );
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:py-12">
      <header className="mb-bento grid gap-bento sm:grid-cols-[1fr_1fr]">
        <div className="rounded-neobrutal border-thick border-brand-border bg-brand-warning p-5 shadow-neo-lg">
          <div className="mb-4 inline-flex items-center gap-2 rounded-neobrutal border-thin border-brand-border bg-brand-background px-3 py-1 text-xs font-bold uppercase shadow-neo-sm">
            🐔 Screaming Chicken
          </div>
          <h1 className="font-heading text-4xl uppercase leading-none text-brand-text sm:text-5xl">
            Squeeze the chicken.
          </h1>
        </div>
        <p className="rounded-neobrutal border-thick border-brand-border bg-brand-surface p-5 text-sm font-bold leading-relaxed shadow-neo-lg">
          Hold down on the chicken to squeeze the air out. Release and it
          screams its way back into shape. Deeper squeeze, bigger scream.
        </p>
      </header>

      <Card className="overflow-hidden bg-brand-background">
        <div className="border-b-thick border-brand-border bg-brand-secondary p-3">
          <p className="text-xs font-bold uppercase text-brand-text">
            Press and hold anywhere on the chicken — release to scream
          </p>
        </div>

        <div className="flex justify-center bg-gradient-to-b from-brand-secondary via-white to-brand-surface">
          <svg
            ref={svgRef}
            viewBox={`0 0 ${VW} ${VH}`}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={release}
            onPointerCancel={release}
            className="h-80 w-full max-w-md cursor-pointer touch-none select-none sm:h-96"
          >
            <defs>
              <radialGradient id="sc-dent" cx="0.5" cy="0.5" r="0.5">
                <stop offset="0%" stopColor="#000" stopOpacity="0.85" />
                <stop offset="55%" stopColor="#000" stopOpacity="0.35" />
                <stop offset="100%" stopColor="#000" stopOpacity="0" />
              </radialGradient>
              <clipPath id="sc-body-clip">
                <ellipse cx={CENTER_X} cy={188} rx={82} ry={68} />
              </clipPath>
            </defs>

            {/* Ground shadow */}
            <ellipse cx={CENTER_X} cy={276} rx={95} ry={11} fill="#00000022" />

            {/* Legs (splay as the body flattens) */}
            <g ref={legsRef} stroke="#EA580C" strokeWidth={5} strokeLinecap="round">
              <path d="M142 248 L136 272 M136 272 L126 272 M136 272 L144 276" fill="none" />
              <path d="M178 248 L184 272 M184 272 L174 276 M184 272 L194 272" fill="none" />
            </g>

            {/* Body group: squash/stretch anchored at the ground */}
            <g ref={bodyRef}>
              {/* Tail feathers */}
              <ellipse cx={86} cy={150} rx={14} ry={32} fill="#FACC15" stroke="#1F2937" strokeWidth={3} transform="rotate(-35 86 150)" />
              <ellipse cx={78} cy={166} rx={12} ry={28} fill="#FBBF24" stroke="#1F2937" strokeWidth={3} transform="rotate(-55 78 166)" />

              {/* Body */}
              <ellipse cx={CENTER_X} cy={188} rx={82} ry={68} fill="#FACC15" stroke="#1F2937" strokeWidth={4} />

              {/* Wing */}
              <ellipse cx={146} cy={196} rx={36} ry={24} fill="#FBBF24" stroke="#1F2937" strokeWidth={3} transform="rotate(-12 146 196)" />

              {/* Press dent (positioned every frame, clipped to the body) */}
              <ellipse
                ref={dentRef}
                cx={CENTER_X}
                cy={188}
                rx={20}
                ry={15}
                fill="url(#sc-dent)"
                opacity={0}
                clipPath="url(#sc-body-clip)"
              />
            </g>

            {/* Head group: drops down as the body squashes */}
            <g ref={headRef}>
              {/* Neck */}
              <path d="M185 140 Q190 100 200 92 L222 104 Q214 130 212 148 Z" fill="#FACC15" stroke="#1F2937" strokeWidth={4} />

              {/* Comb */}
              <path
                d="M188 62 Q190 46 200 50 Q202 38 212 44 Q218 34 224 46 Q230 42 228 56 L196 68 Z"
                fill="#EF4444"
                stroke="#1F2937"
                strokeWidth={3}
              />

              {/* Head */}
              <circle cx={205} cy={84} r={32} fill="#FACC15" stroke="#1F2937" strokeWidth={4} />

              {/* Beak (hinged, opens with the scream) */}
              <path ref={beakTopRef} d="M234 80 L268 84 L236 92 Z" fill="#F97316" stroke="#1F2937" strokeWidth={3} strokeLinejoin="round" />
              <path ref={beakBottomRef} d="M234 90 L260 95 L236 99 Z" fill="#EA580C" stroke="#1F2937" strokeWidth={3} strokeLinejoin="round" />

              {/* Wattle */}
              <path d="M228 100 Q234 116 226 120 Q218 116 222 102 Z" fill="#EF4444" stroke="#1F2937" strokeWidth={3} />

              {/* Eye (bulges under pressure) */}
              <g ref={eyeRef}>
                <circle cx={218} cy={74} r={9} fill="#fff" stroke="#1F2937" strokeWidth={2.5} />
                <circle cx={221} cy={75} r={3.5} fill="#1F2937" />
              </g>
            </g>
          </svg>
        </div>

        <div className="flex flex-col gap-3 border-t-thick border-brand-border bg-brand-surface p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-bold text-brand-text">{message}</p>
          <div className="flex flex-wrap gap-2 text-xs font-bold text-brand-text">
            <span>
              Squeezes: <span className="bg-brand-warning px-1">{squeezes}</span>
            </span>
            <span>
              Screams: <span className="bg-brand-primary px-1">{screams}</span>
            </span>
            <span>
              Eggs: <span className="bg-brand-surface px-1">🥚 {eggs}</span>
            </span>
            <span>
              Deepest: <span className="bg-brand-secondary px-1">{record}%</span>
            </span>
            <ShareButton
              moduleId={MODULE_ID}
              version={SHARE_VERSION}
              disabled={squeezes === 0}
              getState={(): ShareState => ({ squeezes, screams, eggs, record })}
              className="!px-3 !py-1.5 !shadow-neo-sm"
            />
          </div>
        </div>
      </Card>
    </div>
  );
}
