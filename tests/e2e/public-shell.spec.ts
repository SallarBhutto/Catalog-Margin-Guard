import { expect, test } from "@playwright/test"

test("direct visits to /privacy, /terms, and /check render the right page with titles", async ({
  page,
}) => {
  await page.goto("/privacy")
  await expect(page.getByRole("heading", { name: "Privacy Policy" })).toBeVisible()
  await expect(page).toHaveTitle("Privacy Policy — Catalog Margin Guard")
  await expect(page.getByTestId("site-footer")).toBeVisible()

  await page.goto("/terms")
  await expect(page.getByRole("heading", { name: "Terms of Service" })).toBeVisible()
  await expect(page).toHaveTitle("Terms of Service — Catalog Margin Guard")

  await page.reload()
  await expect(page.getByRole("heading", { name: "Terms of Service" })).toBeVisible()

  await page.goto("/check")
  await expect(page.getByRole("heading", { name: "Check your catalog" })).toBeVisible()
  await expect(page).toHaveTitle("Check your catalog — Catalog Margin Guard")
  await expect(page.getByTestId("site-footer")).toHaveCount(0)
})

test("header and footer navigation stay client-side and keep accessible names", async ({
  page,
}) => {
  let documentRequests = 0
  page.on("request", (request) => {
    if (request.isNavigationRequest() && request.frame() === page.mainFrame()) {
      documentRequests += 1
    }
  })
  await page.goto("/")
  await expect(page).toHaveTitle(/Find products quietly eating your margin/)
  const afterLoad = documentRequests
  const header = page.getByTestId("app-header")
  const nav = header.getByRole("navigation", { name: "Site" })

  await expect(
    header.getByRole("link", { name: "Catalog Margin Guard home" }),
  ).toBeVisible()
  await nav.getByRole("link", { name: "Privacy" }).click()
  await expect(page).toHaveURL(/\/privacy$/)
  await expect(page.getByRole("heading", { name: "Privacy Policy" })).toBeVisible()
  await expect(nav.getByRole("link", { name: "Privacy" })).toHaveAttribute(
    "aria-current",
    "page",
  )

  await page.getByTestId("site-footer").getByRole("link", { name: "Terms" }).click()
  await expect(page).toHaveURL(/\/terms$/)
  await expect(page.getByRole("heading", { name: "Terms of Service" })).toBeVisible()

  await nav.getByRole("link", { name: "Check my catalog" }).click()
  await expect(page).toHaveURL(/\/check$/)
  await expect(page.getByRole("heading", { name: "Check your catalog" })).toBeVisible()
  await expect(nav.getByRole("link", { name: "Check my catalog" })).toHaveCount(0)

  await header.getByRole("link", { name: "Catalog Margin Guard home" }).click()
  await expect(page).toHaveURL(/\/$/)
  await nav.getByRole("link", { name: "How it works" }).click()
  await expect(
    page.getByRole("heading", { name: "From two files to a focused review." }),
  ).toBeInViewport()

  expect(documentRequests).toBe(afterLoad)
  await expect(
    page.getByTestId("site-footer").getByRole("link", { name: "Support" }),
  ).toHaveAttribute("href", "mailto:support@catalogmarginguard.com")

  // Keyboard: from the skip link, Tab walks the header in reading order.
  await page.getByRole("link", { name: "Skip to main content" }).focus()
  await page.keyboard.press("Tab")
  await expect(
    header.getByRole("link", { name: "Catalog Margin Guard home" }),
  ).toBeFocused()
  await page.keyboard.press("Tab")
  await expect(nav.getByRole("link", { name: "How it works" })).toBeFocused()
  await page.keyboard.press("Tab")
  await expect(nav.getByRole("link", { name: "Privacy" })).toBeFocused()
})

test("public shell fits desktop and mobile widths without overflow", async ({ page }) => {
  for (const [width, path] of [
    [1440, "/"],
    [1024, "/privacy"],
    [768, "/terms"],
    [390, "/"],
    [390, "/privacy"],
  ] as const) {
    await page.setViewportSize({ width, height: 900 })
    await page.goto(path)
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
      ),
    ).toBe(false)
    const desktopNav = page
      .getByTestId("app-header")
      .getByRole("navigation", { name: "Site" })
    if (width >= 768) await expect(desktopNav).toBeVisible()
    else await expect(desktopNav).toBeHidden()
    await expect(page.getByTestId("site-footer")).toBeVisible()
    if (process.env.VISUAL_QA_DIR) {
      await page.screenshot({
        path: `${process.env.VISUAL_QA_DIR}/shell-${width}${path.replace("/", "-") || "-home"}.png`,
        fullPage: true,
      })
    }
  }
})

test("signed-in header shows a labelled account control", async ({ page }) => {
  await page.goto("/")
  await page.getByRole("button", { name: "Sign in" }).click()
  await page.getByRole("button", { name: "Complete sign in" }).click()
  const control = page.getByTestId("account-control")
  await expect(control.getByText("Account")).toBeVisible()
  await expect(control.getByRole("button", { name: "Sign out" })).toBeVisible()
})
