import { ANALYSIS_RESULTS_RELATION } from "@/features/analysis/margin-analysis-sql"
import {
  RESULT_PAGE_SIZES,
  type HighestRiskPreviewQuery,
  type ResultSort,
  type ResultsQuery,
} from "@/features/results/results-query-types"

const MAX_BOUNDED_RESULT_ROWS = 250

function assertBoundedLimit(limit: number) {
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > MAX_BOUNDED_RESULT_ROWS) {
    throw new Error("A bounded result limit between 1 and 250 is required.")
  }
}

function createHighestRiskPreviewSql(query: HighestRiskPreviewQuery) {
  assertBoundedLimit(query.limit)

  if (query.sort !== "RISK_HIGHEST") throw new Error("Unsupported result sort.")

  return `SELECT
  CAST(catalog_source_row_id AS VARCHAR) AS row_id,
  display_identifier AS identifier,
  CAST(supplier_cost AS VARCHAR) AS supplier_cost,
  CAST(selling_price AS VARCHAR) AS selling_price,
  CAST(gross_margin_pct AS VARCHAR) AS gross_margin_percent,
  CAST(effective_target_margin_pct AS VARCHAR) AS target_margin_percent,
  target_source,
  CAST(store_default_margin_pct AS VARCHAR) AS store_default_margin_percent,
  CAST(catalog_override_margin_pct AS VARCHAR) AS catalog_override_margin_percent,
  CAST(manual_override_margin_pct AS VARCHAR) AS manual_override_margin_percent,
  CAST(price_for_target_margin AS VARCHAR) AS price_for_target_margin,
  status
FROM ${ANALYSIS_RESULTS_RELATION}
WHERE status IN ('LOSS', 'REVIEW')
ORDER BY
  CASE status
    WHEN 'LOSS' THEN 0
    WHEN 'REVIEW' THEN 1
    WHEN 'OK' THEN 2
    ELSE 3
  END,
  gross_margin_pct ASC,
  display_identifier ASC,
  catalog_source_row_id ASC
LIMIT ${query.limit};`
}

const STATUS_FILTERS = new Set(["ALL", "LOSS", "REVIEW", "OK"])
const TARGET_SOURCE_FILTERS = new Set(["ALL", "STORE_DEFAULT", "PRODUCT_OVERRIDE"])

const SORT_EXPRESSIONS: Readonly<Record<ResultSort, string>> = {
  RISK_HIGHEST: `CASE status
    WHEN 'LOSS' THEN 0
    WHEN 'REVIEW' THEN 1
    WHEN 'OK' THEN 2
    ELSE 3
  END ASC, gross_margin_pct ASC`,
  MARGIN_LOWEST: "gross_margin_pct ASC",
  MARGIN_HIGHEST: "gross_margin_pct DESC",
  IDENTIFIER_ASC: "display_identifier ASC",
  IDENTIFIER_DESC: "display_identifier DESC",
  SUPPLIER_COST_ASC: "supplier_cost ASC",
  SUPPLIER_COST_DESC: "supplier_cost DESC",
  SELLING_PRICE_ASC: "selling_price ASC",
  SELLING_PRICE_DESC: "selling_price DESC",
  TARGET_MARGIN_ASC: "effective_target_margin_pct ASC",
  TARGET_MARGIN_DESC: "effective_target_margin_pct DESC",
  PRICE_FOR_TARGET_ASC: "price_for_target_margin ASC",
  PRICE_FOR_TARGET_DESC: "price_for_target_margin DESC",
}

type ResultsSql = Readonly<{
  count: string
  rows: string
  parameters: readonly string[]
}>

function escapeLikeSearch(search: string) {
  return search.replaceAll("\\", "\\\\").replaceAll("%", "\\%").replaceAll("_", "\\_")
}

function validateResultsQuery(query: ResultsQuery) {
  if (!Number.isSafeInteger(query.page) || query.page < 1) {
    throw new Error("A positive result page is required.")
  }
  if (!(RESULT_PAGE_SIZES as readonly number[]).includes(query.pageSize)) {
    throw new Error("Unsupported result page size.")
  }
  if (!STATUS_FILTERS.has(query.status)) throw new Error("Unsupported status filter.")
  if (!TARGET_SOURCE_FILTERS.has(query.targetSource)) {
    throw new Error("Unsupported target source filter.")
  }
  if (!Object.hasOwn(SORT_EXPRESSIONS, query.sort)) {
    throw new Error("Unsupported result sort.")
  }
}

function createResultsSql(query: ResultsQuery, page = query.page): ResultsSql {
  validateResultsQuery(query)
  if (!Number.isSafeInteger(page) || page < 1) {
    throw new Error("A positive result page is required.")
  }

  const filters: string[] = []
  const parameters: string[] = []
  const search = query.search?.trim()

  if (search) {
    filters.push("display_identifier ILIKE ? ESCAPE '\\'")
    parameters.push(`%${escapeLikeSearch(search)}%`)
  }
  if (query.status !== "ALL") filters.push(`status = '${query.status}'`)
  if (query.targetSource !== "ALL") {
    filters.push(
      query.targetSource === "STORE_DEFAULT"
        ? "target_source = 'STORE_DEFAULT'"
        : "target_source IN ('CATALOG_OVERRIDE', 'MANUAL_OVERRIDE')",
    )
  }

  const where = filters.length ? `\nWHERE ${filters.join("\n  AND ")}` : ""
  const offset = (page - 1) * query.pageSize
  if (!Number.isSafeInteger(offset)) throw new Error("Result page is too large.")

  return {
    count: `SELECT count(*)::UBIGINT AS total_rows
FROM ${ANALYSIS_RESULTS_RELATION}${where};`,
    rows: `SELECT
  CAST(catalog_source_row_id AS VARCHAR) AS row_id,
  display_identifier AS identifier,
  CAST(supplier_cost AS VARCHAR) AS supplier_cost,
  CAST(selling_price AS VARCHAR) AS selling_price,
  CAST(gross_margin_pct AS VARCHAR) AS gross_margin_percent,
  CAST(effective_target_margin_pct AS VARCHAR) AS target_margin_percent,
  target_source,
  CAST(store_default_margin_pct AS VARCHAR) AS store_default_margin_percent,
  CAST(catalog_override_margin_pct AS VARCHAR) AS catalog_override_margin_percent,
  CAST(manual_override_margin_pct AS VARCHAR) AS manual_override_margin_percent,
  CAST(price_for_target_margin AS VARCHAR) AS price_for_target_margin,
  status
FROM ${ANALYSIS_RESULTS_RELATION}${where}
ORDER BY ${SORT_EXPRESSIONS[query.sort]},
  display_identifier ASC,
  catalog_source_row_id ASC
LIMIT ${query.pageSize}
OFFSET ${offset};`,
    parameters,
  }
}

export {
  MAX_BOUNDED_RESULT_ROWS,
  SORT_EXPRESSIONS,
  assertBoundedLimit,
  createHighestRiskPreviewSql,
  createResultsSql,
  escapeLikeSearch,
  validateResultsQuery,
}
