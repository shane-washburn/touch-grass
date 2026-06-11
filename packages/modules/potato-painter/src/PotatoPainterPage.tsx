import { useCallback, useEffect, useRef, useState } from "react";
import { Card } from "@scroll-goblin/ui";
import {
  VARIETIES,
  makePotato,
  stampPotato,
  type Potato,
} from "./potato";

const MESSAGES = {
  idle: "Pick up a potato and drop it on the canvas.",
  pickup: "Spud acquired. Drop it where you want it!",
  used: "Stamped! A fresh potato has rolled into its place. 🥔",
  returned: "The potato rolls back to the tray, unused.",
  cleared: "Canvas wiped. The potatoes pretend not to be offended.",
};

interface DragState {
  slot: number;
  potato: Potato;
  x: number;
  y: number;
}

/** Small inline SVG rendering of a potato, used for the tray and drag ghost. */
function PotatoSvg({ potato }: { potato: Potato }) {
  return (
    <svg
      // The viewBox has 0.1 units of padding per side so strokes aren't
      // clipped; scale up by 1.1 so the potato body itself is exactly w × h,
      // matching the canvas stamp 1:1.
      width={potato.w * 1.1}
      height={potato.h * 1.1}
      viewBox="-1.1 -1.1 2.2 2.2"
      // Stretch the square viewBox to the potato's w × h footprint, exactly
      // like the canvas stamp's scale(w/2, h/2). Without this the default
      // uniform scaling shrinks the width to fit the height.
      preserveAspectRatio="none"
      style={{ transform: `rotate(${potato.rotation}deg)` }}
      className="drop-shadow-sm"
    >
      <path
        d={potato.path}
        fill={potato.skin}
        stroke={potato.outline}
        strokeWidth={0.07}
      />
      {potato.spots.map((s, i) => (
        <ellipse
          key={i}
          cx={s.x}
          cy={s.y}
          rx={s.r}
          ry={s.r * 0.85}
          fill={potato.spotColor}
        />
      ))}
    </svg>
  );
}

