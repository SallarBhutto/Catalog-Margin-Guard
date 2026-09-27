import { readFile } from "node:fs/promises"

import { expect, test, type Download, type Locator, type Page } from "@playwright/test"

import type { ReportExportService } from "../../src/features/exports/report-export-service"
import type { ManualOverrideService } from "../../src/features/results/manual-override-service"

const REPORT_HEADER = [
  "identifier",
  "supplier_cost",
  "selling_price",
  "gross_margin_percent",
  "target_margin_percent",
  "target_source",
  "price_for_target_margin",
  "status",
]
const DECIMAL = /^-?\d+(?:\.\d+)?$/
const STATUS_RANK: Readonly<Record<string, number>> = { LOSS: 0, REVIEW: 1, OK: 2 }
const UNICODE_SKU = `${String.fromCodePoint(0xdc)}BER-${String.fromCodePoint(0x65e5, 0x672c)}`
const FILLER_COUNT = 150

/** [identifier as written in the source CSV, supplier cost, selling price, min_margin] */
const SPECIAL_PRODUCTS: readonly (readonly [string, string, string, string])[] = [
  ["00123", "96.4375", "105.79", "10"],
  ["KLP-91", "151", "149", ""],
  ["=SUM(A1:A9)", "80", "100", ""],
  ['"  =2+5"', "90", "100", ""],
  ["-5", "10", "20", ""],
  ["+100", "95", "100", ""],
  ["@cmd", "50", "100", ""],
  ['"COMMA,SKU"', "50", "100", ""],
  ['"QUOTE""SKU"', "99", "100", ""],
  [UNICODE_SKU, "50", "100", ""],
]
const fillers = Array.from(
  { length: FILLER_COUNT },
  (_, index) => `FILL-${String(index + 1).padStart(4, "0")}`,
)
const supplierCsv = [
  "sku,cost",
  ...SPECIAL_PRODUCTS.map(([identifier, cost]) => `${identifier},${cost}`),
  ...fillers.map((identifier) => `${identifier},50`),
].join("\n")
const catalogCsv = [
  "sku,price,min_margin",
  ...SPECIAL_PRODUCTS.map(
    ([identifier, , price, margin]) => `${identifier},${price},${margin}`,
  ),
  ...fillers.map((identifier) => `${identifier},100,`),
].join("\n")
const TOTAL_PRODUCTS = SPECIAL_PRODUCTS.length + FILLER_COUNT

/** Minimal RFC 4180 parser so assertions run against the real file content. */
function parseCsv(text: string) {
  const rows: string[][] = []
  let row: string[] = []
  let field = ""
  let inQuotes = false

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index]
    if (inQuotes) {
      if (character === '"' && text[index + 1] === '"') {
        field += '"'
        index += 1
      } else if (character === '"') inQuotes = false
      else field += character
    } else if (character === '"') inQuotes = true
    else if (character === ",") {
      row.push(field)
      field = ""
    } else if (character === "\r" && text[index + 1] === "\n") {
      row.push(field)
      rows.push(row)
      row = []
      field = ""
      index += 1
    } else field += character
  }

  expect(inQuotes).toBe(false)
  expect(field).toBe("")
  expect(row).toEqual([])
  return rows
}

type ReportRecord = Readonly<{
  identifier: string
  cost: string
  price: string
  margin: string
  target: string
  source: string
  priceForTarget: string
  status: string
}>

/**
 * Reads the downloaded file. Row-level checks use plain comparisons and one final
 * assertion: a Playwright `expect` per row is far too slow for 100k-row reports.
 */
