import { expect, test, type Page } from "@playwright/test"

import type { MarginAnalysisResult } from "../../src/features/analysis/margin-analysis-types"
import type { AnalysisConfiguration } from "../../src/features/setup/analysis-configuration"
import type {
  DuckDBConnection,
  DuckDBSchemaField,
} from "../../src/lib/duckdb/duckdb-types"

type BrowserQueryValue = string | number | boolean | null
type BrowserQueryRow = Record<string, BrowserQueryValue>

type AnalysisBrowserModule = Readonly<{
  runMarginAnalysis(configuration: AnalysisConfiguration): Promise<MarginAnalysisResult>
}>

type DuckDBBrowserModule = Readonly<{
  duckDBEngine: Readonly<{
    withConnection<T>(operation: (connection: DuckDBConnection) => Promise<T>): Promise<T>
  }>
}>

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

const supplierCsv = `sku,cost
ABC-12,96
XYZ-88,44
KLP-91,151
EQUAL-REVIEW,10
EQUAL-OK,10
EXACT-TARGET,80
BELOW-TARGET,80.0001
CENT-EXACT,96
CENT-ABOVE,96.0001
TARGET-ZERO,12.3456
TARGET-95,1
ZERO-COST,0
INVALID-COST,nope
INVALID-OVERRIDE,10
BLANK-OVERRIDE,10
OVERRIDE-POINT-TWO,10
SUPPLIER-ONLY,5
DUP-S,10
DUP-S,11
DUP-C,10
CASE-ID,5
001234,7
,5
INVALID-PRICE,10
Unicode-商品/ß,1`

const catalogCsv = `sku,price,margin
ABC-12,105,10
XYZ-88,69,30
KLP-91,149,
EQUAL-REVIEW,10,20
EQUAL-OK,10,0
EXACT-TARGET,100,20
BELOW-TARGET,100,20
CENT-EXACT,150,20
CENT-ABOVE,150,20
TARGET-ZERO,20,0
TARGET-95,30,95
ZERO-COST,10,95
INVALID-COST,20,20
INVALID-OVERRIDE,20,bad
BLANK-OVERRIDE,20,
OVERRIDE-POINT-TWO,20,0.20
CATALOG-ONLY,10,20
DUP-S,20,20
DUP-C,20,20
DUP-C,21,20
case-id,10,20
001234,10,20
,10,20
INVALID-PRICE,0,20
Unicode-商品/ß,2,`

async function chooseSyntheticFiles(page: Page) {
  await page.locator("#supplier-file-input").setInputFiles({
    name: "private-supplier.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(supplierCsv),
  })
  await page.locator("#catalog-file-input").setInputFiles({
    name: "private-catalog.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(catalogCsv),
  })
  await expect(page.getByTestId("column-mapping-section")).toBeVisible({
    timeout: 30_000,
  })
}

async function runAnalysis(page: Page, input: AnalysisConfiguration = configuration) {
  return page.evaluate<MarginAnalysisResult, AnalysisConfiguration>(
    async (browserConfiguration) => {
      const modulePath = "/src/features/analysis/index.ts"
      const loaded: unknown = await import(/* @vite-ignore */ modulePath)
      const module = loaded as AnalysisBrowserModule
      return module.runMarginAnalysis(browserConfiguration)
    },
    input,
  )
}

async function queryRows(page: Page, sql: string): Promise<BrowserQueryRow[]> {
  return page.evaluate<BrowserQueryRow[], string>(async (browserSql) => {
    const modulePath = "/src/lib/duckdb/index.ts"
    const loaded: unknown = await import(/* @vite-ignore */ modulePath)
    const { duckDBEngine } = loaded as DuckDBBrowserModule
    return duckDBEngine.withConnection(async (connection: DuckDBConnection) => {
      const result = await connection.query(browserSql)
      const rows: BrowserQueryRow[] = []

      for (let rowIndex = 0; rowIndex < result.numRows; rowIndex += 1) {
        const row: BrowserQueryRow = {}
        result.schema.fields.forEach((field: DuckDBSchemaField, columnIndex: number) => {
          const value = result.getChildAt(columnIndex)?.get(rowIndex)
          if (
            value == null ||
            typeof value === "string" ||
            typeof value === "number" ||
            typeof value === "boolean"
          ) {
            row[field.name] = value ?? null
          } else if (typeof value === "bigint") {
            row[field.name] = value.toString()
          } else {
            throw new Error("Unexpected DuckDB test value")
          }
        })
        rows.push(row)
      }

      return rows
    })
  }, sql)
}

