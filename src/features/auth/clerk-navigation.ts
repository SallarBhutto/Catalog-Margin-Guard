import type { ClerkProviderProps, useClerk } from "@clerk/react"

import { getCurrentLocation, navigateTo, replaceRoute } from "@/app/app-router"
import { clerkSignInAppearance } from "@/features/auth/clerk-appearance"

type ClerkRouterFn = NonNullable<ClerkProviderProps["routerPush"]>
type LoadedClerk = ReturnType<typeof useClerk>
type SignInModalOptions = NonNullable<Parameters<LoadedClerk["openSignIn"]>[0]>

/**
 * Clerk performs every post-authentication and post-sign-out navigation through these
 * callbacks. Without them clerk-js falls back to assigning `window.location.href`, which
 * replaces the document and destroys the in-memory analysis.
 */
const clerkRouterPush: ClerkRouterFn = (to) => navigateTo(to)
const clerkRouterReplace: ClerkRouterFn = (to) => replaceRoute(to)

/**
 * Options for Clerk's in-context modal. The initiating location becomes the fallback
 * redirect for both sign-in and the combined sign-up path, so Clerk's post-auth navigation
 * resolves back to the page the user is already on instead of the `/` default.
 */
function createSignInModalOptions(): SignInModalOptions {
  const initiatingLocation = getCurrentLocation()

  return {
    appearance: clerkSignInAppearance,
    oauthFlow: "popup",
    withSignUp: true,
    fallbackRedirectUrl: initiatingLocation,
    signUpFallbackRedirectUrl: initiatingLocation,
  }
}

/**
 * Whether Clerk will route the post-sign-in navigation through its Frontend API
 * `/v1/client/touch` endpoint. Clerk's prebuilt sign-in does this whenever the client
 * reports `isEligibleForTouch()` (client cookie due to expire within eight days, its Safari
 * ITP workaround). That is a full document navigation the router callbacks cannot
 * intercept, so the in-memory analysis would be lost. Uses only Clerk's public client API;
 * development instances never report eligibility.
 */
function willSignInReloadPage(clerk: Pick<LoadedClerk, "loaded" | "client">) {
  if (!clerk.loaded) return false
  try {
    return clerk.client?.isEligibleForTouch() === true
  } catch {
    return false
  }
}

/**
 * Passed to `clerk.signOut()`. When a callback is supplied, clerk-js runs it instead of its
 * post-sign-out navigation, so the user stays on the current route and the `/check`
 * document, DuckDB engine, and analysis stay alive while access drops to anonymous.
 *
 * A `redirectUrl` is deliberately not used: clerk-js can reroute that redirect through its
 * cross-origin `/client/touch` endpoint when the client cookie is close to expiry, which is
 * a full document navigation the client-side router callbacks cannot intercept.
 */
function stayOnCurrentRouteAfterSignOut() {
  return undefined
}

export {
  clerkRouterPush,
  clerkRouterReplace,
  createSignInModalOptions,
  stayOnCurrentRouteAfterSignOut,
  willSignInReloadPage,
}
export type { ClerkRouterFn, SignInModalOptions }