async function readReport(download: Download) {
  const path = await download.path()
  const bytes = await readFile(path)
  expect([...bytes.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf])
  const text = bytes.subarray(3).toString("utf8")
  expect(text.endsWith("\r\n")).toBe(true)
  const [header, ...rows] = parseCsv(text)
  expect(header).toEqual(REPORT_HEADER)
  expect(rows.filter((fields) => fields.length !== REPORT_HEADER.length)).toEqual([])
  const records = rows.map((fields): ReportRecord => {
    const [identifier, cost, price, margin, target, source, priceForTarget, status] =
      fields as [string, string, string, string, string, string, string, string]
    return { identifier, cost, price, margin, target, source, priceForTarget, status }
  })
  return { bytes: bytes.length, text, records }
}

/** Exact fixed-point value (scale 10,000) of a plain decimal string. */
function toScaledInteger(value: string) {
  const [whole = "0", fraction = ""] = value.replace("-", "").split(".")
  const magnitude = BigInt(`${whole}${fraction.padEnd(4, "0").slice(0, 4)}`)
  return value.startsWith("-") ? -magnitude : magnitude
}

/**
 * The exported price must reach the exported target with the exported cost, and one cent
 * less must not: export formatting may never turn the upward-rounded price into one that
 * falls below the target.
 */
function findPriceForTargetProblems(records: readonly ReportRecord[]) {
  const meetsTarget = (price: bigint, cost: bigint, target: bigint) =>
    (price - cost) * 1_000_000n >= target * price

  return records.flatMap((record, index) => {
    const cost = toScaledInteger(record.cost)
    const target = toScaledInteger(record.target)
    const price = toScaledInteger(record.priceForTarget)
    const twoDecimals = /^\d+\.\d{2}$/.test(record.priceForTarget)
    return twoDecimals &&
      meetsTarget(price, cost, target) &&
      !meetsTarget(price - 100n, cost, target)
      ? []
      : [`row ${index}: ${record.identifier}`]
  })
}

const TARGET_SOURCE_LABELS = ["Store Default", "Product Override", "Manual Override"]

/** Numeric columns stay numeric, labels are known, and rows follow the risk order. */
function expectReportInvariants(records: readonly ReportRecord[]) {
  const problems: string[] = []

  for (const [index, record] of records.entries()) {
    const numeric = [
      record.cost,
      record.price,
      record.margin,
      record.target,
      record.priceForTarget,
    ]
    if (!numeric.every((value) => DECIMAL.test(value))) {
      problems.push(`row ${index}: non-numeric value`)
    }
    if (!TARGET_SOURCE_LABELS.includes(record.source)) {
      problems.push(`row ${index}: unknown target source`)
    }
    const rank = STATUS_RANK[record.status]
    if (rank === undefined) problems.push(`row ${index}: unknown status`)

    const previous = records[index - 1]
    if (!previous || rank === undefined) continue
    const previousRank = STATUS_RANK[previous.status] ?? -1
    if (rank < previousRank) problems.push(`row ${index}: status out of order`)
    if (rank === previousRank && Number(record.margin) < Number(previous.margin)) {
      problems.push(`row ${index}: margin out of order`)
    }
  }

  expect(problems.slice(0, 10)).toEqual([])
  expect(findPriceForTargetProblems(records).slice(0, 10)).toEqual([])
}

async function analyze(page: Page, supplier: string, catalog: string) {
  await page.goto("/check")
  await expect(page.getByTestId("engine-readiness")).toHaveText(
    "Local analysis is ready.",
    { timeout: 30_000 },
  )
  await page.locator("#supplier-file-input").setInputFiles({
    name: "private-supplier.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(supplier),
  })
  await page.locator("#catalog-file-input").setInputFiles({
    name: "private-catalog.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(catalog),
  })
  await expect(page.getByTestId("setup-readiness")).toHaveAttribute(
    "data-setup-state",
    "READY_FOR_ANALYSIS",
    { timeout: 60_000 },
  )
  await page.getByRole("button", { name: "Analyze Catalog" }).click()
  await expect(page.getByRole("heading", { name: "Margin analysis" })).toBeVisible({
    timeout: 60_000,
  })
}

