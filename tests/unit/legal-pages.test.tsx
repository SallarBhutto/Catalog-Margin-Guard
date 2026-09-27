import { render, screen, within } from "@testing-library/react"
import { readFileSync } from "node:fs"
import path from "node:path"

import { SITE_ORIGIN, SUPPORT_EMAIL } from "@/app/site-metadata"
import { PrivacyPage } from "@/features/legal/privacy-page"
import { TermsPage } from "@/features/legal/terms-page"

describe("privacy policy", () => {
  it("states only what the implementation does", () => {
    render(<PrivacyPage />)
    const main = screen.getByRole("main")

    expect(
      within(main).getByRole("heading", { level: 1, name: "Privacy Policy" }),
    ).toBeVisible()
    expect(within(main).getByText("Last updated: September 2026")).toBeVisible()
    for (const claim of [
      /analyzed there\. The file contents, product identifiers, costs, prices, margins, column names, and results are not uploaded/,
      /exists only in your browser's memory for the current page session/,
      /Accounts are provided by Clerk/,
      /Google processes your sign-in under its own terms/,
      /hosted and delivered by Cloudflare/,
      /does not use analytics, advertising, or tracking services/,
      /We do not sell your catalog data/,
    ]) {
      expect(within(main).getByText(claim)).toBeInTheDocument()
    }
    expect(within(main).getByRole("link", { name: SUPPORT_EMAIL })).toHaveAttribute(
      "href",
      `mailto:${SUPPORT_EMAIL}`,
    )
    expect(main.textContent).not.toMatch(
      /GDPR|SOC ?2|ISO ?27001|HIPAA|certified|compliant/i,
    )
  })
})

describe("terms of service", () => {
  it("covers the required topics without guarantees", () => {
    render(<TermsPage />)
    const main = screen.getByRole("main")

    expect(
      within(main).getByRole("heading", { level: 1, name: "Terms of Service" }),
    ).toBeVisible()
    expect(within(main).getByText("Last updated: September 2026")).toBeVisible()
    for (const heading of [
      "What the service does",
      "Your responsibilities",
      "No guarantees",
      "Acceptable use",
      "Intellectual property",
      "Changes",
      "Contact",
    ]) {
      expect(within(main).getByRole("heading", { level: 2, name: heading })).toBeVisible()
    }
    expect(within(main).getByText(/does not recommend prices/)).toBeInTheDocument()
    expect(within(main).getByText(/provided as is and as available/)).toBeInTheDocument()
    expect(within(main).getByRole("link", { name: SUPPORT_EMAIL })).toHaveAttribute(
      "href",
      `mailto:${SUPPORT_EMAIL}`,
    )
  })
})

describe("document metadata", () => {
  const html = readFileSync(path.resolve(import.meta.dirname, "../../index.html"), "utf8")

  it("declares the canonical URL, social metadata, icons, and manifest for production", () => {
    expect(SITE_ORIGIN).toBe("https://catalogmarginguard.com")
    expect(html).toContain(`<link rel="canonical" href="${SITE_ORIGIN}/" />`)
    expect(html).toContain(
      '<meta property="og:site_name" content="Catalog Margin Guard" />',
    )
    expect(html).toContain(`<meta property="og:url" content="${SITE_ORIGIN}/" />`)
    expect(html).toContain(
      `<meta property="og:image" content="${SITE_ORIGIN}/og-image.svg" />`,
    )
    expect(html).toContain('<meta name="twitter:card" content="summary_large_image" />')
    expect(html).toContain('<link rel="icon" href="/favicon.svg" type="image/svg+xml" />')
    expect(html).toContain('<link rel="manifest" href="/site.webmanifest" />')
    expect(html).toMatch(
      /<title>Catalog Margin Guard — Find products quietly eating your margin<\/title>/,
    )
    expect(html).not.toMatch(/localhost|pages\.dev/)
  })

  it("ships the static assets the metadata references", () => {
    const publicDir = path.resolve(import.meta.dirname, "../../public")
    for (const file of [
      "favicon.svg",
      "apple-touch-icon.svg",
      "og-image.svg",
      "site.webmanifest",
      "robots.txt",
      "sitemap.xml",
    ]) {
      expect(() => readFileSync(path.join(publicDir, file))).not.toThrow()
    }
    const sitemap = readFileSync(path.join(publicDir, "sitemap.xml"), "utf8")
    for (const route of ["/", "/privacy", "/terms"])
      expect(sitemap).toContain(`${SITE_ORIGIN}${route}`)
    expect(sitemap).not.toContain("/check")
    expect(readFileSync(path.join(publicDir, "robots.txt"), "utf8")).toContain(
      "Disallow: /check",
    )
  })
})