test.beforeEach(async ({ page }) => {
  await page.goto("/check")
  await expect(page.getByTestId("engine-readiness")).toHaveText(
    "Local analysis is ready.",
    { timeout: 30_000 },
  )
})

test("runs deterministic matching, financial analysis, aggregates, and privacy locally", async ({
  page,
}) => {
  const requests: Array<{ url: string; postData: string | null }> = []
  const browserErrors: string[] = []
  page.on("request", (request) => {
    requests.push({ url: request.url(), postData: request.postData() })
  })
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(message.text())
  })

  await chooseSyntheticFiles(page)
  const result = await runAnalysis(page)

  expect(result).toEqual({
    status: "READY",
    relations: {
      matches: { name: "identifier_matches", rowCount: 22 },
      results: { name: "analysis_results", rowCount: 18 },
    },
    metadata: {
      summary: {
        productsAnalyzed: 18,
        productsAtLoss: 1,
        productsNeedingReview: 3,
        productsMeetingTarget: 14,
        averageGrossMarginPct: expect.any(String),
        productsUsingStoreDefaultTarget: 4,
        productsUsingProductSpecificTarget: 14,
      },
      exposure: {
        belowZero: 1,
        zeroToFive: 2,
        fiveToTen: 1,
        tenToFifteen: 0,
        fifteenToTwenty: 1,
        twentyToThirty: 1,
        thirtyAndAbove: 12,
      },
      dataQuality: {
        supplierRows: 25,
        catalogRows: 25,
        matchedProducts: 20,
        supplierOnlyProducts: 1,
        catalogOnlyProducts: 1,
        supplierDuplicateIdentifiers: 1,
        catalogDuplicateIdentifiers: 1,
        invalidSupplierCosts: 1,
        invalidSellingPrices: 1,
        invalidMarginOverrides: 1,
      },
    },
  })

  if (result.status !== "READY") throw new Error("Expected ready analysis")
  expect(Number(result.metadata.summary.averageGrossMarginPct)).toBeCloseTo(37.2444, 3)
  expect(
    Object.values(result.metadata.exposure).reduce(
      (total, bucketCount) => total + bucketCount,
      0,
    ),
  ).toBe(result.metadata.summary.productsAnalyzed)
  expect(
    result.metadata.summary.productsAtLoss +
      result.metadata.summary.productsNeedingReview +
      result.metadata.summary.productsMeetingTarget,
  ).toBe(result.metadata.summary.productsAnalyzed)
  expect(
    result.metadata.summary.productsUsingStoreDefaultTarget +
      result.metadata.summary.productsUsingProductSpecificTarget,
  ).toBe(result.metadata.summary.productsAnalyzed)
  expect(Object.values(result.metadata.dataQuality).every((count) => count >= 0)).toBe(
    true,
  )

  const classifications = await queryRows(
    page,
    `SELECT match_status, count(*) AS product_count
     FROM identifier_matches
     GROUP BY match_status
     ORDER BY match_status;`,
  )
  expect(classifications).toEqual([
    { match_status: "CATALOG_ONLY", product_count: "1" },
    { match_status: "MATCHED", product_count: "20" },
    { match_status: "SUPPLIER_ONLY", product_count: "1" },
  ])
  await expect(
    queryRows(
      page,
      `SELECT count(*) AS ambiguous_only_count
       FROM identifier_matches
       WHERE match_key IN ('DUP-S', 'DUP-C');`,
    ),
  ).resolves.toEqual([{ ambiguous_only_count: "0" }])

  const canonical = await queryRows(
    page,
    `SELECT
       display_identifier,
       CAST(supplier_cost AS VARCHAR) AS supplier_cost,
       CAST(selling_price AS VARCHAR) AS selling_price,
       CAST(gross_profit AS VARCHAR) AS gross_profit,
       CAST(gross_margin_pct AS VARCHAR) AS gross_margin_pct,
       CAST(effective_target_margin_pct AS VARCHAR) AS effective_target_margin_pct,
       target_source,
       CAST(price_for_target_margin AS VARCHAR) AS price_for_target_margin,
       status
     FROM analysis_results
     WHERE match_key IN ('ABC-12', 'XYZ-88', 'KLP-91')
     ORDER BY match_key;`,
  )
  expect(canonical).toEqual([
    {
      display_identifier: "ABC-12",
      supplier_cost: "96.0000",
      selling_price: "105.0000",
      gross_profit: "9.0000",
      gross_margin_pct: "8.571428571428",
      effective_target_margin_pct: "10.0000",
      target_source: "CATALOG_OVERRIDE",
      price_for_target_margin: "106.67",
      status: "REVIEW",
    },
    {
      display_identifier: "KLP-91",
      supplier_cost: "151.0000",
      selling_price: "149.0000",
      gross_profit: "-2.0000",
      gross_margin_pct: "-1.342281879194",
      effective_target_margin_pct: "20.0000",
      target_source: "STORE_DEFAULT",
      price_for_target_margin: "188.75",
      status: "LOSS",
    },
    {
      display_identifier: "XYZ-88",
      supplier_cost: "44.0000",
      selling_price: "69.0000",
      gross_profit: "25.0000",
      gross_margin_pct: "36.231884057971",
      effective_target_margin_pct: "30.0000",
      target_source: "CATALOG_OVERRIDE",
      price_for_target_margin: "62.86",
      status: "OK",
    },
  ])

  await expect(
    queryRows(
      page,
      `SELECT column_name, data_type
       FROM information_schema.columns
       WHERE table_name = 'analysis_results'
       ORDER BY ordinal_position;`,
    ),
  ).resolves.toEqual([
    { column_name: "match_key", data_type: "VARCHAR" },
    { column_name: "display_identifier", data_type: "VARCHAR" },
    { column_name: "supplier_source_row_id", data_type: "UBIGINT" },
    { column_name: "catalog_source_row_id", data_type: "UBIGINT" },
    { column_name: "supplier_cost", data_type: "DECIMAL(18,4)" },
    { column_name: "selling_price", data_type: "DECIMAL(18,4)" },
    { column_name: "gross_profit", data_type: "DECIMAL(18,4)" },
    { column_name: "gross_margin_pct", data_type: "DECIMAL(38,12)" },
    { column_name: "store_default_margin_pct", data_type: "DECIMAL(7,4)" },
    {
      column_name: "catalog_override_margin_pct",
      data_type: "DECIMAL(7,4)",
    },
    { column_name: "manual_override_margin_pct", data_type: "DECIMAL(7,4)" },
    { column_name: "effective_target_margin_pct", data_type: "DECIMAL(7,4)" },
    { column_name: "target_source", data_type: "VARCHAR" },
    { column_name: "price_for_target_margin", data_type: "DECIMAL(18,2)" },
    { column_name: "status", data_type: "VARCHAR" },
  ])

  const boundaries = await queryRows(
    page,
    `SELECT
       match_key,
       CAST(gross_margin_pct AS VARCHAR) AS gross_margin_pct,
       CAST(effective_target_margin_pct AS VARCHAR) AS target,
       CAST(price_for_target_margin AS VARCHAR) AS target_price,
       target_source,
       status
     FROM analysis_results
     WHERE match_key IN (
       'EQUAL-REVIEW', 'EQUAL-OK', 'EXACT-TARGET', 'BELOW-TARGET',
       'CENT-EXACT', 'CENT-ABOVE', 'TARGET-ZERO', 'TARGET-95', 'ZERO-COST',
       'INVALID-OVERRIDE', 'OVERRIDE-POINT-TWO'
     )
     ORDER BY match_key;`,
  )
  expect(boundaries).toEqual([
    {
      match_key: "BELOW-TARGET",
      gross_margin_pct: "19.999900000000",
      target: "20.0000",
      target_price: "100.01",
      target_source: "CATALOG_OVERRIDE",
      status: "REVIEW",
    },
    {
      match_key: "CENT-ABOVE",
      gross_margin_pct: "35.999933333333",
      target: "20.0000",
      target_price: "120.01",
      target_source: "CATALOG_OVERRIDE",
      status: "OK",
    },
    {
      match_key: "CENT-EXACT",
      gross_margin_pct: "36.000000000000",
      target: "20.0000",
      target_price: "120.00",
      target_source: "CATALOG_OVERRIDE",
      status: "OK",
    },
    {
      match_key: "EQUAL-OK",
      gross_margin_pct: "0.000000000000",
      target: "0.0000",
      target_price: "10.00",
      target_source: "CATALOG_OVERRIDE",
      status: "OK",
    },
    {
      match_key: "EQUAL-REVIEW",
      gross_margin_pct: "0.000000000000",
      target: "20.0000",
      target_price: "12.50",
      target_source: "CATALOG_OVERRIDE",
      status: "REVIEW",
    },
    {
      match_key: "EXACT-TARGET",
      gross_margin_pct: "20.000000000000",
      target: "20.0000",
      target_price: "100.00",
      target_source: "CATALOG_OVERRIDE",
      status: "OK",
    },
    {
      match_key: "INVALID-OVERRIDE",
      gross_margin_pct: "50.000000000000",
      target: "20.0000",
      target_price: "12.50",
      target_source: "STORE_DEFAULT",
      status: "OK",
    },
    {
      match_key: "OVERRIDE-POINT-TWO",
      gross_margin_pct: "50.000000000000",
      target: "0.2000",
      target_price: "10.03",
      target_source: "CATALOG_OVERRIDE",
      status: "OK",
    },
    {
      match_key: "TARGET-95",
      gross_margin_pct: "96.666666666666",
      target: "95.0000",
      target_price: "20.00",
      target_source: "CATALOG_OVERRIDE",
      status: "OK",
    },
    {
      match_key: "TARGET-ZERO",
      gross_margin_pct: "38.272000000000",
      target: "0.0000",
      target_price: "12.35",
      target_source: "CATALOG_OVERRIDE",
      status: "OK",
    },
    {
      match_key: "ZERO-COST",
      gross_margin_pct: "100.000000000000",
      target: "95.0000",
      target_price: "0.00",
      target_source: "CATALOG_OVERRIDE",
      status: "OK",
    },
  ])

  await expect(
    queryRows(
      page,
      `SELECT display_identifier
       FROM analysis_results
       WHERE display_identifier IN ('001234', 'Unicode-商品/ß')
       ORDER BY CASE WHEN display_identifier = '001234' THEN 0 ELSE 1 END;`,
    ),
  ).resolves.toEqual([
    { display_identifier: "001234" },
    { display_identifier: "Unicode-商品/ß" },
  ])

  await expect(
    queryRows(
      page,
      `SELECT
         (count(*) FILTER (WHERE status = 'LOSS')
          + count(*) FILTER (WHERE status = 'REVIEW')
          + count(*) FILTER (WHERE status = 'OK')) = count(*) AS status_invariant,
         (count(*) FILTER (WHERE target_source = 'STORE_DEFAULT')
          + count(*) FILTER (WHERE target_source = 'CATALOG_OVERRIDE')) = count(*) AS target_invariant,
         count(*) FILTER (WHERE match_key IN (
           SELECT match_key FROM identifier_matches
           GROUP BY match_key HAVING count(*) > 1
         )) AS duplicate_result_keys,
         count(*) FILTER (WHERE supplier_cost IS NULL OR selling_price IS NULL) AS invalid_pricing_rows
       FROM analysis_results;`,
    ),
  ).resolves.toEqual([
    {
      status_invariant: true,
      target_invariant: true,
      duplicate_result_keys: "0",
      invalid_pricing_rows: "0",
    },
  ])

  expect(browserErrors).toEqual([])
  const outboundText = requests
    .map(({ url, postData }) => `${url}\n${postData ?? ""}`)
    .join("\n")
  for (const privateValue of [
    "private-supplier.csv",
    "private-catalog.csv",
    "sku",
    "ABC-12",
    "96.0001",
    "Unicode-商品/ß",
    "CATALOG_OVERRIDE",
  ]) {
    expect(outboundText).not.toContain(privateValue)
  }
})