async function signIn(page: Page) {
  await page.getByRole("button", { name: "Sign in", exact: true }).click()
  await page.getByRole("button", { name: "Complete sign in" }).click()
  await expect(page.getByRole("table", { name: "Complete product results" })).toBeVisible(
    { timeout: 30_000 },
  )
}

async function download(page: Page, report: "Products To Review" | "Full Margin Report") {
  const started = page.waitForEvent("download")
  await page.getByRole("button", { name: report }).click()
  return started
}

async function findProduct(page: Page, identifier: string) {
  await page
    .getByRole("searchbox", { name: "Search product identifier" })
    .fill(identifier)
  const row = page
    .getByRole("table", { name: "Complete product results" })
    .getByRole("row")
    .filter({ hasText: identifier })
  await expect(row).toBeVisible()
  return row
}

async function setManualTarget(
  page: Page,
  row: Locator,
  identifier: string,
  value: string,
) {
  await row.getByRole("button", { name: new RegExp(`target for ${identifier}$`) }).click()
  const dialog = page.getByRole("dialog", { name: "Set product target" })
  await dialog.getByLabel("Manual override").fill(value)
  await dialog.getByRole("button", { name: "Save Override" }).click()
  await expect(dialog).not.toBeVisible()
}

test("anonymous users cannot export; signed-in users download the complete local report", async ({
  page,
}) => {
  const outboundRequests: string[] = []
  const browserErrors: string[] = []
  page.on("request", (request) =>
    outboundRequests.push(`${request.url()}\n${request.postData() ?? ""}`),
  )
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(message.text())
  })

  await analyze(page, supplierCsv, catalogCsv)
  await expect(
    page.getByText(`${TOTAL_PRODUCTS} products analyzed locally`),
  ).toBeVisible()
  await expect(page.getByTestId("export-reports")).toHaveCount(0)
  await expect(
    page.getByRole("button", { name: /Products To Review|Full Margin Report/ }),
  ).toHaveCount(0)

  await signIn(page)
  await expect(page.getByText(`Showing 1–100 of ${TOTAL_PRODUCTS}`)).toBeVisible()

  // Narrow the visible table; named reports must ignore search, filters, and pagination.
  await page.getByRole("button", { name: "Meeting Target", exact: true }).click()
  await page.getByRole("searchbox", { name: "Search product identifier" }).fill("FILL-00")
  await expect(page.getByText("Showing 1–99 of 99")).toBeVisible({ timeout: 10_000 })

  const fullReport = await download(page, "Full Margin Report")
  expect(fullReport.suggestedFilename()).toMatch(
    /^catalog-margin-report-\d{4}-\d{2}-\d{2}\.csv$/,
  )
  await expect(page.getByTestId("export-notice")).toContainText(
    `with ${TOTAL_PRODUCTS} products.`,
  )

  const full = await readReport(fullReport)
  expect(full.records).toHaveLength(TOTAL_PRODUCTS)
  expectReportInvariants(full.records)
  const byIdentifier = new Map(full.records.map((record) => [record.identifier, record]))
  expect(byIdentifier.size).toBe(TOTAL_PRODUCTS)
  for (const identifier of fillers) expect(byIdentifier.has(identifier)).toBe(true)

  expect(full.records[0]).toEqual({
    identifier: "KLP-91",
    cost: "151.00",
    price: "149.00",
    margin: "-1.3423",
    target: "20.00",
    source: "Store Default",
    priceForTarget: "188.75",
    status: "LOSS",
  })
  // Leading zeros and four-decimal source precision survive in the file itself.
  expect(byIdentifier.get("00123")).toEqual({
    identifier: "00123",
    cost: "96.4375",
    price: "105.79",
    margin: "8.8406",
    target: "10.00",
    source: "Product Override",
    priceForTarget: "107.16",
    status: "REVIEW",
  })
  expect(full.text).toContain("\r\n00123,96.4375,105.79,")
  expect(byIdentifier.get(UNICODE_SKU)?.status).toBe("OK")
  expect(byIdentifier.get("COMMA,SKU")?.status).toBe("OK")
  expect(byIdentifier.get('QUOTE"SKU')?.status).toBe("REVIEW")
  expect(full.text).toContain('"COMMA,SKU",')
  expect(full.text).toContain('"QUOTE""SKU",')

  // Formula-like identifiers gain a leading apostrophe; numeric columns never do.
  for (const neutralized of ["'=SUM(A1:A9)", "'-5", "'+100", "'@cmd"]) {
    expect(byIdentifier.has(neutralized)).toBe(true)
    expect(full.text).toContain(`"${neutralized}",`)
  }
  const hiddenFormula = full.records.find((record) => record.identifier.includes("=2+5"))
  expect(hiddenFormula?.identifier).toMatch(/^'\s*=2\+5$/)
  expect(full.records.some((record) => /^[=+\-@\s]/.test(record.identifier))).toBe(false)
  expect(full.records.filter((record) => record.status === "LOSS")).toHaveLength(1)
  expect(full.records.filter((record) => record.status === "REVIEW")).toHaveLength(4)

  const reviewReport = await download(page, "Products To Review")
  expect(reviewReport.suggestedFilename()).toMatch(
    /^products-to-review-\d{4}-\d{2}-\d{2}\.csv$/,
  )
  const review = await readReport(reviewReport)
  expectReportInvariants(review.records)
  expect(review.records).toEqual(full.records.filter((record) => record.status !== "OK"))
  expect(review.records).toHaveLength(5)

  // The visible table is still the filtered page; exporting did not change it.
  await expect(page.getByText("Showing 1–99 of 99")).toBeVisible()
  expect(browserErrors).toEqual([])
  const outboundText = outboundRequests.join("\n")
  for (const privateValue of ["KLP-91", "00123", "FILL-0001", "96.4375", "SUM(A1"]) {
    expect(outboundText).not.toContain(privateValue)
  }
})

