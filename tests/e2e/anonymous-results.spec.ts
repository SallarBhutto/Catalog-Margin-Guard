import { expect, test, type Page } from "@playwright/test"

const additionalIdentifiers = Array.from(
  { length: 22 },
  (_, index) => `REVIEW-${String(index).padStart(2, "0")}`,
)

const supplierCsv = [
  "sku,cost",
  "SECRET-SKU-001,96.43",
  "XYZ-88,44",
  "SECRET-SKU-002,151.37",
  ...additionalIdentifiers.map((identifier) => `${identifier},80`),
].join("\n")

const catalogCsv = [
  "sku,price,min_margin",
  "SECRET-SKU-001,105.79,10",
  "XYZ-88,69,30",
  "SECRET-SKU-002,149.26,",
  ...additionalIdentifiers.map((identifier) => `${identifier},100,25`),
].join("\n")

async function waitForInputCleanup(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(async () => {
        const modulePath = "/src/features/file-inspection/file-inspection-service.ts"
        const loaded: unknown = await import(/* @vite-ignore */ modulePath)
        const { fileInspectionService } = loaded as {
          fileInspectionService: {
            getRegisteredInput(role: "supplier" | "catalog"): unknown
          }
        }
        return [
          fileInspectionService.getRegisteredInput("supplier"),
          fileInspectionService.getRegisteredInput("catalog"),
        ]
      }),
    )
    .toEqual([null, null])
}

async function registeredInputNames(page: Page) {
  return page.evaluate(async () => {
    const modulePath = "/src/features/file-inspection/file-inspection-service.ts"
    const loaded: unknown = await import(/* @vite-ignore */ modulePath)
    const { fileInspectionService } = loaded as {
      fileInspectionService: {
        getRegisteredInput(role: "supplier" | "catalog"): { internalName: string } | null
      }
    }
    return [
      fileInspectionService.getRegisteredInput("supplier")?.internalName ?? null,
      fileInspectionService.getRegisteredInput("catalog")?.internalName ?? null,
    ]
  })
}

async function captureActiveAnalysisIdentity(page: Page) {
  return page.evaluate(async () => {
    const duckDBModulePath = "/src/lib/duckdb/index.ts"
    const analysisModulePath = "/src/features/analysis/index.ts"
    const duckDBModule: unknown = await import(/* @vite-ignore */ duckDBModulePath)
    const analysisModule: unknown = await import(/* @vite-ignore */ analysisModulePath)
    const { duckDBEngine } = duckDBModule as {
      duckDBEngine: { getSnapshot(): unknown }
    }
    const { marginAnalysisService, normalizedInputService } = analysisModule as {
      marginAnalysisService: { getLatestResult(): unknown }
      normalizedInputService: { getLatestResult(): unknown }
    }
    const activeAnalysisWindow = window as typeof window & {
      __activeAnalysisIdentity?: {
        document: Document
        duckDBEngine: unknown
        analysisResult: unknown
        normalizedInputs: unknown
        analysisHeading: Element | null
      }
    }
    activeAnalysisWindow.__activeAnalysisIdentity = {
      document,
      duckDBEngine,
      analysisResult: marginAnalysisService.getLatestResult(),
      normalizedInputs: normalizedInputService.getLatestResult(),
      analysisHeading: document.querySelector("#main-content h1"),
    }
    return duckDBEngine.getSnapshot()
  })
}

