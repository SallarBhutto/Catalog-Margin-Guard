import { ResultsQueryService } from "@/features/results/results-query-service"
import {
  SORT_EXPRESSIONS,
  assertBoundedLimit,
  createHighestRiskPreviewSql,
  createResultsSql,
  escapeLikeSearch,
  validateResultsQuery,
} from "@/features/results/results-query-sql"
import {
  DEFAULT_RESULT_PAGE_SIZE,
  RESULT_PAGE_SIZES,
  type ResultsQuery,
} from "@/features/results/results-query-types"
import type { DuckDBQueryResult } from "@/lib/duckdb/duckdb-types"

const rows = [
  {
    identifier: "KLP-91",
    supplier_cost: "151.0000",
    selling_price: "149.0000",
    gross_margin_percent: "-1.342281879194",
    target_margin_percent: "20.0000",
    target_source: "STORE_DEFAULT",
    price_for_target_margin: "188.75",
    status: "LOSS",
  },
  {
    identifier: "ABC-12",
    supplier_cost: "96.0000",
    selling_price: "105.0000",
    gross_margin_percent: "8.571428571428",
    target_margin_percent: "10.0000",
    target_source: "CATALOG_OVERRIDE",
    price_for_target_margin: "106.67",
    status: "REVIEW",
  },
] as const

function queryResult(
  resultRows: readonly Record<string, unknown>[] = rows,
): DuckDBQueryResult {
  const fields = Object.keys(resultRows[0] ?? rows[0]).map((name) => ({ name }))
  return {
    numRows: resultRows.length,
    schema: { fields },
    getChild: (name) => ({ get: (index) => resultRows[index]?.[name] }),
    getChildAt: (columnIndex) => ({
      get: (rowIndex) => resultRows[rowIndex]?.[fields[columnIndex]?.name ?? ""],
    }),
  }
}

function countResult(totalRows: number): DuckDBQueryResult {
  return queryResult([{ total_rows: BigInt(totalRows) }])
}

function resultsQuery(overrides: Partial<ResultsQuery> = {}): ResultsQuery {
  return {
    status: "ALL",
    targetSource: "ALL",
    sort: "RISK_HIGHEST",
    page: 1,
    pageSize: DEFAULT_RESULT_PAGE_SIZE,
    ...overrides,
  }
}

