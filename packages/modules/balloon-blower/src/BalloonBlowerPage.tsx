import { useEffect, useRef, useState } from "react";
import {
  Card,
  MuteButton,
  ShareButton,
  consumeShareSnapshot,
  trackStat,
} from "@scroll-goblin/ui";
import { startBlowMic, type BlowMic } from "./mic";
import {
  playCreak,
  playPop,
  playTieOff,
  startInflateHiss,
  type InflateHiss,
} from "./sounds";

/** State captured in a shareable link. Bump SHARE_VERSION on shape changes. */
interface ShareState {
  filled: number;
  popped: number;
}

const MODULE_ID = "balloon-blower";
const SHARE_VERSION = 1;

/* --- Inflation economy (fill is an abstract capacity value) --- */
/** Display capacity — the balloon reads "full" (100%) at this fill. */
const FULL = 100;
/** Keep blowing past full and the balloon bursts once it reaches this fill. */
const EXPLODE = 130;
/** Capacity added per second at full blow strength. */
const MAX_FILL_RATE = 48;
/** Capacity lost per second while not blowing — the balloon slowly sags. */
const LEAK_RATE = 7;
/** Minimum fill before a balloon is worth tying off (counts as "filled"). */
const MIN_TIE = 25;

const clamp = (v: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, v));

/** Linear-interpolate between two RGB colours; t in 0..1. */
const lerpColor = (
  a: [number, number, number],
  b: [number, number, number],
  t: number
) => {
  const c = a.map((v, i) => Math.round(v + (b[i] - v) * clamp(t, 0, 1)));
  return `rgb(${c[0]} ${c[1]} ${c[2]})`;
};
const SAFE: [number, number, number] = [56, 189, 248]; // sky blue
const DANGER: [number, number, number] = [239, 68, 68]; // red

const MESSAGES = {
  idle: "Tap “Start blowing”, then blow into your mic to inflate the balloon.",
  blowing: "Blow into your mic to inflate it. Tie it off before it pops.",
  tied: "Nice — balloon banked! A fresh one drifts in.",
  full: "FULL! Tie it off now — keep blowing and it'll explode!",
  popped: "💥 POP! You blew past full. A new balloon appears.",
  denied:
    "Mic blocked. Allow microphone access in your browser, then tap Start blowing again.",
};

type Phase = "live" | "popped";

