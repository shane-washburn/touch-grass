import { Link, useNavigate } from "react-router-dom";
import { Dices, Sparkles } from "lucide-react";
import {
  Button,
  Card,
  trackModuleTileClick,
  trackSurpriseMeClick,
} from "@scroll-goblin/ui";
import { MODULES } from "../modules/registry";

export default function Landing() {
  const navigate = useNavigate();
  const visible = MODULES.filter((m) => m.status !== "hidden");

  const goToRandomModule = () => {
    const pick = visible[Math.floor(Math.random() * visible.length)];
    if (pick) {
      trackSurpriseMeClick({
        destinationModuleId: pick.id,
        destinationPath: pick.path,
      });
      navigate(pick.path);
    }
  };
  const palette = [
    "bg-brand-primary",
    "bg-brand-secondary",
    "bg-brand-warning",
    "bg-brand-pink",
    "bg-brand-orange",
    "bg-brand-purple",
  ];
  // Assign colors so no card matches its left neighbor (index - 1) or the
  // card above it in 2-col (index - 2) or 3-col (index - 3) layouts.
  const tileColors: string[] = [];
  for (let i = 0; i < visible.length; i++) {
    const banned = new Set(
      [tileColors[i - 1], tileColors[i - 2], tileColors[i - 3]].filter(Boolean)
    );
    const candidates = palette.filter((c) => !banned.has(c));
    tileColors.push(candidates[i % candidates.length]);
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:py-12">
      <header className="mb-bento grid gap-bento sm:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-neobrutal border-thick border-brand-border bg-brand-primary p-5 shadow-neo-lg">
          <div className="mb-4 inline-flex items-center gap-2 rounded-neobrutal border-thin border-brand-border bg-brand-background px-3 py-1 text-xs font-bold uppercase shadow-neo-sm">
            <Sparkles className="h-4 w-4" />
            Scroll Goblin
          </div>
          <h1 className="font-heading text-4xl uppercase leading-none text-brand-text sm:text-5xl">
            Choose your brainrot spell
          </h1>
          <Button
            onClick={goToRandomModule}
            className="mt-5 bg-brand-background uppercase"
          >
            <Dices className="h-5 w-5" />
            Surprise me
          </Button>
        </div>
        <div className="mascot-boil rounded-neobrutal border-thick border-brand-border bg-brand-background p-3 shadow-neo-lg">
          <img
            src="/scroll-goblin-mascot.png"
            alt="Scroll Goblin mascot"
            className="relative z-10 h-full max-h-[260px] w-full object-contain"
          />
        </div>
      </header>

      <div className="grid gap-bento sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((m, index) => (
          <Link
            key={m.id}
            to={m.path}
            className="group"
            onClick={() => trackModuleTileClick({ moduleId: m.id, index })}
          >
            <Card
              className={`h-full p-5 transition-[transform,box-shadow] duration-100 group-hover:-translate-y-1 group-active:translate-x-1 group-active:translate-y-1 group-active:shadow-neo-pressed ${
                tileColors[index % tileColors.length]
              }`}
            >
              <div className="mb-5 text-4xl">{m.emoji}</div>
              <h2 className="font-heading text-2xl uppercase leading-none text-brand-text">
                {m.title}
                {m.status === "beta" && (
                  <span className="ml-2 inline-block rounded-neobrutal border-thin border-brand-border bg-brand-background px-2 py-0.5 align-middle font-body text-[10px] font-bold uppercase shadow-neo-sm">
                    Beta
                  </span>
                )}
              </h2>
              <p className="mt-3 text-sm font-bold leading-relaxed text-brand-text">
                {m.description}
              </p>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