test("reports use current effective targets after manual overrides", async ({ page }) => {
  await analyze(page, supplierCsv, catalogCsv)
  await signIn(page)

  // OK → REVIEW with a higher manual target; REVIEW → OK with a lower one.
  await setManualTarget(page, await findProduct(page, "FILL-0001"), "FILL-0001", "60")
  await setManualTarget(page, await findProduct(page, "00123"), "00123", "5")
  await expect(page.getByText("2 using product-specific target")).toBeVisible()

  const review = await readReport(await download(page, "Products To Review"))
  expectReportInvariants(review.records)
  expect(review.records.map((record) => record.identifier)).not.toContain("00123")
  expect(review.records.find((record) => record.identifier === "FILL-0001")).toEqual({
    identifier: "FILL-0001",
    cost: "50.00",
    price: "100.00",
    margin: "50.00",
    target: "60.00",
    source: "Manual Override",
    priceForTarget: "125.00",
    status: "REVIEW",
  })
  expect(review.records).toHaveLength(5)

  const full = await readReport(await download(page, "Full Margin Report"))
  expect(full.records).toHaveLength(TOTAL_PRODUCTS)
  expect(full.records.find((record) => record.identifier === "00123")).toMatchObject({
    target: "5.00",
    source: "Manual Override",
    priceForTarget: "101.52",
    status: "OK",
  })

  // Removing the manual target restores the catalog override in the next report.
  const row = await findProduct(page, "00123")
  await row.getByRole("button", { name: /target for 00123$/ }).click()
  const dialog = page.getByRole("dialog", { name: "Set product target" })
  await dialog.getByRole("button", { name: "Remove Manual Override" }).click()
  await expect(dialog).not.toBeVisible()
  const restored = await readReport(await download(page, "Products To Review"))
  expect(restored.records.find((record) => record.identifier === "00123")).toMatchObject({
    target: "10.00",
    source: "Product Override",
    status: "REVIEW",
  })
})