describe("bounded results query layer", () => {
  it("keeps the anonymous preview explicitly bounded and deterministic", () => {
    const sql = createHighestRiskPreviewSql({ limit: 20, sort: "RISK_HIGHEST" })

    expect(sql).toContain("WHERE status IN ('LOSS', 'REVIEW')")
    expect(sql).toContain("WHEN 'LOSS' THEN 0")
    expect(sql).toContain("WHEN 'REVIEW' THEN 1")
    expect(sql).toContain("gross_margin_pct ASC")
    expect(sql).toContain("display_identifier ASC")
    expect(sql).toContain("catalog_source_row_id ASC")
    expect(sql).toContain("LIMIT 20")
    expect(sql).not.toMatch(/SELECT\s+\*/i)
  })

  it("enforces the preview and full-page bounds in the domain layer", () => {
    expect(DEFAULT_RESULT_PAGE_SIZE).toBe(100)
    expect(RESULT_PAGE_SIZES).toEqual([50, 100, 250])

    for (const value of [0, -1, 251, Number.POSITIVE_INFINITY, 1.5]) {
      expect(() => assertBoundedLimit(value)).toThrow(/bounded result limit/i)
    }
    for (const pageSize of RESULT_PAGE_SIZES) {
      expect(() => validateResultsQuery(resultsQuery({ pageSize }))).not.toThrow()
      expect(createResultsSql(resultsQuery({ pageSize })).rows).toContain(
        `LIMIT ${pageSize}`,
      )
    }
    expect(() =>
      validateResultsQuery(resultsQuery({ pageSize: 75 as ResultsQuery["pageSize"] })),
    ).toThrow(/page size/i)
  })

  it("builds SQL-backed status, target-source, count, and page queries", () => {
    const sql = createResultsSql(
      resultsQuery({
        status: "REVIEW",
        targetSource: "CATALOG_OVERRIDE",
        page: 3,
        pageSize: 50,
      }),
    )

    for (const statement of [sql.count, sql.rows]) {
      expect(statement).toContain("status = 'REVIEW'")
      expect(statement).toContain("target_source = 'CATALOG_OVERRIDE'")
    }
    expect(sql.count).toContain("count(*)::UBIGINT AS total_rows")
    expect(sql.rows).toContain("LIMIT 50")
    expect(sql.rows).toContain("OFFSET 100")
    expect(sql.rows).not.toMatch(/SELECT\s+\*/i)
  })

  it("uses a prepared literal contains pattern and escapes LIKE wildcards", () => {
    const search = "SKU%_\\42"
    const sql = createResultsSql(resultsQuery({ search }))

    expect(escapeLikeSearch(search)).toBe("SKU\\%\\_\\\\42")
    expect(sql.count).toContain("display_identifier ILIKE ? ESCAPE '\\'")
    expect(sql.rows).toContain("display_identifier ILIKE ? ESCAPE '\\'")
    expect(sql.parameters).toEqual(["%SKU\\%\\_\\\\42%"])
    expect(sql.rows).not.toContain(search)
  })

  it("maps every supported sort through a fixed SQL whitelist with stable ties", () => {
    for (const [sort, expression] of Object.entries(SORT_EXPRESSIONS)) {
      const sql = createResultsSql(
        resultsQuery({ sort: sort as ResultsQuery["sort"] }),
      ).rows
      expect(sql).toContain(`ORDER BY ${expression}`)
      expect(sql).toContain("display_identifier ASC")
      expect(sql).toContain("catalog_source_row_id ASC")
    }

    expect(() =>
      createResultsSql(resultsQuery({ sort: "DROP TABLE" as ResultsQuery["sort"] })),
    ).toThrow(/sort/i)
    expect(() =>
      createResultsSql(resultsQuery({ sort: "toString" as ResultsQuery["sort"] })),
    ).toThrow(/sort/i)
  })

  it("returns filtered counts, a bounded page, and DECIMAL strings", async () => {
    const preparedParameters: unknown[][] = []
    const preparedSql: string[] = []
    const close = vi.fn(() => Promise.resolve())
    const prepare = vi.fn((sql: string) => {
      preparedSql.push(sql)
      return Promise.resolve({
        close,
        query: vi.fn((...parameters: unknown[]) => {
          preparedParameters.push(parameters)
          return Promise.resolve(
            sql.includes("total_rows") ? countResult(102) : queryResult(),
          )
        }),
      })
    })
    const service = new ResultsQueryService(
      {
        withConnection: (operation) =>
          operation({ prepare, query: vi.fn(() => Promise.resolve(queryResult())) }),
      },
      vi.fn(),
    )

    const result = await service.getResultsPage(
      resultsQuery({ search: "ABC", page: 2, pageSize: 100 }),
    )

    expect(result).toEqual({
      rows: expect.any(Array),
      totalRows: 102,
      page: 2,
      pageSize: 100,
    })
    expect(result.rows[0]).toEqual({
      identifier: "KLP-91",
      supplierCost: "151.0000",
      sellingPrice: "149.0000",
      grossMarginPercent: "-1.342281879194",
      targetMarginPercent: "20.0000",
      targetSource: "STORE_DEFAULT",
      priceForTargetMargin: "188.75",
      status: "LOSS",
    })
    expect(preparedSql).toHaveLength(2)
    expect(preparedSql[1]).toContain("LIMIT 100")
    expect(preparedSql[1]).toContain("OFFSET 100")
    expect(preparedParameters).toEqual([["%ABC%"], ["%ABC%"]])
    expect(close).toHaveBeenCalledTimes(2)
  })

  it("clamps an impossible page and returns an empty filtered result safely", async () => {
    const preparedSql: string[] = []
    const prepare = vi.fn((sql: string) => {
      preparedSql.push(sql)
      return Promise.resolve({
        close: vi.fn(() => Promise.resolve()),
        query: vi.fn(() =>
          Promise.resolve(sql.includes("total_rows") ? countResult(0) : queryResult([])),
        ),
      })
    })
    const service = new ResultsQueryService({
      withConnection: (operation) =>
        operation({ prepare, query: vi.fn(() => Promise.resolve(queryResult([]))) }),
    })

    await expect(service.getResultsPage(resultsQuery({ page: 99 }))).resolves.toEqual({
      rows: [],
      totalRows: 0,
      page: 1,
      pageSize: 100,
    })
    expect(preparedSql[1]).toContain("OFFSET 0")
  })

  it("continues to map the bounded anonymous preview", async () => {
    const query = vi.fn(() => Promise.resolve(queryResult()))
    const service = new ResultsQueryService(
      {
        withConnection: (operation) =>
          operation({
            query,
            prepare: vi.fn(() => Promise.resolve({ close: vi.fn(), query: vi.fn() })),
          }),
      },
      vi.fn(),
    )

    const result = await service.getHighestRiskPreview({
      limit: 20,
      sort: "RISK_HIGHEST",
    })
    expect(result).toHaveLength(2)
    expect(Object.keys(result[0] ?? {})).not.toContain("match_key")
    expect(query).toHaveBeenCalledOnce()
  })
})
