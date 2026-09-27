type RouteListener = () => void

const listeners = new Set<RouteListener>()

function notifyRouteListeners() {
  for (const listener of listeners) listener()
}

/** Current same-origin location as a path plus search and hash. Never includes the origin. */
function getCurrentLocation() {
  return `${window.location.pathname}${window.location.search}${window.location.hash}`
}

function getCurrentPathname() {
  return window.location.pathname
}

/**
 * Resolves a navigation target against the live document. Returns null for anything that
 * would leave the application origin because client-side routing must never replace the
 * browser document that owns the in-memory analysis.
 */
function resolveAppUrl(to: string): URL | null {
  const url = new URL(to, window.location.href)
  if (url.origin !== window.location.origin) {
    if (import.meta.env.DEV) {
      console.warn("[Catalog Margin Guard] Ignored cross-origin client-side navigation.")
    }
    return null
  }
  return url
}

/** Pushes a history entry without reloading. A navigation to the current URL is a no-op. */
function navigateTo(to: string) {
  const url = resolveAppUrl(to)
  if (!url || url.href === window.location.href) return

  window.history.pushState({}, "", url.href)
  notifyRouteListeners()
}

/** Replaces the current history entry without reloading. */
function replaceRoute(to: string) {
  const url = resolveAppUrl(to)
  if (!url) return

  window.history.replaceState({}, "", url.href)
  notifyRouteListeners()
}

/** Subscribes to programmatic route changes and browser history traversal. */
function subscribeToRoute(listener: RouteListener) {
  listeners.add(listener)
  window.addEventListener("popstate", listener)

  return () => {
    listeners.delete(listener)
    window.removeEventListener("popstate", listener)
  }
}

export {
  getCurrentLocation,
  getCurrentPathname,
  navigateTo,
  replaceRoute,
  subscribeToRoute,
}
