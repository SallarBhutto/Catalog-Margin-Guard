import { MarginAnalysisService } from "@/features/analysis/margin-analysis-service"
import type { MarginAnalysisEngine } from "@/features/analysis/margin-analysis-types"
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

function metadataResult(): DuckDBQueryResult {
  const values: Readonly<Record<string, bigint | string | null>> = {
    products_analyzed: 3n,
    products_at_loss: 1n,
    products_needing_review: 1n,
    products_meeting_target: 1n,
    average_gross_margin_pct: "14.486091580378",
    products_using_store_default_target: 1n,
    products_using_product_specific_target: 2n,
    exposure_below_zero: 1n,
    exposure_zero_to_five: 0n,
    exposure_five_to_ten: 1n,
    exposure_ten_to_fifteen: 0n,
    exposure_fifteen_to_twenty: 0n,
    exposure_twenty_to_thirty: 0n,
    exposure_thirty_and_above: 1n,
    supplier_rows: 5n,
    catalog_rows: 5n,
    matched_products: 4n,
    supplier_only_products: 1n,
    catalog_only_products: 1n,
    supplier_duplicate_identifiers: 0n,
    catalog_duplicate_identifiers: 0n,
    invalid_supplier_costs: 1n,
    invalid_selling_prices: 0n,
    invalid_margin_overrides: 1n,
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
    Promise.resolve(sql.startsWith("SELECT\n") ? metadataResult() : metadataResult()),
  )
  const engine: MarginAnalysisEngine = {
    getSnapshot: () => ({ state: engineState }),
    subscribe: (listener) => {
      engineListeners.add(listener)
      return () => engineListeners.delete(listener)
    },
    withConnection: (operation) => operation({ query }),
  }
  const normalizedInputs = {
    prepare: vi.fn(() =>
      Promise.resolve({
        status: "READY" as const,
        relations: {
          supplier: { name: "normalized_supplier" as const, rowCount: 5 },
          catalog: { name: "normalized_catalog" as const, rowCount: 5 },
        },
        quality: {
          supplierRows: 5,
          catalogRows: 5,
          supplierDuplicateIdentifiers: 0,
          catalogDuplicateIdentifiers: 0,
          invalidSupplierCosts: 1,
          invalidSellingPrices: 0,
          invalidMarginOverrides: 1,
        },
        diagnostics: {
          invalidSupplierIdentifiers: 0,
          invalidCatalogIdentifiers: 0,
        },
      }),
    ),
  }
  const inspectionService = {
    onInputsInvalidated: (listener: () => void | Promise<void>) => {
      invalidationListener = listener
      return () => {
        invalidationListener = null
      }
    },
  }
  const service = new MarginAnalysisService(
    engine,
    normalizedInputs,
    inspectionService,
    vi.fn(),
  )

  return {
    service,
    query,
    normalizedInputs,
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

describe("margin analysis service", () => {
  it("returns compact aggregate metadata and owns explicit lifecycle state", async () => {
    const harness = createHarness()

    await expect(harness.service.run(configuration)).resolves.toMatchObject({
      status: "READY",
      relations: {
        matches: { name: "identifier_matches", rowCount: 6 },
        results: { name: "analysis_results", rowCount: 3 },
      },
      metadata: {
        summary: {
          productsAnalyzed: 3,
          productsAtLoss: 1,
          productsNeedingReview: 1,
          productsMeetingTarget: 1,
          averageGrossMarginPct: "14.486091580378",
        },
      },
    })
    expect(harness.service.getSnapshot().state).toBe("ready")
    expect(
      harness.query.mock.calls.some(([sql]) =>
        /^SELECT \* FROM (analysis_results|identifier_matches)/.test(sql),
      ),
    ).toBe(false)
  })

  it("clears stale relations before every run and on input invalidation", async () => {
    const harness = createHarness()
    await harness.service.run(configuration)
    await harness.service.run({
      ...configuration,
      options: { ...configuration.options, storeDefaultMargin: 25 },
    })

    expect(
      harness.query.mock.calls.filter(([sql]) =>
        sql.includes("DROP TABLE IF EXISTS analysis_results"),
      ),
    ).toHaveLength(2)

    harness.query.mockClear()
    await harness.invalidate()
    expect(harness.service.getLatestResult()).toBeNull()
    expect(harness.service.getSnapshot().state).toBe("idle")
    expect(harness.query).toHaveBeenCalledWith("DROP TABLE IF EXISTS analysis_results;")
  })

  it("returns a controlled configuration error before normalization", async () => {
    const harness = createHarness()

    await expect(
      harness.service.run({
        ...configuration,
        options: { ...configuration.options, storeDefaultMargin: 96 },
      }),
    ).resolves.toEqual({
      status: "ERROR",
      error: {
        code: "INVALID_CONFIGURATION",
        userMessage:
          "The analysis settings are incomplete or no longer valid. Review the setup and try again.",
      },
    })
    expect(harness.normalizedInputs.prepare).not.toHaveBeenCalled()
  })

  it("forgets readiness when the engine is disposed", async () => {
    const harness = createHarness()
    await harness.service.run(configuration)

    harness.setEngineState("disposed")

    expect(harness.service.getLatestResult()).toBeNull()
    expect(harness.service.getSnapshot().state).toBe("idle")
  })
})
