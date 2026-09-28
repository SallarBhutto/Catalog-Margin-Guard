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
  // The footer follows the workflow so Privacy, Terms, and Support stay reachable.
  const footer = page.getByTestId("site-footer")
  await expect(footer).toBeAttached()
  await footer.scrollIntoViewIfNeeded()
  await expect(footer.getByRole("link", { name: "Privacy Policy" })).toBeVisible()
  await expect(footer.getByRole("link", { name: "Support" })).toBeVisible()
  expect(await footer.evaluate((element) => getComputedStyle(element).position)).not.toBe(
    "sticky",
  )
})

test("canonical link and og:url follow client-side navigation without duplicates", async ({
  page,
}) => {
  await page.goto("/")
  const read = () =>
    page.evaluate(() => ({
      canonical: [...document.head.querySelectorAll('link[rel="canonical"]')].map((l) =>
        l.getAttribute("href"),
      ),
      ogUrl: [...document.head.querySelectorAll('meta[property="og:url"]')].map((m) =>
        m.getAttribute("content"),
      ),
    }))
  expect(await read()).toEqual({
    canonical: ["https://catalogmarginguard.com/"],
    ogUrl: ["https://catalogmarginguard.com/"],
  })
  await page
    .getByTestId("site-footer")
    .getByRole("link", { name: "Privacy Policy" })
    .click()
  await expect(page).toHaveURL(/\/privacy$/)
  expect(await read()).toEqual({
    canonical: ["https://catalogmarginguard.com/privacy"],
    ogUrl: ["https://catalogmarginguard.com/privacy"],
  })
  await page.getByTestId("site-footer").getByRole("link", { name: "Terms" }).click()
  await page.goBack()
  await expect(page).toHaveURL(/\/privacy$/)
  expect(await read()).toEqual({
    canonical: ["https://catalogmarginguard.com/privacy"],
    ogUrl: ["https://catalogmarginguard.com/privacy"],
  })
  await page.goto("/check")
  expect(await read()).toEqual({
    canonical: ["https://catalogmarginguard.com/check"],
    ogUrl: ["https://catalogmarginguard.com/check"],
  })
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
  const footer = page.getByTestId("site-footer")

  // The header holds only the brand link and the account control.
  await expect(
    header.getByRole("link", { name: "Catalog Margin Guard home" }),
  ).toBeVisible()
  await expect(header.getByRole("navigation")).toHaveCount(0)
  await expect(header.getByRole("link")).toHaveCount(1)
  for (const removed of ["How it works", "Privacy", "Check my catalog"]) {
    await expect(header.getByRole("link", { name: removed })).toHaveCount(0)
  }

  await page.getByRole("link", { name: "Check My Catalog — Free", exact: true }).click()
  await expect(page).toHaveURL(/\/check$/)
  await expect(page.getByRole("heading", { name: "Check your catalog" })).toBeVisible()

  await footer.getByRole("link", { name: "Privacy Policy" }).click()
  await expect(page).toHaveURL(/\/privacy$/)
  await expect(page.getByRole("heading", { name: "Privacy Policy" })).toBeVisible()

  await footer.getByRole("link", { name: "Terms" }).click()
  await expect(page).toHaveURL(/\/terms$/)
  await expect(page.getByRole("heading", { name: "Terms of Service" })).toBeVisible()

  await header.getByRole("link", { name: "Catalog Margin Guard home" }).click()
  await expect(page).toHaveURL(/\/$/)
  await expect(
    page.getByRole("heading", { name: "Find products quietly eating your margin." }),
  ).toBeVisible()

  expect(documentRequests).toBe(afterLoad)
  await expect(footer.getByRole("link", { name: "Support" })).toHaveAttribute(
    "href",
    "mailto:support@catalogmarginguard.com",
  )

  // Keyboard: skip link, brand link, then the account control, then page content.
  await page.getByRole("link", { name: "Skip to main content" }).focus()
  await page.keyboard.press("Tab")
  await expect(
    header.getByRole("link", { name: "Catalog Margin Guard home" }),
  ).toBeFocused()
  await page.keyboard.press("Tab")
  await expect(header.getByRole("button", { name: "Sign in" })).toBeFocused()
  await page.keyboard.press("Tab")
  await expect(
    page.getByRole("link", { name: "Check My Catalog — Free", exact: true }),
  ).toBeFocused()
})

test("public shell fits desktop and mobile widths without overflow", async ({ page }) => {
  for (const [width, path] of [
    [1440, "/"],
    [1440, "/check"],
    [1024, "/privacy"],
    [768, "/terms"],
    [768, "/check"],
    [390, "/"],
    [390, "/privacy"],
    [390, "/check"],
  ] as const) {
    await page.setViewportSize({ width, height: 900 })
    await page.goto(path)
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
      ),
    ).toBe(false)
    const header = page.getByTestId("app-header")
    await expect(
      header.getByRole("link", { name: "Catalog Margin Guard home" }),
    ).toBeVisible()
    await expect(header.getByRole("navigation")).toHaveCount(0)
    const footer = page.getByTestId("site-footer")
    await footer.scrollIntoViewIfNeeded()
    await expect(footer).toBeVisible()
    if (path === "/check") {
      // The footer must come after the workflow content, never overlap it.
      const [mainBottom, footerTop] = await page.evaluate(() => [
        document.querySelector("#main-content")!.getBoundingClientRect().bottom,
        document.querySelector('[data-testid="site-footer"]')!.getBoundingClientRect()
          .top,
      ])
      expect(footerTop).toBeGreaterThanOrEqual(mainBottom)
    }
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
