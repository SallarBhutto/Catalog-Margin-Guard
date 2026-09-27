import {
  createContentSecurityPolicy,
  createDeploymentHeaders,
  parseClerkPublishableKey,
} from "../../deployment/security-headers"

function publishableKey(environment: "test" | "live", host: string) {
  return `pk_${environment}_${btoa(`${host}$`)}`
}

describe("deployment security headers", () => {
  it("derives the Clerk Frontend API host from the public publishable key", () => {
    expect(parseClerkPublishableKey(publishableKey("live", "clerk.example.com"))).toEqual(
      {
        frontendApiHost: "clerk.example.com",
        environment: "production",
      },
    )
    expect(
      parseClerkPublishableKey(publishableKey("test", "calm-fox-12.clerk.accounts.dev")),
    ).toEqual({
      frontendApiHost: "calm-fox-12.clerk.accounts.dev",
      environment: "development",
    })
  })

  it("rejects missing, malformed, and header-injecting keys", () => {
    for (const key of [
      undefined,
      "",
      "pk_test_your_publishable_key_here",
      "sk_live_abc",
      publishableKey("live", "clerk.example.com\n  X-Injected: 1"),
      publishableKey("live", "clerk.example.com; script-src *"),
      publishableKey("live", "localhost"),
    ]) {
      expect(parseClerkPublishableKey(key)).toBeNull()
    }
  })

  it("allows only the application, DuckDB WebAssembly, and the configured Clerk instance", () => {
    const policy = createContentSecurityPolicy({
      frontendApiHost: "clerk.example.com",
      environment: "production",
    })
    const directives = new Map(
      policy.split("; ").map((directive) => {
        const [name = "", ...sources] = directive.split(" ")
        return [name, sources] as const
      }),
    )

    expect(directives.get("default-src")).toEqual(["'self'"])
    expect(directives.get("script-src")).toEqual([
      "'self'",
      "'wasm-unsafe-eval'",
      "https://clerk.example.com",
      "https://challenges.cloudflare.com",
      "https://*.protect.clerk.com",
    ])
    // blob: is only for the DuckDB worker fetching the module this page decompressed.
    expect(directives.get("connect-src")).toEqual([
      "'self'",
      "blob:",
      "https://clerk.example.com",
      "https://*.protect.clerk.com:*",
    ])
    expect(directives.get("worker-src")).toEqual(["'self'", "blob:"])
    expect(directives.get("img-src")).toContain("https://img.clerk.com")
    expect(directives.get("object-src")).toEqual(["'none'"])
    expect(directives.get("frame-ancestors")).toEqual(["'none'"])
    expect(directives.get("script-src")).not.toContain("blob:")
    expect(directives.get("default-src")).not.toContain("blob:")
    expect(policy).not.toContain("'unsafe-eval'")
    expect(policy).not.toMatch(/script-src[^;]*'unsafe-inline'/)
    expect(policy).not.toContain("telemetry")
    expect(policy).not.toMatch(/(^|\s)\*(\s|;|$)/)
  })

  it("derives a production Frontend API origin on the custom domain from a pk_live_ key", () => {
    // Clerk assigns the production Frontend API host; a subdomain of the site is typical.
    const file = createDeploymentHeaders(
      publishableKey("live", "clerk.catalogmarginguard.com"),
    )
    const [policyLine = ""] = file
      .split("\n")
      .filter((line) => line.includes("Content-Security-Policy"))
    expect(policyLine).toContain(
      "script-src 'self' 'wasm-unsafe-eval' https://clerk.catalogmarginguard.com",
    )
    expect(policyLine).toContain(
      "connect-src 'self' blob: https://clerk.catalogmarginguard.com",
    )
    expect(policyLine).not.toContain("accounts.dev")
    expect(policyLine).not.toContain("pages.dev")
    expect(policyLine).not.toContain("localhost")
  })

  it("emits a same-origin-only policy when sign-in is not configured", () => {
    const policy = createContentSecurityPolicy(null)
    expect(policy).not.toContain("clerk")
    expect(policy).toContain("frame-src 'none'")
    expect(policy).toContain("script-src 'self' 'wasm-unsafe-eval';")
  })

  it("writes the host headers file within Cloudflare Pages limits", () => {
    const file = createDeploymentHeaders(publishableKey("live", "clerk.example.com"))
    const lines = file.split("\n")

    expect(lines[0]).toBe("/*")
    expect(file).toContain("  X-Content-Type-Options: nosniff")
    expect(file).toContain("  Referrer-Policy: no-referrer")
    expect(file).toContain("  X-Frame-Options: DENY")
    expect(file).toContain("  Strict-Transport-Security: max-age=31536000")
    expect(file).toContain(
      "/assets/*\n  Cache-Control: public, max-age=31536000, immutable",
    )
    expect(file).not.toContain("Cross-Origin-Embedder-Policy")
    expect(file).not.toContain("Cross-Origin-Opener-Policy")
    // Cloudflare Pages allows at most 2,000 characters per header and 100 rules.
    expect(Math.max(...lines.map((line) => line.length))).toBeLessThan(2000)
  })
})