async function activeAnalysisIdentitySurvived(page: Page) {
  return page.evaluate(async () => {
    const duckDBModulePath = "/src/lib/duckdb/index.ts"
    const analysisModulePath = "/src/features/analysis/index.ts"
    const duckDBModule: unknown = await import(/* @vite-ignore */ duckDBModulePath)
    const analysisModule: unknown = await import(/* @vite-ignore */ analysisModulePath)
    const { duckDBEngine } = duckDBModule as { duckDBEngine: unknown }
    const { marginAnalysisService, normalizedInputService } = analysisModule as {
      marginAnalysisService: { getLatestResult(): unknown }
      normalizedInputService: { getLatestResult(): unknown }
    }
    const identity = (
      window as typeof window & {
        __activeAnalysisIdentity?: {
          document: Document
          duckDBEngine: unknown
          analysisResult: unknown
          normalizedInputs: unknown
          analysisHeading: Element | null
        }
      }
    ).__activeAnalysisIdentity

    return Boolean(
      identity &&
      identity.document === document &&
      identity.duckDBEngine === duckDBEngine &&
      identity.analysisResult === marginAnalysisService.getLatestResult() &&
      identity.normalizedInputs === normalizedInputService.getLatestResult() &&
      identity.analysisHeading === document.querySelector("#main-content h1"),
    )
  })
}

