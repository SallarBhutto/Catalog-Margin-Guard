import { expect, test } from "@playwright/test"

const ROW_COUNT = 400_000

function createLargeCatalog() {
  const supplier = new Array<string>(ROW_COUNT + 1)
  const catalog = new Array<string>(ROW_COUNT + 1)
  supplier[0] = "sku,cost"
  catalog[0] = "sku,price,min_margin"
  for (let index = 0; index < ROW_COUNT; index += 1) {
    const identifier = `SKU-${String(index).padStart(8, "0")}`
    supplier[index + 1] = `${identifier},${(index % 10_000) + 0.25}`
    catalog[index + 1] =
      `${identifier},${(index % 10_000) + 10.5},${index % 17 === 0 ? "20.5" : ""}`
  }
  return { supplier: supplier.join("\n"), catalog: catalog.join("\n") }
}

test("Cancel Analysis stops a running analysis, keeps the setup, and allows a retry", async ({
  page,
}) => {
  test.setTimeout(240_000)
  const browserErrors: string[] = []
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(message.text())
  })
  let documentRequests = 0
  page.on("request", (request) => {
    if (request.isNavigationRequest() && request.frame() === page.mainFrame()) {
      documentRequests += 1
    }
  })

  await page.goto("/check")
  await expect(page.getByTestId("engine-readiness")).toHaveText(
    "Local analysis is ready.",
    { timeout: 60_000 },
  )
  const files = createLargeCatalog()
  await page.locator("#supplier-file-input").setInputFiles({
    name: "large-supplier.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(files.supplier),
  })
  await page.locator("#catalog-file-input").setInputFiles({
    name: "large-catalog.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(files.catalog),
  })
  await expect(page.getByTestId("setup-readiness")).toHaveAttribute(
    "data-setup-state",
    "READY_FOR_ANALYSIS",
    { timeout: 90_000 },
  )
  const documentRequestsBeforeAnalysis = documentRequests

  await page.getByRole("button", { name: "Analyze Catalog" }).click()
  const cancel = page.getByRole("button", { name: "Cancel Analysis" })
  await expect(cancel).toBeVisible()
  const cancelRequestedAt = Date.now()
  await cancel.click()

  // Back on the setup screen: no results, files and settings kept, no page reload.
  await expect(page.getByTestId("analysis-cancelled")).toContainText(
    "Analysis cancelled.",
    { timeout: 60_000 },
  )
  const cancelMs = Date.now() - cancelRequestedAt
  await expect(page.getByRole("heading", { name: "Check your catalog" })).toBeVisible()
  await expect(page.getByRole("heading", { name: "Margin analysis" })).toHaveCount(0)
  await expect(page.getByTestId("analysis-progress")).toHaveCount(0)
  await expect(page.getByTestId("supplier-file-picker")).toContainText(
    "large-supplier.csv",
  )
  await expect(page.getByTestId("catalog-file-picker")).toContainText("large-catalog.csv")
  await expect(page.getByTestId("setup-readiness")).toHaveAttribute(
    "data-setup-state",
    "READY_FOR_ANALYSIS",
  )
  await expect(page.getByTestId("engine-readiness")).toHaveText(
    "Local analysis is ready.",
    { timeout: 60_000 },
  )
  expect(documentRequests).toBe(documentRequestsBeforeAnalysis)

  // The same files analyze to completion afterwards without being chosen again.
  await page.getByRole("button", { name: "Analyze Catalog" }).click()
  await expect(page.getByRole("heading", { name: "Margin analysis" })).toBeVisible({
    timeout: 120_000,
  })
  await expect(page.getByText("400,000 products analyzed locally")).toBeVisible()
  await expect(page.getByTestId("analysis-cancelled")).toHaveCount(0)
  expect(documentRequests).toBe(documentRequestsBeforeAnalysis)
  expect(browserErrors).toEqual([])
  console.info(`Cancel Analysis: rows=${ROW_COUNT}, cancelToSetupMs=${cancelMs}`)
})
