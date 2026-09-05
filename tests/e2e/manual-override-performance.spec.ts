import { expect, test } from "@playwright/test"

import type { ManualOverrideService } from "../../src/features/results/manual-override-service"
import type { ResultsQueryService } from "../../src/features/results/results-query-service"
import type { DuckDBEngine } from "../../src/lib/duckdb/duckdb-engine"

type BenchmarkResult = Readonly<{
  rows: number
  saveMs: number
  pageRefreshMs: number
  removeMs: number
  clearAllMs: number
  manualRowsAfterClear: number
}>

test("benchmarks bounded manual-target mutations at 10k, 100k, and 500k rows", async ({
  page,
}) => {
  test.setTimeout(120_000)
  await page.goto("/check")
  await expect(page.getByTestId("engine-readiness")).toHaveText(
    "Local analysis is ready.",
    { timeout: 30_000 },
  )

  const benchmarks = await page.evaluate<BenchmarkResult[]>(async () => {
    const duckdbPath = "/src/lib/duckdb/index.ts"
    const overridePath = "/src/features/results/manual-override-service.ts"
    const resultsPath = "/src/features/results/results-query-service.ts"
    const [{ duckDBEngine }, { manualOverrideService }, { resultsQueryService }] =
      (await Promise.all([
        import(/* @vite-ignore */ duckdbPath),
        import(/* @vite-ignore */ overridePath),
        import(/* @vite-ignore */ resultsPath),
      ])) as [
        { duckDBEngine: DuckDBEngine },
        { manualOverrideService: ManualOverrideService },
        { resultsQueryService: ResultsQueryService },
      ]

    const access = { canUseManualOverrides: true }
    const output: BenchmarkResult[] = []

    for (const rows of [10_000, 100_000, 500_000]) {
      await duckDBEngine.withConnection(async (connection) => {
        for (const relation of [
          "analysis_results",
          "identifier_matches",
          "normalized_catalog",
          "normalized_supplier",
        ]) {
          await connection.query(`DROP TABLE IF EXISTS ${relation};`)
        }

        await connection.query(`CREATE TABLE normalized_supplier AS
          SELECT
            CAST(i AS VARCHAR) AS normalized_identifier,
            false AS is_duplicate_identifier,
            true AS is_supplier_cost_valid
          FROM range(1, ${rows + 1}) AS source(i);`)
        await connection.query(`CREATE TABLE normalized_catalog AS
          SELECT
            CAST(i AS VARCHAR) AS normalized_identifier,
            false AS is_duplicate_identifier,
            true AS is_selling_price_valid,
            true AS is_margin_override_valid
          FROM range(1, ${rows + 1}) AS source(i);`)
        await connection.query(`CREATE TABLE identifier_matches AS
          SELECT 'MATCHED' AS match_status
          FROM range(1, ${rows + 1});`)
        await connection.query(`CREATE TABLE analysis_results AS
          SELECT
            CAST(i AS VARCHAR) AS match_key,
            'SYNTHETIC-' || CAST(i AS VARCHAR) AS display_identifier,
            CAST(i AS UBIGINT) AS supplier_source_row_id,
            CAST(i AS UBIGINT) AS catalog_source_row_id,
            CAST(80 AS DECIMAL(18,4)) AS supplier_cost,
            CAST(100 AS DECIMAL(18,4)) AS selling_price,
            CAST(20 AS DECIMAL(18,4)) AS gross_profit,
            CAST(20 AS DECIMAL(38,12)) AS gross_margin_pct,
            CAST(20 AS DECIMAL(7,4)) AS store_default_margin_pct,
            CASE WHEN i % 10 = 0 THEN CAST(15 AS DECIMAL(7,4))
              ELSE CAST(NULL AS DECIMAL(7,4)) END AS catalog_override_margin_pct,
            CAST(NULL AS DECIMAL(7,4)) AS manual_override_margin_pct,
            CASE WHEN i % 10 = 0 THEN CAST(15 AS DECIMAL(7,4))
              ELSE CAST(20 AS DECIMAL(7,4)) END AS effective_target_margin_pct,
            CASE WHEN i % 10 = 0 THEN 'CATALOG_OVERRIDE'
              ELSE 'STORE_DEFAULT' END AS target_source,
            CAST(100 AS DECIMAL(18,2)) AS price_for_target_margin,
            'OK' AS status
          FROM range(1, ${rows + 1}) AS source(i);`)
      })

      const rowId = String(rows)
      let started = performance.now()
      await manualOverrideService.apply(rowId, "35.5", access)
      const saveMs = performance.now() - started

      started = performance.now()
      await resultsQueryService.getResultsPage({
        status: "ALL",
        targetSource: "ALL",
        sort: "RISK_HIGHEST",
        page: 1,
        pageSize: 100,
      })
      const pageRefreshMs = performance.now() - started

      started = performance.now()
      await manualOverrideService.remove(rowId, access)
      const removeMs = performance.now() - started

      await manualOverrideService.apply("1", "10", access)
      await manualOverrideService.apply("2", "30", access)
      started = performance.now()
      await manualOverrideService.cancelPendingAndClear()
      const clearAllMs = performance.now() - started

      const manualRowsAfterClear = await duckDBEngine.withConnection(
        async (connection) => {
          const result = await connection.query(
            "SELECT count(*)::INTEGER AS count FROM analysis_results WHERE manual_override_margin_pct IS NOT NULL;",
          )
          return Number(result.getChild("count")?.get(0))
        },
      )

      output.push({
        rows,
        saveMs,
        pageRefreshMs,
        removeMs,
        clearAllMs,
        manualRowsAfterClear,
      })
    }

    return output
  })

  console.info("Manual override benchmark", JSON.stringify(benchmarks))
  expect(benchmarks.map(({ rows }) => rows)).toEqual([10_000, 100_000, 500_000])
  expect(benchmarks.every(({ manualRowsAfterClear }) => manualRowsAfterClear === 0)).toBe(
    true,
  )
  expect(
    benchmarks.every(({ saveMs, pageRefreshMs, removeMs, clearAllMs }) =>
      [saveMs, pageRefreshMs, removeMs, clearAllMs].every(
        (duration) => Number.isFinite(duration) && duration >= 0,
      ),
    ),
  ).toBe(true)
})
