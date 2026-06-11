import { Link } from "react-router-dom";
import { Sparkles } from "lucide-react";
import { Card } from "@emoji/ui";
import { MODULES } from "../modules/registry";

export default function Landing() {
  const visible = MODULES.filter((m) => m.status !== "hidden");

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:py-16">
      <header className="mb-10 text-center">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/70 px-4 py-1.5 text-sm font-medium text-brand-600 shadow-sm ring-1 ring-brand-100">
          <Sparkles className="h-4 w-4" />
          App Suite
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
          Pick an app to launch
        </h1>
        <p className="mt-2 text-slate-500">
          A growing collection of mini apps, games, and activities.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((m) => (
          <Link key={m.id} to={m.path} className="group">
            <Card className="h-full p-5 transition group-hover:-translate-y-0.5 group-hover:shadow-2xl">
              <div className="mb-3 text-3xl">{m.emoji}</div>
              <h2 className="flex items-center gap-2 font-bold text-slate-900">
                {m.title}
                {m.status === "beta" && (
                  <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-600 ring-1 ring-amber-100">
                    Beta
                  </span>
                )}
              </h2>
              <p className="mt-1 text-sm text-slate-500">{m.description}</p>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
