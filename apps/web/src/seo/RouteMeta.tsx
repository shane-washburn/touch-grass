import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { MODULES } from "../modules/registry";
import {
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_URL,
  STATIC_PAGES,
  pageTitle,
} from "./site";

/**
 * Keeps the document head in sync with the current route: title, meta
 * description, canonical URL, and OG/Twitter tags. Renders nothing, so the
 * UI is untouched. Lives in the shell like VisitTracker — modules never
 * have to think about SEO.
 */
function setMeta(selector: string, content: string) {
  const el = document.head.querySelector<HTMLMetaElement>(selector);
  if (el) el.setAttribute("content", content);
}

function resolveRoute(pathname: string) {
  const staticPage = STATIC_PAGES.find((p) => p.path === pathname);
  if (staticPage) return staticPage;
  const module = MODULES.find(
    (m) => pathname === m.path || pathname.startsWith(`${m.path}/`)
  );
  if (module)
    return { path: module.path, title: module.title, description: module.description };
  return null;
}

export default function RouteMeta() {
  const { pathname } = useLocation();

  useEffect(() => {
    const route = resolveRoute(pathname);
    const title = pageTitle(route?.title ?? SITE_NAME);
    const description = route?.description ?? SITE_DESCRIPTION;
    const url = `${SITE_URL}${route?.path === "/" ? "/" : route?.path ?? pathname}`;

    document.title = title;
    setMeta('meta[name="description"]', description);
    setMeta('meta[property="og:title"]', title);
    setMeta('meta[property="og:description"]', description);
    setMeta('meta[property="og:url"]', url);
    setMeta('meta[name="twitter:title"]', title);
    setMeta('meta[name="twitter:description"]', description);
    document.head
      .querySelector('link[rel="canonical"]')
      ?.setAttribute("href", url);
  }, [pathname]);

  return null;
}
