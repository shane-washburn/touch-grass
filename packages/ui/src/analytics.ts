/**
 * Lightweight GA4 wrapper.
 *
 * No-ops unless the app shell passes a GA measurement ID. The app shell owns
 * page views/duration; shared components can report cross-module actions
 * without importing app code.
 */

const VISITOR_KEY = "scroll-goblin:first-seen";

type AnalyticsParams = Record<string, string | number | boolean | undefined>;

declare global {
  interface Window {
    dataLayer?: IArguments[];
    gtag?: (...args: unknown[]) => void;
    scrollGoblinAnalyticsDebug?: {
      measurementId: string;
      enabled: boolean;
      dataLayer: () => IArguments[];
      test: () => void;
      pageView: () => void;
    };
  }
}

let initialized = false;
let gaMeasurementId: string | null = null;
let visitorType: "new" | "returning" | null = null;

function canTrack(): boolean {
  return typeof window !== "undefined" && Boolean(gaMeasurementId);
}

function setMeasurementId(measurementId?: string): string | null {
  const nextId = measurementId?.trim();
  if (nextId) gaMeasurementId = nextId;
  return gaMeasurementId;
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

export function initGoogleAnalytics(measurementId?: string): void {
  const nextId = setMeasurementId(measurementId);
  if (typeof window === "undefined" || !nextId || initialized) return;
  initialized = true;

  window.dataLayer = window.dataLayer ?? [];
  window.gtag =
    window.gtag ??
    function gtag() {
      window.dataLayer?.push(arguments);
    };

  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(
    nextId
  )}`;
  document.head.appendChild(script);

  window.gtag("js", new Date());
  window.gtag("set", "user_properties", {
    visitor_type: getVisitorType(),
  });
  window.gtag("config", nextId, { send_page_view: false });
  window.scrollGoblinAnalyticsDebug = {
    measurementId: nextId,
    enabled: true,
    dataLayer: () => window.dataLayer ?? [],
    test: () =>
      trackEvent("scroll_goblin_manual_test", {
        debug_mode: true,
        test_source: "console",
      }),
    pageView: () =>
      trackPageView({
        path: window.location.pathname,
        title: document.title,
      }),
  };
}

export function trackEvent(
  name: string,
  params: AnalyticsParams = {}
): void {
  initGoogleAnalytics();
  if (!canTrack() || !gaMeasurementId) return;
  window.gtag?.("event", name, {
    send_to: gaMeasurementId,
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
