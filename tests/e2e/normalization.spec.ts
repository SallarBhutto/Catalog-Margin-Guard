import path from "node:path"
import { fileURLToPath } from "node:url"

import { expect, test, type Page } from "@playwright/test"

import type { AnalysisConfiguration } from "../../src/features/setup/analysis-configuration"
import type { NormalizedInputsResult } from "../../src/features/analysis/normalization-types"
import type {
  DuckDBConnection,
  DuckDBSchemaField,
} from "../../src/lib/duckdb/duckdb-types"

const fixtureDirectory = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../fixtures",
)
const fixture = (name: string) => path.join(fixtureDirectory, name)

type BrowserQueryValue = string | number | boolean | null
type BrowserQueryRow = Record<string, BrowserQueryValue>
type AnalysisBrowserModule = Readonly<{
  prepareNormalizedInputs(
    configuration: AnalysisConfiguration,
  ): Promise<NormalizedInputsResult>
}>
type DuckDBBrowserModule = Readonly<{
  duckDBEngine: Readonly<{
    withConnection<T>(operation: (connection: DuckDBConnection) => Promise<T>): Promise<T>
  }>
}>

const usConfiguration: AnalysisConfiguration = {
  mapping: {
    supplierIdentifier: 'Supplier "SKU"',
    supplierCost: "select",
    catalogIdentifier: "Produkt № / ID",
    catalogPrice: 'Selling "Price"',
    catalogMarginOverride: "marge-%",
  },
  options: {
    storeDefaultMargin: 20,
    caseInsensitive: true,
    numberFormat: "US",
    currency: "USD",
  },
}

const euConfiguration: AnalysisConfiguration = {
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
    numberFormat: "EU",
    currency: "EUR",
  },
}

async function chooseFiles(page: Page, supplier: string, catalog: string) {
  await page.locator("#supplier-file-input").setInputFiles(fixture(supplier))
  await page.locator("#catalog-file-input").setInputFiles(fixture(catalog))
  await expect(page.getByTestId("column-mapping-section")).toBeVisible({
    timeout: 30_000,
  })
}

