import { expect, test } from "@playwright/test"

const additionalIdentifiers = Array.from(
  { length: 22 },
  (_, index) => `REVIEW-${String(index).padStart(2, "0")}`,
)

const supplierCsv = [
  "sku,cost",
  "ABC-12,96",
  "XYZ-88,44",
  "KLP-91,151",
  ...additionalIdentifiers.map((identifier) => `${identifier},80`),
].join("\n")

const catalogCsv = [
  "sku,price,min_margin",
  "ABC-12,105,10",
  "XYZ-88,69,30",
  "KLP-91,149,",
  ...additionalIdentifiers.map((identifier) => `${identifier},100,25`),
].join("\n")

test.beforeEach(async ({ page }) => {
  await page.goto("/check")
  await expect(page.getByTestId("engine-readiness")).toHaveText(
    "Local analysis is ready.",
    { timeout: 30_000 },
  )
})

test("runs the complete anonymous analysis and preserves it through the sign-in gate", async ({
  page,
}) => {
  const outboundRequests: string[] = []
  const consoleErrors: string[] = []
  page.on("request", (request) => {
    outboundRequests.push(`${request.url()}\n${request.postData() ?? ""}`)
  })
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text())
  })

  await page.locator("#supplier-file-input").setInputFiles({
    name: "private-prices.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(supplierCsv),
  })
  await page.locator("#catalog-file-input").setInputFiles({
    name: "private-catalog.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(catalogCsv),
  })
  await expect(page.getByTestId("setup-readiness")).toHaveAttribute(
    "data-setup-state",
    "READY_FOR_ANALYSIS",
    { timeout: 30_000 },
  )

  await page.getByRole("button", { name: "Analyze Catalog" }).click()
  if (process.env.VISUAL_QA_DIR) {
    await page.getByTestId("analysis-progress").screenshot({
      path: `${process.env.VISUAL_QA_DIR}/processing.png`,
    })
  }
  await expect(page.getByRole("heading", { name: "Margin analysis" })).toBeVisible({
    timeout: 30_000,
  })

  await expect(page.getByText("25 products analyzed locally")).toBeVisible()
  await expect(page.getByText("Margin exposure")).toBeVisible()
  for (const bucket of [
    "Below 0%",
    "0–5%",
    "5–10%",
    "10–15%",
    "15–20%",
    "20–30%",
    "30%+",
  ]) {
    await expect(page.getByText(bucket, { exact: true })).toBeVisible()
  }

  const tableRows = page
    .getByRole("table", { name: "Highest risk products" })
    .getByRole("row")
  await expect(tableRows).toHaveCount(21)
  await expect(tableRows.nth(1)).toContainText("KLP-91")
  await expect(tableRows.nth(2)).toContainText("ABC-12")
  await expect(
    page.getByText("Showing 20 of 24 products needing attention."),
  ).toBeVisible()
  await expect(page.getByText("4 more products are hidden.")).toBeVisible()

  await page.getByText("Data quality", { exact: true }).click()
  await expect(page.getByText("Duplicate supplier identifiers")).toBeVisible()
  await expect(page.getByText("Invalid margin overrides")).toBeVisible()

  await page.getByRole("button", { name: "See All Results — Free" }).click()
  await expect(page.getByRole("heading", { name: "Sign in free" })).toBeVisible()
  if (process.env.VISUAL_QA_DIR) {
    await page.screenshot({
      path: `${process.env.VISUAL_QA_DIR}/sign-in.png`,
      fullPage: true,
    })
  }
  await page.getByRole("button", { name: "Close" }).click()
  await expect(page.getByRole("heading", { name: "Margin analysis" })).toBeVisible()
  await expect(tableRows).toHaveCount(21)

  expect(consoleErrors).toEqual([])
  const outboundText = outboundRequests.join("\n")
  for (const privateValue of [
    "private-prices.csv",
    "private-catalog.csv",
    "ABC-12",
    "KLP-91",
    "151.0000",
    "CATALOG_OVERRIDE",
  ]) {
    expect(outboundText).not.toContain(privateValue)
  }
})