test("a report waits for pending target changes and is invalidated by sign-out", async ({
  page,
}) => {
  await analyze(page, supplierCsv, catalogCsv)
  await signIn(page)

  let downloads = 0
  page.on("download", () => {
    downloads += 1
  })

  // Hold the manual-target queue the way an in-flight recomputation would.
  await page.evaluate(async () => {
    const modulePath = "/src/features/results/manual-override-service.ts"
    const loaded: unknown = await import(/* @vite-ignore */ modulePath)
    const { manualOverrideService } = loaded as {
      manualOverrideService: ManualOverrideService
    }
    const scope = window as Window & { releaseQueue?: () => void }
    void manualOverrideService.runExclusive(
      () =>
        new Promise<void>((resolve) => {
          scope.releaseQueue = resolve
        }),
    )
  })

  await page.getByRole("button", { name: "Full Margin Report" }).click()
  await expect(page.getByTestId("export-progress")).toContainText(
    `Preparing Full Margin Report… 0 of ${TOTAL_PRODUCTS} products`,
  )
  await expect(page.getByRole("button", { name: "Products To Review" })).toBeDisabled()
  expect(downloads).toBe(0)

  await page.getByRole("button", { name: "Sign out" }).click()
  await expect(page.getByTestId("export-reports")).toHaveCount(0)
  await page.evaluate(() =>
    (window as Window & { releaseQueue?: () => void }).releaseQueue?.(),
  )

  await expect(
    page.getByRole("button", { name: "Reveal My Results — Free" }),
  ).toBeVisible()
  await expect(
    page.getByText(`${TOTAL_PRODUCTS} products analyzed locally`),
  ).toBeVisible()
  await page.waitForTimeout(1_500)
  expect(downloads).toBe(0)

  // The preserved analysis still exports normally after signing in again.
  await page.getByRole("button", { name: "Reveal My Results — Free" }).click()
  await page.getByRole("button", { name: "Complete sign in" }).click()
  const report = await readReport(await download(page, "Full Margin Report"))
  expect(report.records).toHaveLength(TOTAL_PRODUCTS)
  expect(downloads).toBe(1)
})

test("Start New Scan invalidates a report that is still being prepared", async ({
  page,
}) => {
  await analyze(page, supplierCsv, catalogCsv)
  await signIn(page)

  let downloads = 0
  page.on("download", () => {
    downloads += 1
  })
  await page.evaluate(async () => {
    const modulePath = "/src/features/results/manual-override-service.ts"
    const loaded: unknown = await import(/* @vite-ignore */ modulePath)
    const { manualOverrideService } = loaded as {
      manualOverrideService: ManualOverrideService
    }
    const scope = window as Window & { releaseQueue?: () => void }
    void manualOverrideService.runExclusive(
      () =>
        new Promise<void>((resolve) => {
          scope.releaseQueue = resolve
        }),
    )
  })

  await page.getByRole("button", { name: "Products To Review" }).click()
  await expect(page.getByTestId("export-progress")).toBeVisible()
  await page.getByRole("button", { name: "Start New Scan" }).click()
  await page.getByRole("button", { name: "Start New Scan", exact: true }).last().click()
  await page.evaluate(() =>
    (window as Window & { releaseQueue?: () => void }).releaseQueue?.(),
  )

  await expect(page.getByRole("heading", { name: "Check your catalog" })).toBeVisible({
    timeout: 30_000,
  })
  await page.waitForTimeout(1_500)
  expect(downloads).toBe(0)
})

