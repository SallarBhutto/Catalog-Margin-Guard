/**
 * Generates the `_headers` file emitted into the production build. The syntax is the one
 * shared by Cloudflare Pages and Netlify; any other host needs an equivalent configuration.
 *
 * The Content Security Policy has to name the Clerk Frontend API host, which differs between
 * Clerk instances. That host is encoded in the public publishable key, so the policy is
 * derived at build time instead of being hard-coded for one environment.
 */

const PUBLISHABLE_KEY_PATTERN = /^pk_(test|live)_([A-Za-z0-9+/=_-]+)$/
const HOSTNAME_PATTERN =
  /^(?=.{1,253}$)[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/

type ClerkInstance = Readonly<{
  frontendApiHost: string
  environment: "development" | "production"
}>

/** Reads the Frontend API host from a Clerk publishable key. The key is public by design. */
function parseClerkPublishableKey(
  publishableKey: string | undefined,
): ClerkInstance | null {
  const match = PUBLISHABLE_KEY_PATTERN.exec(publishableKey?.trim() ?? "")
  if (!match) return null

  let decoded: string
  try {
    decoded = atob((match[2] ?? "").replaceAll("-", "+").replaceAll("_", "/"))
  } catch {
    return null
  }

  const host = decoded.replace(/\$$/, "").toLowerCase()
  // Anything that is not a plain hostname is rejected so it can never reach a header value.
  if (!HOSTNAME_PATTERN.test(host)) return null

  return {
    frontendApiHost: host,
    environment: match[1] === "live" ? "production" : "development",
  }
}

function createContentSecurityPolicy(clerk: ClerkInstance | null) {
  const clerkOrigin = clerk ? [`https://${clerk.frontendApiHost}`] : []
  // Sources Clerk documents for its bot and abuse protection.
  const clerkProtection = clerk
    ? ["https://challenges.cloudflare.com", "https://*.protect.clerk.com"]
    : []

  const directives: readonly (readonly [string, readonly string[]])[] = [
    ["default-src", ["'self'"]],
    // 'wasm-unsafe-eval' lets DuckDB compile its self-hosted WebAssembly module.
    ["script-src", ["'self'", "'wasm-unsafe-eval'", ...clerkOrigin, ...clerkProtection]],
    // Clerk injects runtime CSS-in-JS, which requires inline styles.
    ["style-src", ["'self'", "'unsafe-inline'"]],
    ["img-src", ["'self'", "data:", ...(clerk ? ["https://img.clerk.com"] : [])]],
    ["font-src", ["'self'"]],
    // `blob:` lets the DuckDB worker fetch the module this page decompressed. Blob URLs are
    // created by same-origin script only, so this opens no route to another origin.
    [
      "connect-src",
      [
        "'self'",
        "blob:",
        ...clerkOrigin,
        ...(clerk ? ["https://*.protect.clerk.com:*"] : []),
      ],
    ],
    ["worker-src", ["'self'", "blob:"]],
    ["frame-src", clerk ? clerkProtection : ["'none'"]],
    ["object-src", ["'none'"]],
    ["base-uri", ["'self'"]],
    ["form-action", ["'self'"]],
    ["frame-ancestors", ["'none'"]],
  ]

  return directives.map(([name, sources]) => `${name} ${sources.join(" ")}`).join("; ")
}

function createDeploymentHeaders(publishableKey: string | undefined) {
  const clerk = parseClerkPublishableKey(publishableKey)

  return [
    "/*",
    `  Content-Security-Policy: ${createContentSecurityPolicy(clerk)}`,
    "  X-Content-Type-Options: nosniff",
    "  Referrer-Policy: no-referrer",
    "  X-Frame-Options: DENY",
    "  Permissions-Policy: camera=(), geolocation=(), microphone=(), payment=(), usb=()",
    "  Strict-Transport-Security: max-age=31536000",
    "",
    "# Fingerprinted build output, including the large DuckDB modules, never changes.",
    "/assets/*",
    "  Cache-Control: public, max-age=31536000, immutable",
    "",
  ].join("\n")
}

export { createContentSecurityPolicy, createDeploymentHeaders, parseClerkPublishableKey }
export type { ClerkInstance }
