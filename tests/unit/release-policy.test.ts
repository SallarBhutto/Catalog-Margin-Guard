import {
  PRODUCTION_BRANCH,
  PRODUCTION_DOMAIN,
  checkReleasePolicy,
  resolveBuildTarget,
} from "../../deployment/release-policy"
import { parseClerkPublishableKey } from "../../deployment/security-headers"

/** Representative keys built from public Clerk hostnames; they carry no credential. */
const developmentKey = parseClerkPublishableKey(
  `pk_test_${btoa("calm-fox-12.clerk.accounts.dev$")}`,
)
const productionKey = parseClerkPublishableKey(
  `pk_live_${btoa(`clerk.${PRODUCTION_DOMAIN}$`)}`,
)

describe("release policy", () => {
  it("names the production branch and domain", () => {
    expect(PRODUCTION_BRANCH).toBe("main")
    expect(PRODUCTION_DOMAIN).toBe("catalogmarginguard.com")
  })

  it("classifies the build target from the Cloudflare Pages branch", () => {
    expect(resolveBuildTarget({})).toBe("local")
    expect(resolveBuildTarget({ CF_PAGES_BRANCH: "main" })).toBe("production")
    expect(resolveBuildTarget({ CF_PAGES_BRANCH: "release/beta" })).toBe("preview")
  })

  it("fails a production build that embeds a development Clerk instance", () => {
    const result = checkReleasePolicy(developmentKey, { CF_PAGES_BRANCH: "main" })
    expect(result.target).toBe("production")
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0]).toContain("pk_live_")
    expect(result.errors[0]).toContain(PRODUCTION_DOMAIN)
  })

  it("fails a preview build that embeds the production Clerk instance", () => {
    const result = checkReleasePolicy(productionKey, { CF_PAGES_BRANCH: "release/beta" })
    expect(result.target).toBe("preview")
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0]).toContain("pages.dev")
  })

  it("accepts the intended key for each Cloudflare target without warnings", () => {
    expect(checkReleasePolicy(productionKey, { CF_PAGES_BRANCH: "main" })).toEqual({
      target: "production",
      errors: [],
      warnings: [],
    })
    expect(
      checkReleasePolicy(developmentKey, { CF_PAGES_BRANCH: "release/beta" }),
    ).toEqual({ target: "preview", errors: [], warnings: [] })
  })

  it("fails Cloudflare builds without a valid key but only warns locally", () => {
    expect(checkReleasePolicy(null, { CF_PAGES_BRANCH: "main" }).errors).toHaveLength(1)
    expect(checkReleasePolicy(null, { CF_PAGES_BRANCH: "x" }).errors).toHaveLength(1)
    const local = checkReleasePolicy(null, {})
    expect(local.errors).toEqual([])
    expect(local.warnings).toHaveLength(1)
  })

  it("warns about a development instance in local builds and stays quiet for production keys", () => {
    expect(checkReleasePolicy(developmentKey, {}).warnings[0]).toContain("100 users")
    expect(checkReleasePolicy(productionKey, {})).toEqual({
      target: "local",
      errors: [],
      warnings: [],
    })
  })
})