async function runAnonymousAnalysis(page: Page) {
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
  await expect(page.getByRole("heading", { name: "Margin analysis" })).toBeVisible({
    timeout: 30_000,
  })
}

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
  const consoleMessages: string[] = []
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
  page.on("console", (message) => {
    consoleMessages.push(message.text())
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
  const summary = page.getByRole("region", { name: "Analysis summary" })
  await expect(summary).toContainText("1Selling below costLOSS")
  await expect(summary).toContainText("23Need reviewREVIEW")
  await expect(summary).toContainText("1Meeting targetOK")
  await expect(summary).toContainText("Average gross margin")
  await expect(summary).toContainText("using store default")
  await expect(summary).toContainText("using product-specific target")
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

  await expect(
    page.getByText(
      "24 products need attention. Reveal the products with the highest margin risk.",
    ),
  ).toBeVisible()
  const lockedTable = page.getByRole("table", {
    name: "Detailed product results available after free sign-in",
  })
  await expect(lockedTable).toBeVisible()
  await expect(page.getByTestId("redacted-result-row")).toHaveCount(5)
  for (const header of [
    "SKU",
    "Supplier Cost",
    "Selling Price",
    "Gross Margin",
    "Target Margin",
    "Price for Target Margin",
    "Status",
  ]) {
    await expect(
      lockedTable.getByRole("columnheader", { name: header, exact: true }),
    ).toBeVisible()
  }
  await expect(page.getByText("Your detailed results are ready")).toBeVisible()
  await expect(
    page.getByText(/Your full catalog has already been analyzed locally/),
  ).toBeVisible()
  await expect(page.getByText("No payment or credit card required.")).toBeVisible()
  await expect(page.getByText("Files stay on your computer.")).toBeVisible()

  const anonymousDom = await page.locator("body").evaluate((body) => body.outerHTML)
  const anonymousAccessibility = await page.locator("body").ariaSnapshot()
  for (const privateValue of [
    "SECRET-SKU-001",
    "SECRET-SKU-002",
    "96.43",
    "105.79",
    "151.37",
    "149.26",
  ]) {
    expect(anonymousDom).not.toContain(privateValue)
    expect(anonymousAccessibility).not.toContain(privateValue)
  }
  await expect(lockedTable.locator("tbody")).toHaveText("")

  await page.getByText("Data quality", { exact: true }).click()
  await expect(page.getByText("Duplicate supplier identifiers")).toBeVisible()
  await expect(page.getByText("Invalid margin overrides")).toBeVisible()

  const analysisReadyCountBeforeAuth = consoleMessages.filter((message) =>
    message.includes("analysis ready"),
  ).length
  const analysisStartCountBeforeAuth = consoleMessages.filter((message) =>
    message.includes("analysis started"),
  ).length
  const matchingCountBeforeAuth = consoleMessages.filter((message) =>
    message.includes("matching complete"),
  ).length
  const normalizationStartCountBeforeAuth = consoleMessages.filter((message) =>
    message.includes("normalization started"),
  ).length
  const duckDBInitializationCountBeforeAuth = consoleMessages.filter((message) =>
    message.includes("DuckDB initializing"),
  ).length
  const registeredInputsBeforeAuth = await registeredInputNames(page)
  const engineSnapshotBeforeAuth = await captureActiveAnalysisIdentity(page)
  const activeUrl = page.url()
  const mainFrameNavigationsBeforeAuth = mainFrameNavigations
  const documentRequestsBeforeAuth = documentRequests

  await page.getByRole("button", { name: "Reveal My Results — Free" }).click()
  await expect(page.getByRole("heading", { name: "Sign in free" })).toBeVisible()
  await page.getByRole("button", { name: "Close" }).click()
  await expect(page.getByTestId("locked-results")).toBeVisible()
  await expect(page.getByText("25 products analyzed locally")).toBeVisible()
  expect(page.url()).toBe(activeUrl)
  expect(await activeAnalysisIdentitySurvived(page)).toBe(true)

  await page.getByRole("button", { name: "Reveal My Results — Free" }).click()
  await expect(page.getByRole("heading", { name: "Sign in free" })).toBeVisible()
  if (process.env.VISUAL_QA_DIR) {
    await page.screenshot({
      path: `${process.env.VISUAL_QA_DIR}/sign-in.png`,
      fullPage: true,
    })
  }
  await page.getByRole("button", { name: "Complete sign in" }).click()
  const fullTable = page.getByRole("table", { name: "Complete product results" })
  await expect(fullTable).toBeVisible({ timeout: 30_000 })
  await expect(fullTable).toContainText("SECRET-SKU-001")
  await expect(fullTable).toContainText("SECRET-SKU-002")
  await expect(
    page.getByRole("heading", { name: "Find products quietly eating your margin." }),
  ).not.toBeAttached()
  await expect(page.getByText("25 products analyzed locally")).toBeVisible()
  await expect(page.getByTestId("analysis-progress")).not.toBeVisible()
  expect(page.url()).toBe(activeUrl)
  expect(mainFrameNavigations).toBe(mainFrameNavigationsBeforeAuth)
  expect(documentRequests).toBe(documentRequestsBeforeAuth)
  expect(await activeAnalysisIdentitySurvived(page)).toBe(true)
  expect(await captureActiveAnalysisIdentity(page)).toEqual(engineSnapshotBeforeAuth)
  expect(
    consoleMessages.filter((message) => message.includes("analysis ready")),
  ).toHaveLength(analysisReadyCountBeforeAuth)
  expect(
    consoleMessages.filter((message) => message.includes("analysis started")),
  ).toHaveLength(analysisStartCountBeforeAuth)
  expect(
    consoleMessages.filter((message) => message.includes("matching complete")),
  ).toHaveLength(matchingCountBeforeAuth)
  expect(
    consoleMessages.filter((message) => message.includes("normalization started")),
  ).toHaveLength(normalizationStartCountBeforeAuth)
  expect(
    consoleMessages.filter((message) => message.includes("DuckDB initializing")),
  ).toHaveLength(duckDBInitializationCountBeforeAuth)
  expect(await registeredInputNames(page)).toEqual(registeredInputsBeforeAuth)

  expect(consoleErrors).toEqual([])
  const outboundText = outboundRequests.join("\n")
  for (const privateValue of [
    "private-prices.csv",
    "private-catalog.csv",
    "SECRET-SKU-001",
    "SECRET-SKU-002",
    "151.37",
    "CATALOG_OVERRIDE",
  ]) {
    expect(outboundText).not.toContain(privateValue)
  }
})