export default function PotatoPainterPage() {
  const [tray, setTray] = useState<Potato[]>(() =>
    VARIETIES.map((_, i) => makePotato(i))
  );
  const [used, setUsed] = useState(0);
  const [stampCount, setStampCount] = useState(0);
  const [message, setMessage] = useState(MESSAGES.idle);
  const [drag, setDrag] = useState<DragState | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const canvasWrapRef = useRef<HTMLDivElement>(null);
  // Drag state mirror for window-level listeners (avoids stale closures).
  const dragRef = useRef<DragState | null>(null);

  // Size the canvas to its container, preserving the drawing on resize.
  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = canvasWrapRef.current;
    if (!canvas || !wrap) return;

    const resize = () => {
      const { clientWidth: w, clientHeight: h } = wrap;
      if (canvas.width === w && canvas.height === h) return;
      const snapshot = document.createElement("canvas");
      snapshot.width = canvas.width;
      snapshot.height = canvas.height;
      snapshot.getContext("2d")?.drawImage(canvas, 0, 0);
      canvas.width = w;
      canvas.height = h;
      canvas.getContext("2d")?.drawImage(snapshot, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);
    return () => ro.disconnect();
  }, []);

  /** Stamp the potato at the drop point if it lands on the canvas. */
  const tryStamp = useCallback(
    (d: DragState, clientX: number, clientY: number): boolean => {
      const canvas = canvasRef.current;
      if (!canvas) return false;
      const rect = canvas.getBoundingClientRect();
      const x = clientX - rect.left;
      const y = clientY - rect.top;
      if (x < 0 || y < 0 || x > rect.width || y > rect.height) return false;

      const ctx = canvas.getContext("2d");
      if (!ctx) return false;
      // Use the potato's resting rotation so the print lands exactly as
      // previewed while dragging.
      stampPotato(ctx, d.potato, x, y, d.potato.rotation);
      setStampCount((n) => n + 1);
      return true;
    },
    []
  );

  // Window-level drag handling so the potato follows the pointer everywhere.
  useEffect(() => {
    if (!drag) return;
    dragRef.current = drag;

    const onMove = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d) return;
      d.x = e.clientX;
      d.y = e.clientY;
      setDrag({ ...d });
    };

    const onUp = (e: PointerEvent) => {
      const d = dragRef.current;
      dragRef.current = null;
      setDrag(null);
      if (!d) return;
      // The potato is only placed when the user releases it over the canvas.
      if (tryStamp(d, e.clientX, e.clientY)) {
        // The potato has been used: grow a replacement of the same variety
        // but with a freshly randomized shape and size.
        setTray((t) =>
          t.map((p, i) => (i === d.slot ? makePotato(d.potato.varietyIndex) : p))
        );
        setUsed((n) => n + 1);
        setMessage(MESSAGES.used);
      } else {
        setMessage(MESSAGES.returned);
      }
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
    // Only re-bind when a drag starts/stops, not on every position update.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drag !== null, tryStamp]);

  const pickUp = (slot: number) => (e: React.PointerEvent) => {
    e.preventDefault();
    setMessage(MESSAGES.pickup);
    setDrag({
      slot,
      potato: tray[slot],
      x: e.clientX,
      y: e.clientY,
    });
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    canvas?.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
    setStampCount(0);
    setMessage(MESSAGES.cleared);
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:py-12">
      <header className="mb-bento grid gap-bento sm:grid-cols-[1fr_1fr]">
        <div className="rounded-neobrutal border-thick border-brand-border bg-brand-warning p-5 shadow-neo-lg">
          <div className="mb-4 inline-flex items-center gap-2 rounded-neobrutal border-thin border-brand-border bg-brand-background px-3 py-1 text-xs font-bold uppercase shadow-neo-sm">
            🥔 Potato Painter
          </div>
          <h1 className="font-heading text-4xl uppercase leading-none text-brand-text sm:text-5xl">
            Paint with potatoes
          </h1>
        </div>
        <p className="rounded-neobrutal border-thick border-brand-border bg-brand-surface p-5 text-sm font-bold leading-relaxed shadow-neo-lg">
          Drag a spud from the tray and drop it on the canvas to stamp it.
          Every potato you use is replaced by a brand-new one — same variety,
          never the same shape.
        </p>
      </header>

      <Card className="overflow-hidden bg-brand-background">
        {/* Potato tray */}
        <div className="border-b-thick border-brand-border bg-brand-primary p-4">
          <p className="mb-3 text-xs font-bold uppercase text-brand-text">
            The Tray — pick your spud
          </p>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
            {tray.map((p, i) => (
              <div
                key={p.id}
                onPointerDown={pickUp(i)}
                className={`flex h-28 cursor-grab touch-none select-none flex-col items-center justify-between rounded-neobrutal border-thin border-brand-border bg-brand-background p-2 shadow-neo-sm transition-transform duration-100 hover:-translate-y-0.5 active:cursor-grabbing ${
                  drag?.slot === i ? "opacity-40" : ""
                }`}
                title={VARIETIES[p.varietyIndex].blurb}
              >
                <div className="flex flex-1 items-center justify-center overflow-hidden">
                  <div style={{ transform: "scale(0.62)" }}>
                    <PotatoSvg potato={p} />
                  </div>
                </div>
                <span className="text-center text-[10px] font-bold uppercase leading-tight text-brand-text">
                  {VARIETIES[p.varietyIndex].name}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Canvas */}
        <div
          ref={canvasWrapRef}
          className="relative h-96 w-full touch-none overflow-hidden bg-white"
        >
          <canvas ref={canvasRef} className="absolute inset-0" />
          {stampCount === 0 && !drag && (
            <p className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm font-bold uppercase text-brand-text opacity-30">
              Drop a potato here to stamp it
            </p>
          )}
        </div>

        {/* Status bar */}
        <div className="flex flex-col gap-3 border-t-thick border-brand-border bg-brand-surface p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-bold text-brand-text">{message}</p>
          <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-brand-text">
            <span>
              Stamps: <span className="bg-brand-warning px-1">{stampCount}</span>
            </span>
            <span>
              Potatoes used: <span className="bg-brand-primary px-1">{used}</span>
            </span>
            <button
              onClick={clearCanvas}
              className="rounded-neobrutal border-thin border-brand-border bg-brand-secondary px-3 py-1.5 shadow-neo-sm transition-[transform,box-shadow] duration-100 active:translate-x-0.5 active:translate-y-0.5 active:shadow-neo-pressed"
            >
              🧽 Clear canvas
            </button>
          </div>
        </div>
      </Card>

      {/* Floating potato that follows the pointer while dragging */}
      {drag && (
        <div
          className="pointer-events-none fixed z-50"
          style={{
            left: drag.x,
            top: drag.y,
            transform: "translate(-50%, -50%)",
          }}
        >
          <PotatoSvg potato={drag.potato} />
        </div>
      )}
    </div>
  );
}