test("exports a generated 100k-product analysis while the page stays responsive", async ({
  page,
}) => {
  test.setTimeout(180_000)
  const rowCount = 100_000
  const identifiers = (index: number) => `SKU-${String(index).padStart(8, "0")}`
  const largeSupplier = ["sku,cost"]
  const largeCatalog = ["sku,price,min_margin"]
  for (let index = 0; index < rowCount; index += 1) {
    largeSupplier.push(`${identifiers(index)},${(index % 10_000) + 0.25}`)
    largeCatalog.push(
      `${identifiers(index)},${(index % 10_000) + 10.5},${index % 17 === 0 ? "20.5" : ""}`,
    )
  }

  await analyze(page, largeSupplier.join("\n"), largeCatalog.join("\n"))
  await signIn(page)

  await page.evaluate(() => {
    const scope = window as Window & {
      exportHeartbeat?: {
        ticks: number
        longestGapMs: number
        last: number
        timer: number
      }
    }
    const heartbeat = { ticks: 0, longestGapMs: 0, last: performance.now(), timer: 0 }
    heartbeat.timer = window.setInterval(() => {
      const now = performance.now()
      heartbeat.ticks += 1
      heartbeat.longestGapMs = Math.max(heartbeat.longestGapMs, now - heartbeat.last)
      heartbeat.last = now
    }, 10)
    scope.exportHeartbeat = heartbeat
  })

  const startedAt = Date.now()
  const started = page.waitForEvent("download", { timeout: 120_000 })
  await page.getByRole("button", { name: "Full Margin Report" }).click()
  const fullReport = await started
  const durationMs = Date.now() - startedAt
  const heartbeat = await page.evaluate(() => {
    const scope = window as Window & {
      exportHeartbeat?: { ticks: number; longestGapMs: number; timer: number }
    }
    window.clearInterval(scope.exportHeartbeat?.timer)
    return {
      ticks: scope.exportHeartbeat?.ticks ?? 0,
      longestGapMs: Math.round(scope.exportHeartbeat?.longestGapMs ?? 0),
    }
  })

  const report = await readReport(fullReport)
  expect(report.records).toHaveLength(rowCount)
  expectReportInvariants(report.records)
  expect(new Set(report.records.map((record) => record.identifier)).size).toBe(rowCount)
  console.info(
    `Report export benchmark: rows=${rowCount}, durationMs=${durationMs}, fileBytes=${report.bytes}, heartbeatTicks=${heartbeat.ticks}, longestMainThreadGapMs=${heartbeat.longestGapMs}`,
  )
  expect(heartbeat.ticks).toBeGreaterThan(0)

  // A real mid-stream cancellation against DuckDB: cancel once 20k rows have streamed.
  let laterDownloads = 0
  page.on("download", () => {
    laterDownloads += 1
  })
  const cancelled = await page.evaluate(async () => {
    const modulePath = "/src/features/exports/report-export-service.ts"
    const loaded: unknown = await import(/* @vite-ignore */ modulePath)
    const { reportExportService } = loaded as {
      reportExportService: ReportExportService
    }
    let rowsWhenCancelled = 0
    const outcome = await reportExportService.exportReport(
      "FULL_MARGIN_REPORT",
      { canExportResults: true },
      {
        onProgress: (rows) => {
          if (rows >= 20_000 && rowsWhenCancelled === 0) {
            rowsWhenCancelled = rows
            reportExportService.cancelActive()
          }
        },
      },
    )
    return { outcome, rowsWhenCancelled }
  })
  expect(cancelled.outcome).toEqual({ status: "CANCELLED" })
  expect(cancelled.rowsWhenCancelled).toBeGreaterThanOrEqual(20_000)
  expect(cancelled.rowsWhenCancelled).toBeLessThan(rowCount)
  await page.waitForTimeout(1_000)
  expect(laterDownloads).toBe(0)

  // The engine and the service remain usable after the cancelled statement.
  const afterCancel = await readReport(await download(page, "Products To Review"))
  expect(afterCancel.records.length).toBeGreaterThan(0)
  expect(afterCancel.records.every((record) => record.status !== "OK")).toBe(true)
  await expect(page.getByText("Showing 1–100 of 100,000")).toBeVisible()
})
