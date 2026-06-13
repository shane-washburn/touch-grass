/**
 * Lightweight GA4 wrapper.
 *
 * No-ops unless VITE_GA_MEASUREMENT_ID is configured. The app shell owns page
 * views/duration; shared components can report cross-module actions without
 * importing app code.
 */

const viteEnv = (import.meta as unknown as { env?: Record<string, string> })
  .env;

const GA_ID = viteEnv?.VITE_GA_MEASUREMENT_ID?.trim();
const VISITOR_KEY = "scroll-goblin:first-seen";

type AnalyticsParams = Record<string, string | number | boolean | undefined>;

type Gtag =
  | ["js", Date]
  | ["config", string, AnalyticsParams]
  | ["event", string, AnalyticsParams]
  | ["set", string, AnalyticsParams];

declare global {
  interface Window {
    dataLayer?: Gtag[];
    gtag?: (...args: Gtag) => void;
  }
}

let initialized = false;
let visitorType: "new" | "returning" | null = null;

function canTrack(): boolean {
  return typeof window !== "undefined" && Boolean(GA_ID);
}

function getVisitorType(): "new" | "returning" {
  if (visitorType) return visitorType;
  try {
    const firstSeen = localStorage.getItem(VISITOR_KEY);
    visitorType = firstSeen ? "returning" : "new";
    if (!firstSeen) localStorage.setItem(VISITOR_KEY, String(Date.now()));
  } catch {
    visitorType = "new";
  }
  return visitorType;
}

export function initGoogleAnalytics(): void {
  if (!canTrack() || initialized || !GA_ID) return;
  initialized = true;

  window.dataLayer = window.dataLayer ?? [];
  window.gtag =
    window.gtag ??
    ((...args: Gtag) => {
      window.dataLayer?.push(args);
    });

  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(
    GA_ID
  )}`;
  document.head.appendChild(script);

  window.gtag("js", new Date());
  window.gtag("set", "user_properties", {
    visitor_type: getVisitorType(),
  });
  window.gtag("config", GA_ID, { send_page_view: false });
}

export function trackEvent(
  name: string,
  params: AnalyticsParams = {}
): void {
  if (!canTrack()) return;
  initGoogleAnalytics();
  window.gtag?.("event", name, {
    visitor_type: getVisitorType(),
    ...params,
  });
}

export function trackPageView(params: {
  path: string;
  title: string;
  moduleId?: string;
}): void {
  trackEvent("page_view", {
    page_title: params.title,
    page_location: window.location.href,
    page_path: params.path,
    module_id: params.moduleId,
  });
}

export function trackPageDuration(params: {
  path: string;
  title: string;
  durationMs: number;
  moduleId?: string;
}): void {
  const durationMs = Math.max(0, Math.round(params.durationMs));
  trackEvent("page_duration", {
    page_title: params.title,
    page_path: params.path,
    module_id: params.moduleId,
    duration_ms: durationMs,
    duration_seconds: Math.round(durationMs / 1000),
  });
}

export function trackShareButtonPress(params: {
  moduleId: string;
  result: "copied" | "too_long" | "failed";
}): void {
  trackEvent("share_button_press", {
    module_id: params.moduleId,
    share_result: params.result,
    page_path: window.location.pathname,
  });
}

export function trackSurpriseMeClick(params: {
  destinationModuleId: string;
  destinationPath: string;
}): void {
  trackEvent("surprise_me_click", {
    destination_module_id: params.destinationModuleId,
    destination_path: params.destinationPath,
    page_path: window.location.pathname,
  });
}

export function trackModuleTileClick(params: {
  moduleId: string;
  index: number;
}): void {
  trackEvent("module_tile_click", {
    module_id: params.moduleId,
    tile_index: params.index,
    page_path: window.location.pathname,
  });
}
