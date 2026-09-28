import { expect, test } from "@playwright/test"

test("landing page communicates value and opens the setup shell", async ({ page }) => {
  await page.goto("/")

  await expect(
    page.getByRole("heading", { name: "Find products quietly eating your margin." }),
  ).toBeVisible()
  await expect(
    page.getByRole("link", { name: "Check My Catalog — Free", exact: true }),
  ).toBeVisible()
  await expect(page.getByText("Files stay on your computer.").first()).toBeVisible()

  await page.getByRole("link", { name: "Check My Catalog — Free", exact: true }).click()

  await expect(page).toHaveURL(/\/check$/)
  await expect(page.getByRole("heading", { name: "Check your catalog" })).toBeVisible()
})

test("landing page has no horizontal overflow on a mobile viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto("/")

  const hasOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  )

  expect(hasOverflow).toBe(false)
  await expect(
    page.getByRole("link", { name: "Check My Catalog — Free", exact: true }),
  ).toBeVisible()
})

test("sign-in stays in context and explains the privacy boundary", async ({ page }) => {
  await page.goto("/")
  const landingHeading = page.locator("#main-content h1")

  await expect(landingHeading).toHaveText("Find products quietly eating your margin.")

  await page.getByRole("button", { name: "Sign in" }).click()

  await expect(
    page.getByText("Signing in only creates your Catalog Margin Guard account."),
  ).toBeVisible()
  await expect(
    page.getByText(
      "Your supplier and catalog files remain on your computer and are not uploaded.",
    ),
  ).toBeVisible()
  await expect(landingHeading).toBeAttached()
  expect(new URL(page.url()).pathname).toBe("/")
})

test("sign-in and sign-out from the landing page stay client-side", async ({ page }) => {
  let mainFrameNavigations = 0
  let documentRequests = 0
  page.on("framenavigated", (frame) => {
    if (frame === page.mainFrame()) mainFrameNavigations += 1
  })
  page.on("request", (request) => {
    if (request.isNavigationRequest() && request.frame() === page.mainFrame()) {
      documentRequests += 1
    }
  })

  await page.goto("/")
  const landingHeading = page.locator("#main-content h1")
  await expect(landingHeading).toHaveText("Find products quietly eating your margin.")
  const navigationsAfterLoad = mainFrameNavigations
  const documentRequestsAfterLoad = documentRequests
  await page.evaluate(() => {
    ;(window as typeof window & { __documentMarker?: symbol }).__documentMarker =
      Symbol("landing-document")
  })
  const documentSurvived = () =>
    page.evaluate(
      () =>
        typeof (window as typeof window & { __documentMarker?: symbol })
          .__documentMarker === "symbol",
    )

  await page.getByRole("button", { name: "Sign in" }).click()
  await page.getByRole("button", { name: "Complete sign in" }).click()
  await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible()
  await expect(landingHeading).toHaveText("Find products quietly eating your margin.")
  expect(new URL(page.url()).pathname).toBe("/")
  expect(mainFrameNavigations).toBe(navigationsAfterLoad)
  expect(documentRequests).toBe(documentRequestsAfterLoad)

  expect(await documentSurvived()).toBe(true)

  await page.getByRole("button", { name: "Sign out" }).click()
  await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible()
  await expect(landingHeading).toHaveText("Find products quietly eating your margin.")
  expect(new URL(page.url()).pathname).toBe("/")
  expect(mainFrameNavigations).toBe(navigationsAfterLoad)
  expect(documentRequests).toBe(documentRequestsAfterLoad)
  expect(await documentSurvived()).toBe(true)
})
