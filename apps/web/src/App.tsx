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
    <div className="flex min-h-screen flex-col bg-gradient-to-br from-brand-50 via-white to-pink-50 text-slate-800">
      <nav className="sticky top-0 z-40 border-b border-slate-100 bg-white/70 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
          <Link
            to="/"
            className="text-sm font-bold tracking-tight text-slate-900 transition hover:text-brand-600"
          >
            🧩 App Suite
          </Link>
          <Link
            to="/"
            className="text-xs font-medium text-slate-500 transition hover:text-brand-600"
          >
            All apps
          </Link>
        </div>
      </nav>

      <main className="flex-1">
        <Suspense
          fallback={
            <div className="py-24 text-center text-slate-400">Loading…</div>
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

      <footer className="py-8 text-center text-xs text-slate-400">
        Decoupled monorepo · React + TS shell · Hono API · Vercel AI SDK
        (Gemini)
      </footer>
      <Analytics />
    </div>
  );
}
