import { expect, test, type Page } from "@playwright/test"

const PRODUCT_COUNT = 260
const identifiers = Array.from({ length: PRODUCT_COUNT }, (_, index) =>
  index === 0 ? "SKU%_SPECIAL" : `SKU-${String(index).padStart(5, "0")}`,
)

const supplierCsv = [
  "sku,cost",
  ...identifiers.map((identifier, index) => {
    const cost = index % 3 === 0 ? 100 : index % 3 === 1 ? 80 : 50
    return `${identifier},${cost}`
  }),
].join("\n")

const catalogCsv = [
  "sku,price,min_margin",
  ...identifiers.map((identifier, index) => {
    if (index % 3 === 0) return `${identifier},90,`
    if (index % 3 === 1) return `${identifier},100,25`
    return `${identifier},100,`
  }),
].join("\n")

async function runAnalysis(page: Page) {
  await page.goto("/check")
  await expect(page.getByTestId("engine-readiness")).toHaveText(
    "Local analysis is ready.",
    { timeout: 30_000 },
  )
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
}

async function chooseSelectOption(page: Page, name: string, option: string) {
  await page.getByRole("combobox", { name }).click()
  await page.getByRole("option", { name: option, exact: true }).click()
  await expect(page.getByRole("listbox")).toBeHidden()
}

