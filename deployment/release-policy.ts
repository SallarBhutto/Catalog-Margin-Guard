import type { ClerkInstance } from "./security-headers"

/**
 * Which Clerk instance a build is allowed to embed, decided from the branch Cloudflare
 * Pages reports through `CF_PAGES_BRANCH`. Production (`main`) serves
 * catalogmarginguard.com and needs the Clerk production instance (`pk_live_`); every other
 * branch is a pages.dev preview, where Clerk production keys do not work, and must use the
 * development instance (`pk_test_`). Outside Cloudflare (no `CF_PAGES_BRANCH`) any key is
 * accepted with a warning so local builds keep working.
 */

const PRODUCTION_BRANCH = "main"
const PRODUCTION_DOMAIN = "catalogmarginguard.com"

type BuildTarget = "production" | "preview" | "local"

type BuildEnvironment = Readonly<{
  CF_PAGES_BRANCH?: string
}>

type ReleasePolicyResult = Readonly<{
  target: BuildTarget
  errors: string[]
  warnings: string[]
}>

function resolveBuildTarget(env: BuildEnvironment): BuildTarget {
  if (!env.CF_PAGES_BRANCH) return "local"
  return env.CF_PAGES_BRANCH === PRODUCTION_BRANCH ? "production" : "preview"
}

function checkReleasePolicy(
  clerk: ClerkInstance | null,
  env: BuildEnvironment,
): ReleasePolicyResult {
  const target = resolveBuildTarget(env)
  const errors: string[] = []
  const warnings: string[] = []

  if (!clerk) {
    const message =
      "VITE_CLERK_PUBLISHABLE_KEY is missing or invalid: sign-in would be disabled and the CSP would allow no Clerk host."
    if (target === "local") warnings.push(message)
    else errors.push(message)
    return { target, errors, warnings }
  }

  if (target === "production" && clerk.environment !== "production") {
    errors.push(
      `Production builds of ${PRODUCTION_DOMAIN} (branch ${PRODUCTION_BRANCH}) require the Clerk production instance (pk_live_), but a development key (pk_test_) was provided. Set the Production VITE_CLERK_PUBLISHABLE_KEY in Cloudflare Pages.`,
    )
  }
  if (target === "preview" && clerk.environment !== "development") {
    errors.push(
      `Preview builds run on pages.dev, where the Clerk production instance does not work. A production key (pk_live_) was provided; set the Preview VITE_CLERK_PUBLISHABLE_KEY to the development key (pk_test_).`,
    )
  }
  if (target === "local" && clerk.environment === "development") {
    warnings.push(
      "This build uses a Clerk development instance (pk_test_): capped at 100 users and not meant for production workloads. See docs/deployment.md.",
    )
  }

  return { target, errors, warnings }
}

export { PRODUCTION_BRANCH, PRODUCTION_DOMAIN, checkReleasePolicy, resolveBuildTarget }
export type { BuildEnvironment, BuildTarget, ReleasePolicyResult }
