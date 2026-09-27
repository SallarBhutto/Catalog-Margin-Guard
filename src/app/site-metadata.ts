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
  getRoute,
}
export type { AppRoute }