test("authenticated users browse the complete local result relation", async ({
  page,
}) => {
  const outboundRequests: string[] = []
  let mainFrameNavigations = 0
  let documentRequests = 0
  page.on("request", (request) => {
    outboundRequests.push(`${request.url()}\n${request.postData() ?? ""}`)
    if (request.isNavigationRequest() && request.frame() === page.mainFrame()) {
      documentRequests += 1
    }
  })
  page.on("framenavigated", (frame) => {
    if (frame === page.mainFrame()) mainFrameNavigations += 1
  })

  await runAnalysis(page)
  const activeUrl = page.url()
  const navigationsBeforeAuth = mainFrameNavigations
  const documentRequestsBeforeAuth = documentRequests
  await page.evaluate(async () => {
    const duckDBModulePath = "/src/lib/duckdb/index.ts"
    const analysisModulePath = "/src/features/analysis/index.ts"
    const duckDBModule: unknown = await import(/* @vite-ignore */ duckDBModulePath)
    const analysisModule: unknown = await import(/* @vite-ignore */ analysisModulePath)
    const { duckDBEngine } = duckDBModule as { duckDBEngine: unknown }
    const { marginAnalysisService } = analysisModule as {
      marginAnalysisService: { getLatestResult(): unknown }
    }
    ;(window as typeof window & { __activeAnalysis?: unknown }).__activeAnalysis = {
      document,
      duckDBEngine,
      analysisResult: marginAnalysisService.getLatestResult(),
    }
  })
  const activeAnalysisSurvived = () =>
    page.evaluate(async () => {
      const duckDBModulePath = "/src/lib/duckdb/index.ts"
      const analysisModulePath = "/src/features/analysis/index.ts"
      const inspectionModulePath =
        "/src/features/file-inspection/file-inspection-service.ts"
      const duckDBModule: unknown = await import(/* @vite-ignore */ duckDBModulePath)
      const analysisModule: unknown = await import(/* @vite-ignore */ analysisModulePath)
      const inspectionModule: unknown = await import(
        /* @vite-ignore */ inspectionModulePath
      )
      const { duckDBEngine } = duckDBModule as { duckDBEngine: unknown }
      const { marginAnalysisService } = analysisModule as {
        marginAnalysisService: {
          getLatestResult(): { status: string } | null
          getSnapshot(): { state: string }
        }
      }
      const { fileInspectionService } = inspectionModule as {
        fileInspectionService: {
          getRegisteredInput(
            role: "supplier" | "catalog",
          ): { internalName: string } | null
        }
      }
      const active = (
        window as typeof window & {
          __activeAnalysis?: {
            document: Document
            duckDBEngine: unknown
            analysisResult: unknown
          }
        }
      ).__activeAnalysis
      const latest = marginAnalysisService.getLatestResult()
      return Boolean(
        active &&
        active.document === document &&
        active.duckDBEngine === duckDBEngine &&
        active.analysisResult === latest &&
        latest?.status === "READY" &&
        marginAnalysisService.getSnapshot().state === "ready" &&
        fileInspectionService.getRegisteredInput("supplier")?.internalName ===
          "supplier-input.csv" &&
        fileInspectionService.getRegisteredInput("catalog")?.internalName ===
          "catalog-input.csv",
      )
    })
  await expect(page.getByText("260 products analyzed locally")).toBeVisible()
  await expect(
    page.getByRole("table", {
      name: "Detailed product results available after free sign-in",
    }),
  ).toBeVisible()
  await expect(page.getByTestId("redacted-result-row")).toHaveCount(5)

  await page.getByRole("button", { name: "Reveal My Results — Free" }).click()
  await expect(page.getByRole("heading", { name: "Sign in free" })).toBeVisible()
  await page.getByRole("button", { name: "Complete sign in" }).click()

  const table = page.getByRole("table", { name: "Complete product results" })
  const rows = table.getByRole("row")
  await expect(table).toBeVisible({ timeout: 30_000 })
  expect(page.url()).toBe(activeUrl)
  expect(mainFrameNavigations).toBe(navigationsBeforeAuth)
  expect(documentRequests).toBe(documentRequestsBeforeAuth)
  expect(await activeAnalysisSurvived()).toBe(true)
  await expect(rows).toHaveCount(101)
  await expect(page.getByText("Showing 1–100 of 260")).toBeVisible()
  await expect(
    page.getByRole("searchbox", { name: "Search product identifier" }),
  ).toBeVisible()
  await expect(page.getByRole("combobox", { name: "Target source" })).toBeVisible()
  await expect(page.getByRole("combobox", { name: "Sort results" })).toBeVisible()
  await expect(page.getByRole("combobox", { name: "Rows per page" })).toBeVisible()
  await expect(page.getByTestId("analysis-progress")).not.toBeVisible()

  if (process.env.VISUAL_QA_DIR) {
    for (const viewport of [
      { width: 1440, height: 1000 },
      { width: 1024, height: 900 },
      { width: 768, height: 900 },
      { width: 390, height: 844 },
    ]) {
      await page.setViewportSize(viewport)
      await page.getByRole("heading", { name: "Products" }).scrollIntoViewIfNeeded()
      await page.screenshot({
        path: `${process.env.VISUAL_QA_DIR}/authenticated-results-${viewport.width}.png`,
      })
      expect(
        await page.evaluate(
          () =>
            document.documentElement.scrollWidth > document.documentElement.clientWidth,
        ),
      ).toBe(false)
    }
    await page.setViewportSize({ width: 390, height: 844 })
    await table.scrollIntoViewIfNeeded()
    await page.screenshot({
      path: `${process.env.VISUAL_QA_DIR}/authenticated-results-390-table.png`,
    })
    await page.setViewportSize({ width: 1280, height: 900 })
  }

  const search = page.getByRole("searchbox", { name: "Search product identifier" })
  await search.fill("SKU-00259")
  await expect(page.getByText("Showing 1–1 of 1")).toBeVisible({ timeout: 10_000 })
  await expect(table).toContainText("SKU-00259")
  await page.getByRole("button", { name: "Clear identifier search" }).click()
  await expect(page.getByText("Showing 1–100 of 260")).toBeVisible({ timeout: 10_000 })
  await search.fill("%_")
  await expect(page.getByText("Showing 1–1 of 1")).toBeVisible({ timeout: 10_000 })
  await expect(table).toContainText("SKU%_SPECIAL")
  await page.getByRole("button", { name: "Clear identifier search" }).click()
  await expect(page.getByText("Showing 1–100 of 260")).toBeVisible({ timeout: 10_000 })

  for (const [label, count] of [
    ["Loss", 87],
    ["Needs Review", 87],
    ["Meeting Target", 86],
  ] as const) {
    await page.getByRole("button", { name: label, exact: true }).click()
    await expect(page.getByText(`Showing 1–${count} of ${count}`)).toBeVisible()
  }
  await page.getByRole("button", { name: "All", exact: true }).click()

  await chooseSelectOption(page, "Target source", "Product Override")
  await expect(page.getByText("Showing 1–87 of 87")).toBeVisible()
  await expect(table.getByText("Product Override").first()).toBeVisible()
  await chooseSelectOption(page, "Target source", "All")
  await expect(page.getByText("Showing 1–100 of 260")).toBeVisible()

  for (const sort of [
    "Margin: Lowest first",
    "Margin: Highest first",
    "Identifier: A–Z",
    "Identifier: Z–A",
    "Supplier Cost: Low–High",
    "Supplier Cost: High–Low",
    "Selling Price: Low–High",
    "Selling Price: High–Low",
    "Target Margin: Low–High",
    "Target Margin: High–Low",
    "Price for Target: Low–High",
    "Price for Target: High–Low",
    "Risk: Highest first",
  ]) {
    await chooseSelectOption(page, "Sort results", sort)
    await expect(page.getByRole("combobox", { name: "Sort results" })).toContainText(sort)
    await expect(table).toBeVisible()
  }

  await chooseSelectOption(page, "Rows per page", "50")
  await expect(page.getByText("Showing 1–50 of 260")).toBeVisible()
  await page.getByRole("button", { name: "Next" }).click()
  await expect(page.getByText("Showing 51–100 of 260")).toBeVisible()
  await page.getByRole("button", { name: "Previous" }).click()
  await expect(page.getByText("Showing 1–50 of 260")).toBeVisible()

  for (let pageIndex = 0; pageIndex < 5; pageIndex += 1) {
    await page.getByRole("button", { name: "Next" }).click()
  }
  await expect(page.getByText("Showing 251–260 of 260")).toBeVisible()
  await expect(page.getByRole("button", { name: "Next" })).toBeDisabled()

  await search.fill("NO-SUCH-SKU")
  await expect(page.getByText("No products match these filters.")).toBeVisible()
  await page.getByRole("button", { name: "Clear filters" }).click()
  await expect(page.getByText("Showing 1–50 of 260")).toBeVisible()

  await page.getByRole("button", { name: "Sign out" }).click()
  await expect(
    page.getByRole("table", { name: "Complete product results" }),
  ).not.toBeVisible()
  await expect(page.getByRole("searchbox")).not.toBeVisible()
  await expect(
    page.getByRole("table", {
      name: "Detailed product results available after free sign-in",
    }),
  ).toBeVisible()
  await expect(page.getByTestId("redacted-result-row")).toHaveCount(5)
  const signedOutDom = await page.locator("body").evaluate((body) => body.outerHTML)
  const signedOutAccessibility = await page.locator("body").ariaSnapshot()
  for (const privateValue of ["SKU-00259", "SKU%_SPECIAL", "$100.00", "50.00%"]) {
    expect(signedOutDom).not.toContain(privateValue)
    expect(signedOutAccessibility).not.toContain(privateValue)
  }
  await expect(page.getByText("260 products analyzed locally")).toBeVisible()
  await expect(page.getByTestId("analysis-progress")).not.toBeVisible()
  expect(page.url()).toBe(activeUrl)
  expect(mainFrameNavigations).toBe(navigationsBeforeAuth)
  expect(documentRequests).toBe(documentRequestsBeforeAuth)
  expect(await activeAnalysisSurvived()).toBe(true)
  await expect(
    page.getByRole("button", { name: "Reveal My Results — Free" }),
  ).toBeVisible()

  // The preserved analysis unlocks again without any reprocessing.
  await page.getByRole("button", { name: "Reveal My Results — Free" }).click()
  await page.getByRole("button", { name: "Complete sign in" }).click()
  await expect(table).toBeVisible({ timeout: 30_000 })
  await expect(page.getByText("Showing 1–100 of 260")).toBeVisible()
  expect(page.url()).toBe(activeUrl)
  expect(documentRequests).toBe(documentRequestsBeforeAuth)
  expect(await activeAnalysisSurvived()).toBe(true)

  const outboundText = outboundRequests.join("\n")
  for (const privateValue of ["SKU-00259", "SKU%_SPECIAL", "NO-SUCH-SKU", "100.0000"]) {
    expect(outboundText).not.toContain(privateValue)
  }
})
