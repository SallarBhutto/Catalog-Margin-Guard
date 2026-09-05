import {
  createHighestRiskPreviewSql,
  createResultsSql,
  validateResultsQuery,
} from "@/features/results/results-query-sql"
import type {
  HighestRiskPreviewQuery,
  MarginResultRow,
  ResultsPage,
  ResultsQuery,
} from "@/features/results/results-query-types"
import { duckDBEngine } from "@/lib/duckdb"
import type { DuckDBConnection, DuckDBQueryResult } from "@/lib/duckdb/duckdb-types"

type ResultsQueryConnection = Pick<DuckDBConnection, "prepare" | "query">
type ResultsQueryEngine = Readonly<{
  withConnection<T>(
    operation: (connection: ResultsQueryConnection) => Promise<T>,
  ): Promise<T>
}>

const DECIMAL_PATTERN = /^-?\d+(?:\.\d+)?$/
const STATUSES = new Set(["LOSS", "REVIEW", "OK"])
const TARGET_SOURCES = new Set(["STORE_DEFAULT", "CATALOG_OVERRIDE", "MANUAL_OVERRIDE"])

function readString(result: DuckDBQueryResult, name: string, rowIndex: number) {
  const value = result.getChild(name)?.get(rowIndex)
  if (typeof value !== "string") throw new Error("Invalid result query response.")
  return value
}

function readDecimal(result: DuckDBQueryResult, name: string, rowIndex: number) {
  const value = readString(result, name, rowIndex)
  if (!DECIMAL_PATTERN.test(value)) throw new Error("Invalid decimal result value.")
  return value
}

function readNullableDecimal(result: DuckDBQueryResult, name: string, rowIndex: number) {
  const value = result.getChild(name)?.get(rowIndex)
  if (value == null) return null
  if (typeof value !== "string" || !DECIMAL_PATTERN.test(value)) {
    throw new Error("Invalid decimal result value.")
  }
  return value
}

function mapMarginResultRows(result: DuckDBQueryResult): readonly MarginResultRow[] {
  const rows: MarginResultRow[] = []

  for (let rowIndex = 0; rowIndex < result.numRows; rowIndex += 1) {
    const status = readString(result, "status", rowIndex)
    const targetSource = readString(result, "target_source", rowIndex)

    if (!STATUSES.has(status) || !TARGET_SOURCES.has(targetSource)) {
      throw new Error("Invalid result query response.")
    }

    rows.push({
      rowId: readString(result, "row_id", rowIndex),
      identifier: readString(result, "identifier", rowIndex),
      supplierCost: readDecimal(result, "supplier_cost", rowIndex),
      sellingPrice: readDecimal(result, "selling_price", rowIndex),
      grossMarginPercent: readDecimal(result, "gross_margin_percent", rowIndex),
      targetMarginPercent: readDecimal(result, "target_margin_percent", rowIndex),
      targetSource: targetSource as MarginResultRow["targetSource"],
      storeDefaultMarginPercent: readDecimal(
        result,
        "store_default_margin_percent",
        rowIndex,
      ),
      catalogOverrideMarginPercent: readNullableDecimal(
        result,
        "catalog_override_margin_percent",
        rowIndex,
      ),
      manualOverrideMarginPercent: readNullableDecimal(
        result,
        "manual_override_margin_percent",
        rowIndex,
      ),
      priceForTargetMargin: readDecimal(result, "price_for_target_margin", rowIndex),
      status: status as MarginResultRow["status"],
    })
  }

  return rows
}

function readResultCount(result: DuckDBQueryResult) {
  const value = result.getChild("total_rows")?.get(0)
  const count = typeof value === "bigint" ? Number(value) : value
  if (!Number.isSafeInteger(count) || Number(count) < 0) {
    throw new Error("Invalid result count response.")
  }
  return Number(count)
}

async function runPreparedQuery(
  connection: ResultsQueryConnection,
  sql: string,
  parameters: readonly string[],
) {
  const statement = await connection.prepare(sql)
  try {
    return await statement.query(...parameters)
  } finally {
    await statement.close()
  }
}

class ResultsQueryService {
  constructor(
    private readonly engine: ResultsQueryEngine,
    private readonly log: (message: string) => void = (message) => {
      if (import.meta.env.DEV) console.info(`[Catalog Margin Guard] ${message}`)
    },
  ) {}

  async getHighestRiskPreview(
    query: HighestRiskPreviewQuery,
  ): Promise<readonly MarginResultRow[]> {
    const sql = createHighestRiskPreviewSql(query)
    const result = await this.engine.withConnection((connection) => connection.query(sql))
    const rows = mapMarginResultRows(result)
    this.log("preview query completed")
    return rows
  }

  async getResultsPage(query: ResultsQuery): Promise<ResultsPage> {
    validateResultsQuery(query)

    return this.engine.withConnection(async (connection) => {
      const initialSql = createResultsSql(query)
      const countResult = await runPreparedQuery(
        connection,
        initialSql.count,
        initialSql.parameters,
      )
      const totalRows = readResultCount(countResult)
      const finalPage = Math.max(1, Math.ceil(totalRows / query.pageSize))
      const page = Math.min(query.page, finalPage)
      const sql = page === query.page ? initialSql : createResultsSql(query, page)
      const rowResult = await runPreparedQuery(connection, sql.rows, sql.parameters)
      const rows = mapMarginResultRows(rowResult)

      this.log("results query completed")
      return { rows, totalRows, page, pageSize: query.pageSize }
    })
  }
}

const resultsQueryService = new ResultsQueryService(duckDBEngine)

export { ResultsQueryService, mapMarginResultRows, readResultCount, resultsQueryService }
