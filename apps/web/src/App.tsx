import { Suspense, lazy } from "react";
import { Link, Route, Routes } from "react-router-dom";
import { Analytics } from "@vercel/analytics/react";
import { MODULES } from "./modules/registry";
import Landing from "./pages/Landing";

/**
 * The shell: owns global chrome (nav, background, footer) and routing.
 * Each module is lazy-loaded into its own chunk, so the landing page bundle
 * stays small no matter how many modules the suite grows to.
 */
const moduleRoutes = MODULES.map((m) => ({
  ...m,
  Component: lazy(m.load),
}));

export default function App() {
  return (
    <div className="flex min-h-screen flex-col bg-brand-background font-body text-brand-text">
      <nav className="sticky top-0 z-40 border-b-thick border-brand-border bg-brand-background">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
          <Link
            to="/"
            className="font-heading text-sm uppercase text-brand-text transition hover:bg-brand-warning"
          >
            Scroll Goblin
          </Link>
          <Link
            to="/"
            className="rounded-neobrutal border-thin border-brand-border bg-brand-secondary px-3 py-1 text-xs font-bold text-brand-text shadow-neo-sm transition-[transform,box-shadow] duration-100 active:translate-x-0.5 active:translate-y-0.5 active:shadow-neo-pressed"
          >
            All apps
          </Link>
        </div>
      </nav>

      <main className="flex-1">
        <Suspense
          fallback={
            <div className="py-24 text-center font-bold text-brand-text">
              Loading...
            </div>
          }
        >
          <Routes>
            <Route path="/" element={<Landing />} />
            {moduleRoutes.map((m) => (
              <Route key={m.id} path={`${m.path}/*`} element={<m.Component />} />
            ))}
          </Routes>
        </Suspense>
      </main>

      <footer className="border-t-thick border-brand-border bg-brand-surface px-4 py-6 text-center text-xs font-bold text-brand-text">
        Decoupled monorepo / React + TS shell / Hono API / Vercel AI SDK
        (Gemini)
      </footer>
      <Analytics />
    </div>
  );
}