test("replaces result relations on rerun and respects case-sensitive matching", async ({
  page,
}) => {
  await chooseSyntheticFiles(page)
  await expect(runAnalysis(page)).resolves.toMatchObject({ status: "READY" })

  const rerun = await runAnalysis(page, {
    ...configuration,
    options: {
      ...configuration.options,
      storeDefaultMargin: 25,
      caseInsensitive: false,
    },
  })
  expect(rerun).toMatchObject({
    status: "READY",
    relations: {
      matches: { rowCount: 23 },
      results: { rowCount: 17 },
    },
    metadata: {
      dataQuality: {
        matchedProducts: 19,
        supplierOnlyProducts: 2,
        catalogOnlyProducts: 2,
      },
    },
  })

  await expect(
    queryRows(
      page,
      `SELECT
         (SELECT count(*) FROM analysis_results) AS result_count,
         (SELECT count(*) FROM identifier_matches) AS match_count,
         (SELECT count(*) FROM information_schema.tables
          WHERE table_name LIKE 'analysis_results_%') AS versioned_relations,
         (SELECT CAST(effective_target_margin_pct AS VARCHAR)
          FROM analysis_results WHERE match_key = 'KLP-91') AS rebuilt_default;
      `,
    ),
  ).resolves.toEqual([
    {
      result_count: "17",
      match_count: "23",
      versioned_relations: "0",
      rebuilt_default: "25.0000",
    },
  ])

  await expect(
    runAnalysis(page, {
      ...configuration,
      options: { ...configuration.options, storeDefaultMargin: 96 },
    }),
  ).resolves.toMatchObject({
    status: "ERROR",
    error: { code: "INVALID_CONFIGURATION" },
  })
  await expect(
    queryRows(
      page,
      `SELECT count(*) AS stale_relation_count
       FROM information_schema.tables
       WHERE table_name IN (
         'unique_supplier_identifiers',
         'unique_catalog_identifiers',
         'identifier_matches',
         'analysis_results'
       );`,
    ),
  ).resolves.toEqual([{ stale_relation_count: "0" }])
})

test("keeps zero-product analysis deliberate and nullable", async ({ page }) => {
  await page.locator("#supplier-file-input").setInputFiles({
    name: "no-valid-supplier.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("sku,cost\nA,bad"),
  })
  await page.locator("#catalog-file-input").setInputFiles({
    name: "no-valid-catalog.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("sku,price,margin\nA,0,bad"),
  })
  await expect(page.getByTestId("column-mapping-section")).toBeVisible({
    timeout: 30_000,
  })

  const result = await runAnalysis(page)
  expect(result).toMatchObject({
    status: "READY",
    relations: { results: { rowCount: 0 } },
    metadata: {
      summary: {
        productsAnalyzed: 0,
        averageGrossMarginPct: null,
      },
      dataQuality: {
        matchedProducts: 1,
        invalidSupplierCosts: 1,
        invalidSellingPrices: 1,
        invalidMarginOverrides: 1,
      },
    },
  })
})