test("Start New Scan clears the local customer analysis and returns to setup", async ({
  page,
}) => {
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

  await page.getByRole("button", { name: "Start New Scan" }).click()
  await expect(page.getByRole("heading", { name: "Start a new scan?" })).toBeVisible()
  await page.getByRole("button", { name: "Start New Scan", exact: true }).last().click()

  await expect(page.getByRole("heading", { name: "Check your catalog" })).toBeVisible()
  await expect(
    page
      .getByTestId("supplier-file-picker")
      .getByRole("button", { name: "Choose Supplier File" }),
  ).toBeVisible()
  await expect(
    page
      .getByTestId("catalog-file-picker")
      .getByRole("button", { name: "Choose Catalog File" }),
  ).toBeVisible()
  await expect(page.getByRole("heading", { name: "Margin analysis" })).not.toBeVisible()
})

test("results remain usable without page-level overflow at required widths", async ({
  page,
}) => {
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

  for (const viewport of [
    { width: 1440, height: 1000 },
    { width: 1024, height: 900 },
    { width: 768, height: 900 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport)
    await expect(page.getByRole("heading", { name: "Margin analysis" })).toBeVisible()
    await expect(page.getByText("Margin exposure")).toBeVisible()
    await expect(
      page.getByRole("button", { name: "See All Results — Free" }),
    ).toBeVisible()
    if (process.env.VISUAL_QA_DIR) {
      await page.screenshot({
        path: `${process.env.VISUAL_QA_DIR}/results-${viewport.width}.png`,
        fullPage: true,
      })
    }
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
      ),
    ).toBe(false)
  }
})

test("renders deliberate zero-risk and zero-analyzable result experiences", async ({
  page,
}) => {
  await page.locator("#supplier-file-input").setInputFiles({
    name: "healthy-supplier.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("sku,cost\nHEALTHY-1,10"),
  })
  await page.locator("#catalog-file-input").setInputFiles({
    name: "healthy-catalog.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("sku,price\nHEALTHY-1,20"),
  })
  await expect(page.getByTestId("setup-readiness")).toHaveAttribute(
    "data-setup-state",
    "READY_FOR_ANALYSIS",
    { timeout: 30_000 },
  )
  await page.getByRole("button", { name: "Analyze Catalog" }).click()
  await expect(page.getByText("No products currently need margin review.")).toBeVisible({
    timeout: 30_000,
  })
  await expect(page.getByText("Margin exposure")).toBeVisible()
  await expect(
    page.getByRole("button", { name: "See All Results — Free" }),
  ).not.toBeVisible()
  if (process.env.VISUAL_QA_DIR) {
    await page.screenshot({
      path: `${process.env.VISUAL_QA_DIR}/zero-risk.png`,
      fullPage: true,
    })
  }

  await page.getByRole("button", { name: "Start New Scan" }).click()
  await page.getByRole("button", { name: "Start New Scan", exact: true }).last().click()
  await page.locator("#supplier-file-input").setInputFiles({
    name: "invalid-supplier.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("sku,cost\nINVALID-1,bad"),
  })
  await page.locator("#catalog-file-input").setInputFiles({
    name: "invalid-catalog.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("sku,price\nINVALID-1,0"),
  })
  await expect(page.getByTestId("setup-readiness")).toHaveAttribute(
    "data-setup-state",
    "READY_FOR_ANALYSIS",
    { timeout: 30_000 },
  )
  await page.getByRole("button", { name: "Analyze Catalog" }).click()
  await expect(
    page.getByText("We couldn't calculate margins for any matched products."),
  ).toBeVisible({ timeout: 30_000 })
  await expect(page.getByText("Invalid supplier costs", { exact: true })).toBeVisible()
  await expect(page.getByText("Invalid selling prices", { exact: true })).toBeVisible()
  await expect(page.getByText("Margin exposure")).not.toBeVisible()
  if (process.env.VISUAL_QA_DIR) {
    await page.screenshot({
      path: `${process.env.VISUAL_QA_DIR}/zero-analyzable.png`,
      fullPage: true,
    })
  }
})
