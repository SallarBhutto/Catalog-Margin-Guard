import { expect, test, type Page } from "@playwright/test"

import type { NormalizedInputsResult } from "../../src/features/analysis/normalization-types"
import type { AnalysisConfiguration } from "../../src/features/setup/analysis-configuration"

const configuration: AnalysisConfiguration = {
  mapping: {
    supplierIdentifier: "sku",
    supplierCost: "cost",
    catalogIdentifier: "sku",
    catalogPrice: "price",
    catalogMarginOverride: "margin",
  },
  options: {
    storeDefaultMargin: 20,
    caseInsensitive: true,
    numberFormat: "US",
    currency: "USD",
  },
}

type AnalysisBrowserModule = Readonly<{
  prepareNormalizedInputs(input: AnalysisConfiguration): Promise<NormalizedInputsResult>
}>

function createSupplierCsv(rowCount: number) {
  const rows = new Array<string>(rowCount + 1)
  rows[0] = "sku,cost"
  for (let index = 0; index < rowCount; index += 1) {
    rows[index + 1] = `SKU-${String(index).padStart(8, "0")},${(index % 10_000) + 0.25}`
  }
  return rows.join("\n")
}

function createCatalogCsv(rowCount: number) {
  const rows = new Array<string>(rowCount + 1)
  rows[0] = "sku,price,margin"
  for (let index = 0; index < rowCount; index += 1) {
    rows[index + 1] =
      `SKU-${String(index).padStart(8, "0")},${(index % 10_000) + 10.5},${index % 17 === 0 ? "20.5" : ""}`
  }
  return rows.join("\n")
}

async function prepare(page: Page) {
  return page.evaluate<NormalizedInputsResult, AnalysisConfiguration>(
    async (browserConfiguration) => {
      const modulePath = "/src/features/analysis/index.ts"
      const loaded: unknown = await import(/* @vite-ignore */ modulePath)
      const module = loaded as AnalysisBrowserModule
      return module.prepareNormalizedInputs(browserConfiguration)
    },
    configuration,
  )
}

test("keeps generated 10k/100k normalization set-based and responsive", async ({
  page,
}) => {
  test.setTimeout(120_000)

  await page.goto("/check")
  await expect(page.getByTestId("engine-readiness")).toHaveText(
    "Local analysis is ready.",
    { timeout: 30_000 },
  )

  for (const rowCount of [10_000, 100_000]) {
    const supplierCsv = createSupplierCsv(rowCount)
    const catalogCsv = createCatalogCsv(rowCount)
    await page.locator("#supplier-file-input").setInputFiles({
      name: "generated-supplier.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(supplierCsv),
    })
    await page.locator("#catalog-file-input").setInputFiles({
      name: "generated-catalog.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(catalogCsv),
    })
    await expect(page.getByTestId("column-mapping-section")).toBeVisible({
      timeout: 30_000,
    })

    await page.evaluate(() => {
      const scope = window as Window & {
        normalizationHeartbeat?: number
        normalizationHeartbeatTimer?: number
      }
      scope.normalizationHeartbeat = 0
      scope.normalizationHeartbeatTimer = window.setInterval(() => {
        scope.normalizationHeartbeat = (scope.normalizationHeartbeat ?? 0) + 1
      }, 10)
    })

    const startedAt = performance.now()
    const result = await prepare(page)
    const durationMs = performance.now() - startedAt
    const heartbeat = await page.evaluate(() => {
      const scope = window as Window & {
        normalizationHeartbeat?: number
        normalizationHeartbeatTimer?: number
      }
      if (scope.normalizationHeartbeatTimer !== undefined) {
        window.clearInterval(scope.normalizationHeartbeatTimer)
      }
      return scope.normalizationHeartbeat ?? 0
    })

    expect(result).toMatchObject({
      status: "READY",
      relations: {
        supplier: { rowCount },
        catalog: { rowCount },
      },
      quality: {
        supplierRows: rowCount,
        catalogRows: rowCount,
        supplierDuplicateIdentifiers: 0,
        catalogDuplicateIdentifiers: 0,
        invalidSupplierCosts: 0,
        invalidSellingPrices: 0,
        invalidMarginOverrides: 0,
      },
    })
    expect(heartbeat).toBeGreaterThan(0)
    console.info(
      `Normalization benchmark: rowsPerFile=${rowCount}, durationMs=${durationMs.toFixed(1)}, mainThreadHeartbeats=${heartbeat}`,
    )
  }
})
