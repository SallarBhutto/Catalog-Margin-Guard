import { expect, test } from "@playwright/test"

const supplierCsv = "sku,cost\nABC-12,96\nXYZ-88,44\nKLP-91,151"
const catalogCsv = "sku,price,min_margin\nABC-12,105,10\nXYZ-88,69,30\nKLP-91,149,"

/**
 * The test authentication stub reports the Safari ITP cookie-refresh condition when the
 * page is opened with `?e2eSignInReloads=1`. Real Clerk reports it through
 * `client.isEligibleForTouch()`; that path is verified only on a production instance.
 */
test("warns anonymous users when sign-in would reload the page and lose the analysis", async ({
  page,
}) => {
  await page.goto("/check?e2eSignInReloads=1")
  await expect(page.getByTestId("engine-readiness")).toHaveText(
    "Local analysis is ready.",
    { timeout: 30_000 },
  )

  const notice = page.getByTestId("sign-in-first-notice")
  await expect(notice).toContainText("Sign in first.")
  await expect(notice).toContainText("signing in reloads the page")
  await expect(notice.getByRole("button", { name: "Sign in free" })).toBeVisible()

  await page.locator("#supplier-file-input").setInputFiles({
    name: "supplier.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(supplierCsv),
  })
  await page.locator("#catalog-file-input").setInputFiles({
    name: "catalog.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(catalogCsv),
  })
  await expect(page.getByTestId("setup-readiness")).toHaveAttribute(
    "data-setup-state",
    "READY_FOR_ANALYSIS",
    { timeout: 30_000 },
  )
  await page.getByRole("button", { name: "Analyze Catalog" }).click()
  await expect(page.getByRole("heading", { name: "Margin analysis" })).toBeVisible({
    timeout: 30_000,
  })

  const warning = page.getByTestId("sign-in-reload-warning")
  await expect(warning).toContainText(
    "Signing in from this browser will reload the page.",
  )
  await expect(warning).toContainText("clears this analysis")
  await expect(
    page.getByRole("button", { name: "Reveal My Results — Free" }),
  ).toBeEnabled()

  // Signing in first removes the notices; the warning is only for anonymous sessions.
  await page.getByRole("button", { name: "Sign in", exact: true }).click()
  await page.getByRole("button", { name: "Complete sign in" }).click()
  await expect(
    page.getByRole("table", { name: "Complete product results" }),
  ).toBeVisible()
  await expect(warning).toHaveCount(0)
  await expect(page.getByTestId("sign-in-first-notice")).toHaveCount(0)
})

test("shows no reload notices when the provider does not report one", async ({
  page,
}) => {
  await page.goto("/check")
  await expect(page.getByTestId("engine-readiness")).toHaveText(
    "Local analysis is ready.",
    { timeout: 30_000 },
  )
  await expect(page.getByTestId("sign-in-first-notice")).toHaveCount(0)
})
