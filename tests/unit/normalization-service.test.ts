import { NormalizedInputService } from "@/features/analysis/normalization-service"
import type { NormalizationEngine } from "@/features/analysis/normalization-types"
import type { AnalysisConfiguration } from "@/features/setup/analysis-configuration"
import type { DuckDBQueryResult } from "@/lib/duckdb/duckdb-types"

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

function qualityResult(): DuckDBQueryResult {
  const values: Readonly<Record<string, bigint>> = {
    supplier_rows: 8n,
    catalog_rows: 11n,
    supplier_duplicate_identifiers: 1n,
    catalog_duplicate_identifiers: 1n,
    invalid_supplier_costs: 2n,
    invalid_selling_prices: 2n,
    invalid_margin_overrides: 3n,
    invalid_supplier_identifiers: 1n,
    invalid_catalog_identifiers: 1n,
  }
  const fields = Object.keys(values).map((name) => ({ name }))

  return {
    numRows: 1,
    schema: { fields },
    getChild: (name) => ({ get: () => values[name] }),
    getChildAt: (index) => ({ get: () => values[fields[index]?.name ?? ""] }),
  }
}

function createHarness() {
  let engineState = "ready"
  let invalidationListener: (() => void | Promise<void>) | null = null
  const engineListeners = new Set<() => void>()
  const query = vi.fn((sql: string) =>
    Promise.resolve(sql.startsWith("SELECT\n") ? qualityResult() : qualityResult()),
  )
  const engine: NormalizationEngine = {
    getSnapshot: () => ({ state: engineState }),
    subscribe: (listener) => {
      engineListeners.add(listener)
      return () => engineListeners.delete(listener)
    },
    withConnection: (operation) => operation({ query }),
  }
  const inspectionService = {
    getRegisteredInput: (role: "supplier" | "catalog") => ({
      internalName: `${role}-input.csv`,
      delimiter: ",",
      columns: role === "supplier" ? ["sku", "cost"] : ["sku", "price", "margin"],
    }),
    onInputsInvalidated: (listener: () => void | Promise<void>) => {
      invalidationListener = listener
      return () => {
        invalidationListener = null
      }
    },
  }
  const service = new NormalizedInputService(engine, inspectionService, vi.fn())

  return {
    service,
    query,
    invalidate: async () => {
      const listener = invalidationListener
      if (listener) await listener()
    },
    setEngineState: (state: string) => {
      engineState = state
      for (const listener of engineListeners) listener()
    },
  }
}

describe("normalized input service", () => {
  it("returns compact relation metadata and aggregate counts", async () => {
    const harness = createHarness()

    await expect(harness.service.prepare(configuration)).resolves.toEqual({
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
    expect(
      harness.query.mock.calls.some(([sql]) =>
        /^SELECT \* FROM normalized_(supplier|catalog)/.test(sql),
      ),
    ).toBe(false)
  })

  it("drops existing relations before every rebuild", async () => {
    const harness = createHarness()

    await harness.service.prepare(configuration)
    await harness.service.prepare({
      ...configuration,
      options: { ...configuration.options, caseInsensitive: false },
    })

    expect(
      harness.query.mock.calls.filter(([sql]) =>
        sql.includes("DROP TABLE IF EXISTS normalized_supplier"),
      ),
    ).toHaveLength(2)
    expect(
      harness.query.mock.calls.filter(([sql]) =>
        sql.includes("CREATE TABLE normalized_supplier"),
      ),
    ).toHaveLength(2)
  })

  it("clears normalized state when a registered source is invalidated", async () => {
    const harness = createHarness()
    await harness.service.prepare(configuration)
    harness.query.mockClear()

    await harness.invalidate()

    expect(harness.service.getLatestResult()).toBeNull()
    expect(harness.query).toHaveBeenCalledWith(
      "DROP TABLE IF EXISTS normalized_supplier;",
    )
    expect(harness.query).toHaveBeenCalledWith("DROP TABLE IF EXISTS normalized_catalog;")
  })

  it("maps stale columns to a controlled error without exposing raw SQL", async () => {
    const harness = createHarness()
    const result = await harness.service.prepare({
      ...configuration,
      mapping: { ...configuration.mapping, supplierCost: "private missing column" },
    })

    expect(result).toEqual({
      status: "ERROR",
      error: {
        code: "COLUMN_NOT_FOUND",
        userMessage:
          "A mapped column is no longer available. Review the column mappings and try again.",
      },
    })
    expect(JSON.stringify(result)).not.toContain("private missing column")
  })

  it("forgets readiness metadata when the DuckDB engine is disposed", async () => {
    const harness = createHarness()
    await harness.service.prepare(configuration)

    harness.setEngineState("disposed")

    expect(harness.service.getLatestResult()).toBeNull()
  })
})