export default function BalloonBlowerPage() {
  const snapshot = useRef(
    consumeShareSnapshot<ShareState>(MODULE_ID, SHARE_VERSION)
  ).current;

  const [filled, setFilled] = useState(snapshot?.filled ?? 0);
  const [popped, setPopped] = useState(snapshot?.popped ?? 0);
  const [micOn, setMicOn] = useState(false);
  const [armed, setArmed] = useState(false);
  const [phase, setPhase] = useState<Phase>("live");
  const [message, setMessage] = useState(
    snapshot
      ? "A challenger shared their balloon run. Can you beat it?"
      : MESSAGES.idle
  );

  // --- Simulation state lives in refs; the rAF loop is the only writer. ---
  const fill = useRef(0);
  const phaseRef = useRef<Phase>("live");
  const armedRef = useRef(false);
  const fullNoted = useRef(false);
  const mic = useRef<BlowMic | null>(null);
  const hiss = useRef<InflateHiss | null>(null);
  const lastCreak = useRef(0);
  // Last rendered balloon centre x (the shake offsets it), so the pop burst
  // can flash exactly where the balloon was.
  const balloonX = useRef(160);

  // --- DOM refs driven imperatively each frame (no per-frame React state). ---
  const balloonGroup = useRef<SVGGElement>(null);
  const balloonBody = useRef<SVGEllipseElement>(null);
  const knot = useRef<SVGPathElement>(null);
  const meterFill = useRef<HTMLDivElement>(null);
  const pctLabel = useRef<HTMLSpanElement>(null);
  const burst = useRef<SVGGElement>(null);
  // Live mic-input meter — shows raw detected blow strength so users (and we)
  // can confirm the browser is actually receiving audio on their device.
  const inputBar = useRef<HTMLDivElement>(null);

  /** Begin a brand-new balloon after a tie-off or pop. */
  const resetBalloon = () => {
    fill.current = 0;
    armedRef.current = false;
    setArmed(false);
    fullNoted.current = false;
    phaseRef.current = "live";
    setPhase("live");
  };

  const popBalloon = () => {
    phaseRef.current = "popped";
    setPhase("popped");
    fill.current = 0;
    armedRef.current = false;
    setArmed(false);
    setPopped((n) => n + 1);
    trackStat(MODULE_ID, "popped");
    setMessage(MESSAGES.popped);
    playPop();

    // Flash the burst centred on the balloon's last rendered position, then
    // float in a fresh balloon. The translate must live inside the keyframes:
    // a CSS transform overrides the SVG transform attribute, so scale-only
    // keyframes would yank the burst to the SVG origin. No `fill: "forwards"`
    // for the same reason — a persisted CSS transform would stick around.
    const g = burst.current;
    if (g) {
      const x = balloonX.current;
      g.setAttribute("transform", `translate(${x} 150)`);
      g.style.opacity = "1";
      try {
        const anim = g.animate(
          [
            { transform: `translate(${x}px, 150px) scale(0.4)`, opacity: 1 },
            { transform: `translate(${x}px, 150px) scale(1.6)`, opacity: 0 },
          ],
          { duration: 480, easing: "ease-out" }
        );
        anim.onfinish = () => {
          g.style.opacity = "0";
        };
      } catch {
        g.style.opacity = "0";
      }
    }
    window.setTimeout(resetBalloon, 650);
  };

  const tieOff = () => {
    if (phaseRef.current !== "live" || fill.current < MIN_TIE) return;
    setFilled((n) => n + 1);
    trackStat(MODULE_ID, "filled");
    setMessage(MESSAGES.tied);
    playTieOff();
    resetBalloon();
  };

  // Main animation / simulation loop.
  useEffect(() => {
    let raf = 0;
    let last = performance.now();

    const tick = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;

      // Blow strength comes from the microphone (mouth-powered only).
      const blow = mic.current ? mic.current.level() : 0;
      hiss.current?.update(
        phaseRef.current === "live" ? blow : 0,
        clamp(fill.current / FULL, 0, 1)
      );

      if (phaseRef.current === "live") {
        if (blow > 0.05) {
          fill.current += blow * MAX_FILL_RATE * dt;
        } else {
          fill.current = Math.max(0, fill.current - LEAK_RATE * dt);
        }

        if (fill.current >= EXPLODE) {
          popBalloon();
        } else {
          // Arm/disarm the tie-off button as we cross the minimum.
          const nowArmed = fill.current >= MIN_TIE;
          if (nowArmed !== armedRef.current) {
            armedRef.current = nowArmed;
            setArmed(nowArmed);
          }
          // Warn once when the balloon first reaches full (the danger zone).
          const nowFull = fill.current >= FULL;
          if (nowFull !== fullNoted.current) {
            fullNoted.current = nowFull;
            if (nowFull) setMessage(MESSAGES.full);
          }
          // Rubbery stress creaks while in the danger zone past full.
          if (nowFull && now - lastCreak.current > 300) {
            lastCreak.current = now;
            playCreak(
              clamp((fill.current - FULL) / (EXPLODE - FULL), 0, 1)
            );
          }
        }
      }

      render(blow);
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Push the current simulation state into the DOM. */
  function render(blow: number) {
    const fillNow = fill.current;
    // Display caps at 100% = full; "heat" runs 0..1 toward the burst point and
    // drives the reddening / danger colour past full.
    const pct = clamp(fillNow / FULL, 0, 1);
    const heat = clamp(fillNow / EXPLODE, 0, 1);
    const col = lerpColor(SAFE, DANGER, (heat - 0.4) / 0.6);

    // Meter + numeric readout.
    if (meterFill.current) {
      meterFill.current.style.width = `${pct * 100}%`;
      meterFill.current.style.backgroundColor = col;
    }
    if (pctLabel.current) {
      pctLabel.current.textContent = `${Math.round(pct * 100)}%`;
    }

    const g = balloonGroup.current;
    if (g) {
      if (phaseRef.current === "popped") {
        g.style.opacity = "0";
      } else {
        g.style.opacity = "1";
        // Scale from a small starting balloon up to bulging past full.
        const scale = 0.45 + (fillNow / FULL) * 0.85 + blow * 0.03;
        // Once past full, shake harder the closer we get to bursting.
        let rot = 0;
        let dx = 0;
        if (fillNow > FULL) {
          const intensity = clamp((fillNow - FULL) / (EXPLODE - FULL), 0, 1);
          rot = (Math.random() - 0.5) * 8 * intensity;
          dx = (Math.random() - 0.5) * 8 * intensity;
        }
        balloonX.current = 160 + dx;
        g.setAttribute(
          "transform",
          `translate(${160 + dx} 150) scale(${scale}) rotate(${rot})`
        );
      }
    }

    if (balloonBody.current) balloonBody.current.setAttribute("fill", col);
    if (knot.current) knot.current.setAttribute("fill", col);

    // Live mic-input level (raw blow strength, independent of fill).
    if (inputBar.current) {
      inputBar.current.style.width = `${clamp(blow, 0, 1) * 100}%`;
    }
  }

  /* --- Mic control --- */
  const enableMic = async () => {
    try {
      mic.current = await startBlowMic();
      hiss.current ??= startInflateHiss();
      setMicOn(true);
      setMessage(MESSAGES.blowing);
    } catch {
      // Permission denied or unsupported — fall back to the manual pump.
      setMicOn(false);
      setMessage(MESSAGES.denied);
    }
  };

  // Clean up the mic when leaving the page.
  useEffect(() => {
    return () => {
      mic.current?.stop();
      mic.current = null;
      hiss.current?.stop();
      hiss.current = null;
    };
  }, []);

  // Keyboard: press T to tie off the current balloon.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "t") tieOff();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:py-12">
      <header className="mb-bento grid gap-bento sm:grid-cols-[1fr_1fr]">
        <div className="rounded-neobrutal border-thick border-brand-border bg-brand-secondary p-5 shadow-neo-lg">
          <div className="mb-4 inline-flex items-center gap-2 rounded-neobrutal border-thin border-brand-border bg-brand-background px-3 py-1 text-xs font-bold uppercase shadow-neo-sm">
            🎈 Balloon Blower
          </div>
          <h1 className="font-heading text-4xl uppercase leading-none text-brand-text sm:text-5xl">
            Blow it up.
          </h1>
        </div>
        <p className="rounded-neobrutal border-thick border-brand-border bg-brand-surface p-5 text-sm font-bold leading-relaxed shadow-neo-lg">
          Blow into your microphone to inflate the balloon — the harder you
          blow, the faster it fills. Tie it off before it bursts to bank a
          balloon. Keep blowing past full and it explodes.
        </p>
      </header>

      <Card className="overflow-hidden bg-brand-background">
        {/* Scoreboard */}
        <div className="grid grid-cols-2 border-b-thick border-brand-border">
          <div className="border-r-thick border-brand-border bg-brand-primary p-3">
            <p className="text-xs font-bold uppercase text-brand-text">
              Balloons filled
            </p>
            <p className="font-heading text-3xl leading-none text-brand-text">
              {filled}
            </p>
          </div>
          <div className="bg-brand-pink p-3 text-right">
            <p className="text-xs font-bold uppercase text-brand-text">
              Balloons popped
            </p>
            <p className="font-heading text-3xl leading-none text-brand-text">
              {popped}
            </p>
          </div>
        </div>

        {/* Balloon stage */}
        <div className="bg-gradient-to-b from-brand-secondary via-white to-brand-surface">
          <svg
            viewBox="0 0 320 300"
            className="h-[320px] w-full select-none"
            aria-label="A balloon that inflates as you blow"
          >
            <g ref={balloonGroup} transform="translate(160 150) scale(0.45)">
              {/* String */}
              <path
                d="M0 92 Q-14 120 6 150 Q24 178 0 210"
                fill="none"
                stroke="#1F2937"
                strokeWidth={3}
                strokeLinecap="round"
              />
              {/* Knot */}
              <path
                ref={knot}
                d="M-12 84 L12 84 L0 104 Z"
                fill="rgb(56 189 248)"
                stroke="#1F2937"
                strokeWidth={4}
                strokeLinejoin="round"
              />
              {/* Body */}
              <ellipse
                ref={balloonBody}
                cx={0}
                cy={0}
                rx={80}
                ry={92}
                fill="rgb(56 189 248)"
                stroke="#1F2937"
                strokeWidth={5}
              />
              {/* Shine highlight */}
              <ellipse
                cx={-26}
                cy={-34}
                rx={16}
                ry={26}
                fill="#ffffff"
                opacity={0.6}
              />
            </g>

            {/* Pop burst */}
            <g
              ref={burst}
              transform="translate(160 150)"
              style={{ opacity: 0 }}
            >
              <path
                d="M0 -70 L16 -30 L60 -40 L30 -8 L70 16 L24 18 L34 64 L0 32 L-34 64 L-24 18 L-70 16 L-30 -8 L-60 -40 L-16 -30 Z"
                fill="#FACC15"
                stroke="#1F2937"
                strokeWidth={5}
                strokeLinejoin="round"
              />
            </g>
          </svg>
        </div>

        {/* Fill meter */}
        <div className="flex items-center gap-3 border-t-thick border-brand-border bg-brand-surface px-4 py-3">
          <span className="text-xs font-bold uppercase text-brand-text">
            Fill
          </span>
          <div className="h-4 flex-1 overflow-hidden rounded-neobrutal border-thin border-brand-border bg-brand-background">
            <div
              ref={meterFill}
              className="h-full"
              style={{ width: "0%", backgroundColor: "rgb(56 189 248)" }}
            />
          </div>
          <span
            ref={pctLabel}
            className="w-12 text-right font-heading text-sm text-brand-text"
          >
            0%
          </span>
        </div>

        {/* Controls */}
        <div className="flex flex-col gap-3 border-t-thick border-brand-border bg-brand-surface p-4">
          <p className="text-sm font-bold text-brand-text">{message}</p>
          <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-brand-text">
            {!micOn && (
              <button
                onClick={enableMic}
                className="rounded-neobrutal border-thin border-brand-border bg-brand-warning px-3 py-1.5 shadow-neo-sm transition-[transform,box-shadow] duration-100 active:translate-x-0.5 active:translate-y-0.5 active:shadow-neo-pressed"
              >
                🎤 Start blowing
              </button>
            )}
            {micOn && (
              <span className="inline-flex items-center gap-2 rounded-neobrutal border-thin border-brand-border bg-brand-primary px-3 py-1.5">
                🎤 Mic live
                <span
                  className="h-2 w-16 overflow-hidden rounded-neobrutal border-thin border-brand-border bg-brand-background"
                  title="Live mic input"
                  aria-label="Live mic input level"
                >
                  <span
                    ref={inputBar}
                    className="block h-full bg-brand-text"
                    style={{ width: "0%" }}
                  />
                </span>
              </span>
            )}
            <button
              onClick={tieOff}
              disabled={!armed || phase !== "live"}
              className="rounded-neobrutal border-thin border-brand-border bg-brand-secondary px-3 py-1.5 shadow-neo-sm transition-[transform,box-shadow] duration-100 active:translate-x-0.5 active:translate-y-0.5 active:shadow-neo-pressed disabled:cursor-not-allowed disabled:opacity-40"
            >
              🪢 Tie it off
            </button>
            <ShareButton
              moduleId={MODULE_ID}
              version={SHARE_VERSION}
              disabled={filled === 0 && popped === 0}
              getState={(): ShareState => ({ filled, popped })}
              className="!px-3 !py-1.5 !shadow-neo-sm"
            />
            <MuteButton />
          </div>
        </div>
      </Card>
    </div>
  );
}
