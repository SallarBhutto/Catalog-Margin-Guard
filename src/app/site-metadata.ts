/** Production origin and per-route document metadata for the public shell. */

const SITE_ORIGIN = "https://catalogmarginguard.com"
const SITE_NAME = "Catalog Margin Guard"
const SUPPORT_EMAIL = "support@catalogmarginguard.com"
const LEGAL_LAST_UPDATED = "September 2026"

type AppRoute = "landing" | "setup" | "privacy" | "terms"

const ROUTE_PATHS: Readonly<Record<AppRoute, string>> = {
  landing: "/",
  setup: "/check",
  privacy: "/privacy",
  terms: "/terms",
}

const DOCUMENT_TITLES: Readonly<Record<AppRoute, string>> = {
  landing: "Catalog Margin Guard — Find products quietly eating your margin",
  setup: "Check your catalog — Catalog Margin Guard",
  privacy: "Privacy Policy — Catalog Margin Guard",
  terms: "Terms of Service — Catalog Margin Guard",
}

function getRouteUrl(route: AppRoute) {
  return `${SITE_ORIGIN}${ROUTE_PATHS[route]}`
}

/** Finds the metadata element in `head` or creates it once; never appends duplicates. */
function ensureHeadElement(selector: string, create: () => HTMLElement) {
  const existing = document.head.querySelector<HTMLElement>(selector)
  if (existing) return existing
  const element = create()
  document.head.append(element)
  return element
}

/**
 * Keeps the document title, canonical link, and `og:url` in step with client-side routing.
 * The static values in `index.html` describe the homepage; this updates them in place.
 */
function applyRouteMetadata(route: AppRoute) {
  document.title = DOCUMENT_TITLES[route]
  const url = getRouteUrl(route)

  ensureHeadElement('link[rel="canonical"]', () => {
    const link = document.createElement("link")
    link.rel = "canonical"
    return link
  }).setAttribute("href", url)

  ensureHeadElement('meta[property="og:url"]', () => {
    const meta = document.createElement("meta")
    meta.setAttribute("property", "og:url")
    return meta
  }).setAttribute("content", url)
}

function getRoute(pathname: string): AppRoute {
  const normalized = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname
  if (normalized === ROUTE_PATHS.setup) return "setup"
  if (normalized === ROUTE_PATHS.privacy) return "privacy"
  if (normalized === ROUTE_PATHS.terms) return "terms"
  return "landing"
}

export {
  DOCUMENT_TITLES,
  LEGAL_LAST_UPDATED,
  ROUTE_PATHS,
  SITE_NAME,
  SITE_ORIGIN,
  SUPPORT_EMAIL,
  applyRouteMetadata,
  getRoute,
  getRouteUrl,
}
export type { AppRoute }