async function prepare(
  page: Page,
  configuration: AnalysisConfiguration,
): Promise<NormalizedInputsResult> {
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

test("normalizes US inputs with DECIMAL values, row flags, safe mapped columns, and post-normalization duplicates", async ({
  page,
}) => {
  const requests: Array<{ url: string; postData: string | null }> = []
  page.on("request", (request) => {
    requests.push({ url: request.url(), postData: request.postData() })
  })

  await chooseFiles(page, "normalization-us-supplier.csv", "normalization-us-catalog.csv")

  const result = await prepare(page, usConfiguration)
  expect(result).toEqual({
    status: "READY",
    relations: {
      supplier: { name: "normalized_supplier", rowCount: 8 },
      catalog: { name: "normalized_catalog", rowCount: 11 },
    },
    quality: {
      supplierRows: 8,
      catalogRows: 11,
      supplierDuplicateIdentifiers: 1,
      catalogDuplicateIdentifiers: 1,
      invalidSupplierCosts: 2,
      invalidSellingPrices: 2,
      invalidMarginOverrides: 3,
    },
    diagnostics: {
      invalidSupplierIdentifiers: 1,
      invalidCatalogIdentifiers: 1,
    },
  })

  const supplierRows = await queryRows(
    page,
    `SELECT
      original_identifier,
      normalized_identifier,
      CAST(supplier_cost AS VARCHAR) AS supplier_cost,
      is_identifier_valid,
      is_supplier_cost_valid,
      is_duplicate_identifier
    FROM normalized_supplier
    ORDER BY source_row_id;`,
  )
  expect(supplierRows).toEqual([
    {
      original_identifier: " abc-12 ",
      normalized_identifier: "ABC-12",
      supplier_cost: "1234.5600",
      is_identifier_valid: true,
      is_supplier_cost_valid: true,
      is_duplicate_identifier: true,
    },
    {
      original_identifier: "ABC-12",
      normalized_identifier: "ABC-12",
      supplier_cost: "1234.5600",
      is_identifier_valid: true,
      is_supplier_cost_valid: true,
      is_duplicate_identifier: true,
    },
    {
      original_identifier: "001234",
      normalized_identifier: "001234",
      supplier_cost: "0.0000",
      is_identifier_valid: true,
      is_supplier_cost_valid: true,
      is_duplicate_identifier: false,
    },
    {
      original_identifier: "1234",
      normalized_identifier: "1234",
      supplier_cost: null,
      is_identifier_valid: true,
      is_supplier_cost_valid: false,
      is_duplicate_identifier: false,
    },
    {
      original_identifier: "A_B/C.D",
      normalized_identifier: "A_B/C.D",
      supplier_cost: "-1.0000",
      is_identifier_valid: true,
      is_supplier_cost_valid: false,
      is_duplicate_identifier: false,
    },
    {
      original_identifier: null,
      normalized_identifier: null,
      supplier_cost: "20.0000",
      is_identifier_valid: false,
      is_supplier_cost_valid: true,
      is_duplicate_identifier: false,
    },
    {
      original_identifier: "Ünicode",
      normalized_identifier: "ÜNICODE",
      supplier_cost: "101.2500",
      is_identifier_valid: true,
      is_supplier_cost_valid: true,
      is_duplicate_identifier: false,
    },
    {
      original_identifier: "USD-CODE",
      normalized_identifier: "USD-CODE",
      supplier_cost: "96.0000",
      is_identifier_valid: true,
      is_supplier_cost_valid: true,
      is_duplicate_identifier: false,
    },
  ])

  const catalogOverrides = await queryRows(
    page,
    `SELECT
      normalized_identifier,
      CAST(selling_price AS VARCHAR) AS selling_price,
      CAST(catalog_margin_override AS VARCHAR) AS catalog_margin_override,
      has_margin_override,
      is_margin_override_valid,
      is_selling_price_valid,
      is_duplicate_identifier
    FROM normalized_catalog
    ORDER BY source_row_id;`,
  )
  expect(catalogOverrides.slice(0, 5)).toEqual([
    {
      normalized_identifier: "ABC-12",
      selling_price: "2000.0000",
      catalog_margin_override: "20.0000",
      has_margin_override: true,
      is_margin_override_valid: true,
      is_selling_price_valid: true,
      is_duplicate_identifier: true,
    },
    {
      normalized_identifier: "ABC-12",
      selling_price: "2000.0000",
      catalog_margin_override: "20.5000",
      has_margin_override: true,
      is_margin_override_valid: true,
      is_selling_price_valid: true,
      is_duplicate_identifier: true,
    },
    {
      normalized_identifier: "001234",
      selling_price: "10.0000",
      catalog_margin_override: null,
      has_margin_override: false,
      is_margin_override_valid: true,
      is_selling_price_valid: true,
      is_duplicate_identifier: false,
    },
    {
      normalized_identifier: "1234",
      selling_price: "0.0000",
      catalog_margin_override: "0.2000",
      has_margin_override: true,
      is_margin_override_valid: true,
      is_selling_price_valid: false,
      is_duplicate_identifier: false,
    },
    {
      normalized_identifier: "A_B/C.D",
      selling_price: "-1.0000",
      catalog_margin_override: null,
      has_margin_override: true,
      is_margin_override_valid: false,
      is_selling_price_valid: false,
      is_duplicate_identifier: false,
    },
  ])
  expect(
    catalogOverrides.filter((row) => row.is_margin_override_valid === false),
  ).toHaveLength(3)

  const relationTypes = await queryRows(
    page,
    `SELECT table_name, column_name, data_type
     FROM information_schema.columns
     WHERE table_name IN ('normalized_supplier', 'normalized_catalog')
       AND column_name IN ('supplier_cost', 'selling_price', 'catalog_margin_override')
     ORDER BY table_name, column_name;`,
  )
  expect(relationTypes).toEqual([
    {
      table_name: "normalized_catalog",
      column_name: "catalog_margin_override",
      data_type: "DECIMAL(7,4)",
    },
    {
      table_name: "normalized_catalog",
      column_name: "selling_price",
      data_type: "DECIMAL(18,4)",
    },
    {
      table_name: "normalized_supplier",
      column_name: "supplier_cost",
      data_type: "DECIMAL(18,4)",
    },
  ])

  const outboundText = requests
    .map(({ url, postData }) => `${url}\n${postData ?? ""}`)
    .join("\n")
  for (const privateValue of [
    "normalization-us-supplier.csv",
    'Supplier "SKU"',
    "Produkt № / ID",
    "abc-12",
    "$1,234.56",
    "marge-%",
  ]) {
    expect(outboundText).not.toContain(privateValue)
  }
})

test("rebuilds relations for case-sensitive and unmapped-override configurations, then clears them on source replacement", async ({
  page,
}) => {
  await chooseFiles(page, "normalization-us-supplier.csv", "normalization-us-catalog.csv")
  await expect(prepare(page, usConfiguration)).resolves.toMatchObject({
    status: "READY",
  })

  const caseSensitive = await prepare(page, {
    ...usConfiguration,
    options: { ...usConfiguration.options, caseInsensitive: false },
  })
  expect(caseSensitive).toMatchObject({
    status: "READY",
    quality: {
      supplierRows: 8,
      catalogRows: 11,
      supplierDuplicateIdentifiers: 0,
      catalogDuplicateIdentifiers: 0,
    },
  })
  await expect(
    queryRows(
      page,
      `SELECT normalized_identifier FROM normalized_supplier
       WHERE trim(original_identifier) IN ('abc-12', 'ABC-12')
       ORDER BY source_row_id;`,
    ),
  ).resolves.toEqual([
    { normalized_identifier: "abc-12" },
    { normalized_identifier: "ABC-12" },
  ])

  const withoutOverride = await prepare(page, {
    ...usConfiguration,
    mapping: {
      supplierIdentifier: usConfiguration.mapping.supplierIdentifier,
      supplierCost: usConfiguration.mapping.supplierCost,
      catalogIdentifier: usConfiguration.mapping.catalogIdentifier,
      catalogPrice: usConfiguration.mapping.catalogPrice,
    },
  })
  expect(withoutOverride).toMatchObject({
    status: "READY",
    quality: { catalogRows: 11, invalidMarginOverrides: 0 },
  })
  await expect(
    queryRows(
      page,
      `SELECT
        count(*) FILTER (WHERE raw_margin_override IS NULL) AS raw_nulls,
        count(*) FILTER (WHERE catalog_margin_override IS NULL) AS parsed_nulls,
        count(*) FILTER (WHERE is_margin_override_valid) AS valid_rows
       FROM normalized_catalog;`,
    ),
  ).resolves.toEqual([{ raw_nulls: "11", parsed_nulls: "11", valid_rows: "11" }])

  await page
    .locator("#supplier-file-input")
    .setInputFiles(fixture("replacement-supplier.csv"))
  await expect(page.locator("#supplier-identifier-mapping")).toContainText(
    "Part Number",
    { timeout: 30_000 },
  )
  await expect(
    queryRows(
      page,
      `SELECT count(*) AS relation_count
       FROM information_schema.tables
       WHERE table_name IN ('normalized_supplier', 'normalized_catalog');`,
    ),
  ).resolves.toEqual([{ relation_count: "0" }])
})

test("normalizes EU monetary and percentage-point values deterministically", async ({
  page,
}) => {
  await chooseFiles(page, "normalization-eu-supplier.csv", "normalization-eu-catalog.csv")
  const result = await prepare(page, euConfiguration)

  expect(result).toMatchObject({
    status: "READY",
    quality: {
      supplierRows: 5,
      catalogRows: 5,
      invalidSupplierCosts: 1,
      invalidSellingPrices: 1,
      invalidMarginOverrides: 1,
    },
  })
  await expect(
    queryRows(
      page,
      `SELECT normalized_identifier, CAST(supplier_cost AS VARCHAR) AS supplier_cost,
              is_supplier_cost_valid
       FROM normalized_supplier ORDER BY source_row_id;`,
    ),
  ).resolves.toEqual([
    {
      normalized_identifier: "EU-PLAIN",
      supplier_cost: "1234.5600",
      is_supplier_cost_valid: true,
    },
    {
      normalized_identifier: "EU-GROUP",
      supplier_cost: "1234.5600",
      is_supplier_cost_valid: true,
    },
    {
      normalized_identifier: "EU-ZERO",
      supplier_cost: "0.0000",
      is_supplier_cost_valid: true,
    },
    {
      normalized_identifier: "EU-DOT",
      supplier_cost: "1234.0000",
      is_supplier_cost_valid: true,
    },
    {
      normalized_identifier: "EU-BAD",
      supplier_cost: null,
      is_supplier_cost_valid: false,
    },
  ])
  await expect(
    queryRows(
      page,
      `SELECT normalized_identifier,
              CAST(catalog_margin_override AS VARCHAR) AS catalog_margin_override,
              is_margin_override_valid
       FROM normalized_catalog ORDER BY source_row_id;`,
    ),
  ).resolves.toEqual([
    {
      normalized_identifier: "EU-PLAIN",
      catalog_margin_override: "0.2000",
      is_margin_override_valid: true,
    },
    {
      normalized_identifier: "EU-GROUP",
      catalog_margin_override: "20.5000",
      is_margin_override_valid: true,
    },
    {
      normalized_identifier: "EU-ZERO",
      catalog_margin_override: "0.0000",
      is_margin_override_valid: true,
    },
    {
      normalized_identifier: "EU-DOT",
      catalog_margin_override: "95.0000",
      is_margin_override_valid: true,
    },
    {
      normalized_identifier: "EU-BAD",
      catalog_margin_override: null,
      is_margin_override_valid: false,
    },
  ])
})