test("new-account authentication unlocks the same active analysis without navigation", async ({
  page,
}) => {
  const consoleMessages: string[] = []
  let mainFrameNavigations = 0
  let documentRequests = 0
  page.on("console", (message) => consoleMessages.push(message.text()))
  page.on("framenavigated", (frame) => {
    if (frame === page.mainFrame()) mainFrameNavigations += 1
  })
  page.on("request", (request) => {
    if (request.isNavigationRequest() && request.frame() === page.mainFrame()) {
      documentRequests += 1
    }
  })

  await runAnonymousAnalysis(page)
  const activeUrl = page.url()
  const registeredInputsBeforeAuth = await registeredInputNames(page)
  await captureActiveAnalysisIdentity(page)
  const analysisReadyCount = consoleMessages.filter((message) =>
    message.includes("analysis ready"),
  ).length
  const analysisStartCount = consoleMessages.filter((message) =>
    message.includes("analysis started"),
  ).length
  const matchingCount = consoleMessages.filter((message) =>
    message.includes("matching complete"),
  ).length
  const normalizationStartCount = consoleMessages.filter((message) =>
    message.includes("normalization started"),
  ).length
  const duckDBInitializationCount = consoleMessages.filter((message) =>
    message.includes("DuckDB initializing"),
  ).length
  const navigationCount = mainFrameNavigations
  const documentRequestCount = documentRequests

  await page.getByRole("button", { name: "Reveal My Results — Free" }).click()
  await page.getByRole("button", { name: "Create account" }).click()
  await expect(
    page.getByRole("heading", { name: "Create your free account" }),
  ).toBeVisible()
  await page.getByRole("button", { name: "Complete sign up" }).click()

  const fullTable = page.getByRole("table", { name: "Complete product results" })
  await expect(fullTable).toContainText("SECRET-SKU-001", { timeout: 30_000 })
  await expect(
    page.getByRole("heading", { name: "Find products quietly eating your margin." }),
  ).not.toBeAttached()
  expect(page.url()).toBe(activeUrl)
  expect(mainFrameNavigations).toBe(navigationCount)
  expect(documentRequests).toBe(documentRequestCount)
  expect(await activeAnalysisIdentitySurvived(page)).toBe(true)
  expect(await registeredInputNames(page)).toEqual(registeredInputsBeforeAuth)
  expect(
    consoleMessages.filter((message) => message.includes("analysis ready")),
  ).toHaveLength(analysisReadyCount)
  expect(
    consoleMessages.filter((message) => message.includes("analysis started")),
  ).toHaveLength(analysisStartCount)
  expect(
    consoleMessages.filter((message) => message.includes("matching complete")),
  ).toHaveLength(matchingCount)
  expect(
    consoleMessages.filter((message) => message.includes("normalization started")),
  ).toHaveLength(normalizationStartCount)
  expect(
    consoleMessages.filter((message) => message.includes("DuckDB initializing")),
  ).toHaveLength(duckDBInitializationCount)
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
      page.getByRole("button", { name: "Reveal My Results — Free" }),
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
    page.getByRole("button", { name: "Reveal My Results — Free" }),
  ).not.toBeVisible()
  await expect(page.getByTestId("locked-results")).not.toBeVisible()
  await expect(page.getByTestId("redacted-result-row")).toHaveCount(0)
  if (process.env.VISUAL_QA_DIR) {
    await page.screenshot({
      path: `${process.env.VISUAL_QA_DIR}/zero-risk.png`,
      fullPage: true,
    })
  }

  await page.getByRole("button", { name: "Start New Scan" }).click()
  await page.getByRole("button", { name: "Start New Scan", exact: true }).last().click()
  await expect(page.getByRole("heading", { name: "Check your catalog" })).toBeVisible()
  await waitForInputCleanup(page)
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
  await expect(page.getByTestId("locked-results")).not.toBeVisible()
  await expect(page.getByTestId("redacted-result-row")).toHaveCount(0)
  if (process.env.VISUAL_QA_DIR) {
    await page.screenshot({
      path: `${process.env.VISUAL_QA_DIR}/zero-analyzable.png`,
      fullPage: true,
    })
  }
})

test("refresh does not persist the active analysis", async ({ page }) => {
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

  await page.reload()
  await expect(page.getByRole("heading", { name: "Check your catalog" })).toBeVisible()
  await expect(page.getByRole("heading", { name: "Margin analysis" })).not.toBeVisible()
})
