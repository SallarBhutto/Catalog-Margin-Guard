import { validateMarginPercentageText } from "@/features/analysis/margin-target-validation"
import { ManualOverrideService } from "@/features/results/manual-override-service"
import type { ManualOverrideError } from "@/features/results/manual-override-service"
import { CLEAR_ALL_MANUAL_OVERRIDES_SQL } from "@/features/results/manual-override-sql"
import type { DuckDBQueryResult } from "@/lib/duckdb/duckdb-types"

function result(
  values: Readonly<Record<string, bigint | string | null>>,
): DuckDBQueryResult {
  const fields = Object.keys(values).map((name) => ({ name }))
  return {
    numRows: 1,
    schema: { fields },
    getChild: (name) => ({ get: () => values[name] }),
    getChildAt: (index) => ({ get: () => values[fields[index]?.name ?? ""] }),
  }
}

const metadataValues: Readonly<Record<string, bigint | string | null>> = {
  products_analyzed: 1n,
  products_at_loss: 0n,
  products_needing_review: 0n,
  products_meeting_target: 1n,
  average_gross_margin_pct: "20.000000000000",
  products_using_store_default_target: 0n,
  products_using_product_specific_target: 1n,
  exposure_below_zero: 0n,
  exposure_zero_to_five: 0n,
  exposure_five_to_ten: 0n,
  exposure_ten_to_fifteen: 0n,
  exposure_fifteen_to_twenty: 0n,
  exposure_twenty_to_thirty: 1n,
  exposure_thirty_and_above: 0n,
  supplier_rows: 1n,
  catalog_rows: 1n,
  matched_products: 1n,
  supplier_only_products: 0n,
  catalog_only_products: 0n,
  supplier_duplicate_identifiers: 0n,
  catalog_duplicate_identifiers: 0n,
  invalid_supplier_costs: 0n,
  invalid_selling_prices: 0n,
  invalid_margin_overrides: 0n,
}

function createHarness(updateGate?: Promise<void>) {
  const executedSql: string[] = []
  const preparedParameters: unknown[][] = []
  const query = vi.fn((sql: string) => {
    executedSql.push(sql)
    return Promise.resolve(
      sql.includes("products_analyzed") ? result(metadataValues) : result({}),
    )
  })
  const prepare = vi.fn((sql: string) =>
    Promise.resolve({
      close: vi.fn(() => Promise.resolve()),
      query: vi.fn(async (...parameters: unknown[]) => {
        preparedParameters.push(parameters)
        if (sql.startsWith("SELECT count(*)")) return result({ total_rows: 1n })
        await updateGate
        return result({})
      }),
    }),
  )
  const service = new ManualOverrideService({
    getSnapshot: () => ({ state: "ready" }),
    withConnection: (operation) => operation({ query, prepare }),
  })
  return { service, executedSql, preparedParameters }
}

describe("manual margin override", () => {
  it.each(["0", "0.20", "10", "20", "35.5", "95"])(
    "accepts percentage-point input %s",
    (value) => {
      expect(validateMarginPercentageText(value)).toEqual({ valid: true, value })
    },
  )

  it.each(["", " ", "-1", "95.01", "96", "abc", "1e1", ".20", "20.00001"])(
    "rejects invalid input %j without clamping",
    (value) => {
      expect(validateMarginPercentageText(value)).toEqual({
        valid: false,
        error: "Margin must be between 0% and 95%.",
      })
    },
  )

  it("blocks an unauthorized mutation before touching DuckDB", async () => {
    const harness = createHarness()
    await expect(
      harness.service.apply("1", "20", { canUseManualOverrides: false }),
    ).rejects.toMatchObject({
      code: "NOT_ALLOWED",
    } satisfies Partial<ManualOverrideError>)
    expect(harness.executedSql).toEqual([])
    expect(harness.preparedParameters).toEqual([])
  })

  it("binds stable row identity and the DECIMAL text without logging business data", async () => {
    const harness = createHarness()
    const updated = await harness.service.apply("42", "0.20", {
      canUseManualOverrides: true,
    })

    expect(updated.metadata.summary.productsMeetingTarget).toBe(1)
    expect(harness.preparedParameters).toEqual([
      ["42"],
      ["0.20", "0.20", "0.20", "0.20", "0.20", "42"],
    ])
    expect(harness.executedSql).toContain("BEGIN TRANSACTION;")
    expect(harness.executedSql).toContain("COMMIT;")
  })

  it("invalidates a late save and follows it with one set-based clear", async () => {
    let release!: () => void
    const updateGate = new Promise<void>((resolve) => {
      release = resolve
    })
    const harness = createHarness(updateGate)
    const save = harness.service.apply("42", "35.5", {
      canUseManualOverrides: true,
    })

    await vi.waitFor(() => expect(harness.preparedParameters).toHaveLength(2))
    const clear = harness.service.cancelPendingAndClear()
    release()

    await expect(save).rejects.toMatchObject({
      code: "STALE",
    } satisfies Partial<ManualOverrideError>)
    await expect(clear).resolves.toMatchObject({ metadata: expect.any(Object) })
    expect(
      harness.executedSql.filter((sql) => sql === CLEAR_ALL_MANUAL_OVERRIDES_SQL),
    ).toHaveLength(1)
  })
})
