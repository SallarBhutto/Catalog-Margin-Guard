import { expect, test, type Page } from "@playwright/test"

import type { MarginAnalysisResult } from "../../src/features/analysis/margin-analysis-types"
import type {
  ResultsPage,
  ResultsQuery,
} from "../../src/features/results/results-query-types"
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
  runMarginAnalysis(input: AnalysisConfiguration): Promise<MarginAnalysisResult>
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

async function analyze(page: Page) {
  return page.evaluate<MarginAnalysisResult, AnalysisConfiguration>(
    async (browserConfiguration) => {
      const modulePath = "/src/features/analysis/index.ts"
      const loaded: unknown = await import(/* @vite-ignore */ modulePath)
      const module = loaded as AnalysisBrowserModule
      return module.runMarginAnalysis(browserConfiguration)
    },
    configuration,
  )
}

async function measureAggregateQuery(page: Page) {
  return page.evaluate(async () => {
    const duckDBModulePath = "/src/lib/duckdb/index.ts"
    const sqlModulePath = "/src/features/analysis/margin-analysis-sql.ts"
    const duckDBLoaded: unknown = await import(/* @vite-ignore */ duckDBModulePath)
    const sqlLoaded: unknown = await import(/* @vite-ignore */ sqlModulePath)
    const { duckDBEngine } = duckDBLoaded as {
      duckDBEngine: {
        withConnection<T>(
          operation: (connection: { query(sql: string): Promise<unknown> }) => Promise<T>,
        ): Promise<T>
      }
    }
    const { ANALYSIS_METADATA_SQL } = sqlLoaded as {
      ANALYSIS_METADATA_SQL: string
    }
    const startedAt = performance.now()
    await duckDBEngine.withConnection((connection) =>
      connection.query(ANALYSIS_METADATA_SQL),
    )
    return performance.now() - startedAt
  })
}

type ResultsQueryMetrics = Readonly<{
  firstPageMs: number
  searchMs: number
  filteredSortMs: number
  deepPageMs: number
  totalRows: number
  searchRows: number
  deepRows: number
  deepPage: number
}>

async function measureResultsQueries(page: Page, rowCount: number) {
  return page.evaluate<ResultsQueryMetrics, number>(async (browserRowCount) => {
    const modulePath = "/src/features/results/results-query-service.ts"
    const loaded: unknown = await import(/* @vite-ignore */ modulePath)
    const { resultsQueryService } = loaded as {
      resultsQueryService: {
        getResultsPage(query: ResultsQuery): Promise<ResultsPage>
      }
    }
    const baseQuery: ResultsQuery = {
      status: "ALL",
      targetSource: "ALL",
      sort: "RISK_HIGHEST",
      page: 1,
      pageSize: 250,
    }
    const measure = async (query: ResultsQuery) => {
      const startedAt = performance.now()
      const result = await resultsQueryService.getResultsPage(query)
      return { result, durationMs: performance.now() - startedAt }
    }

    const first = await measure(baseQuery)
    const search = await measure({
      ...baseQuery,
      search: `SKU-${String(browserRowCount - 1).padStart(8, "0")}`,
    })
    const filteredSort = await measure({
      ...baseQuery,
      status: "REVIEW",
      targetSource: "CATALOG_OVERRIDE",
      sort: "SUPPLIER_COST_DESC",
    })
    const requestedDeepPage = Math.ceil(browserRowCount / baseQuery.pageSize)
    const deep = await measure({
      ...baseQuery,
      sort: "IDENTIFIER_ASC",
      page: requestedDeepPage,
    })

    return {
      firstPageMs: first.durationMs,
      searchMs: search.durationMs,
      filteredSortMs: filteredSort.durationMs,
      deepPageMs: deep.durationMs,
      totalRows: first.result.totalRows,
      searchRows: search.result.totalRows,
      deepRows: deep.result.rows.length,
      deepPage: deep.result.page,
    }
  }, rowCount)
}

test("keeps generated 10k/100k normalization, matching, analysis, and aggregates set-based and responsive", async ({
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
        analysisHeartbeat?: number
        analysisHeartbeatTimer?: number
      }
      scope.analysisHeartbeat = 0
      scope.analysisHeartbeatTimer = window.setInterval(() => {
        scope.analysisHeartbeat = (scope.analysisHeartbeat ?? 0) + 1
      }, 10)
    })

    const startedAt = performance.now()
    const result = await analyze(page)
    const durationMs = performance.now() - startedAt
    const heartbeat = await page.evaluate(() => {
      const scope = window as Window & {
        analysisHeartbeat?: number
        analysisHeartbeatTimer?: number
      }
      if (scope.analysisHeartbeatTimer !== undefined) {
        window.clearInterval(scope.analysisHeartbeatTimer)
      }
      return scope.analysisHeartbeat ?? 0
    })
    const aggregateDurationMs = await measureAggregateQuery(page)
    const resultsMetrics = await measureResultsQueries(page, rowCount)

    expect(result).toMatchObject({
      status: "READY",
      relations: {
        matches: { rowCount },
        results: { rowCount },
      },
      metadata: {
        summary: { productsAnalyzed: rowCount },
        dataQuality: {
          supplierRows: rowCount,
          catalogRows: rowCount,
          matchedProducts: rowCount,
          supplierDuplicateIdentifiers: 0,
          catalogDuplicateIdentifiers: 0,
          invalidSupplierCosts: 0,
          invalidSellingPrices: 0,
          invalidMarginOverrides: 0,
        },
      },
    })
    expect(heartbeat).toBeGreaterThan(0)
    expect(resultsMetrics).toMatchObject({
      totalRows: rowCount,
      searchRows: 1,
      deepRows: 250,
      deepPage: Math.ceil(rowCount / 250),
    })
    console.info(
      `Margin analysis benchmark: rowsPerFile=${rowCount}, totalDurationMs=${durationMs.toFixed(1)}, aggregateDurationMs=${aggregateDurationMs.toFixed(1)}, firstPageMs=${resultsMetrics.firstPageMs.toFixed(1)}, searchMs=${resultsMetrics.searchMs.toFixed(1)}, filteredSortMs=${resultsMetrics.filteredSortMs.toFixed(1)}, deepPage=${resultsMetrics.deepPage}, deepPageMs=${resultsMetrics.deepPageMs.toFixed(1)}, mainThreadHeartbeats=${heartbeat}`,
    )
  }
})
