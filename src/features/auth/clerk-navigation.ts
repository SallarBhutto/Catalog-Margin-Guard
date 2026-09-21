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
}
export type { ClerkRouterFn, SignInModalOptions }
