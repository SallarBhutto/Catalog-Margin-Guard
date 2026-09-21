import { ANALYSIS_RESULTS_RELATION } from "@/features/analysis/margin-analysis-sql"
import { SORT_EXPRESSIONS } from "@/features/results/results-query-sql"

type ReportKind = "PRODUCTS_TO_REVIEW" | "FULL_MARGIN_REPORT"

/** Column names and order defined by the product requirements for both reports. */
const REPORT_COLUMNS = [
  "identifier",
  "supplier_cost",
  "selling_price",
  "gross_margin_percent",
  "target_margin_percent",
  "target_source",
  "price_for_target_margin",
  "status",
] as const

const REPORT_ROW_FILTERS: Readonly<Record<ReportKind, string>> = {
  PRODUCTS_TO_REVIEW: "\nWHERE status IN ('LOSS', 'REVIEW')",
  FULL_MARGIN_REPORT: "",
}

/**
 * One statement per report: it reads the materialized analysis relation, so the effective
 * targets, statuses, and prices are exactly the ones the analysis and manual overrides
 * produced, and a single statement is a single consistent snapshot. Reports deliberately
 * ignore the results table's search, filters, sort, and pagination.
 */
function createReportExportSql(kind: ReportKind) {
  if (!Object.hasOwn(REPORT_ROW_FILTERS, kind)) throw new Error("Unsupported report.")

  return `SELECT
  display_identifier AS identifier,
  CAST(supplier_cost AS VARCHAR) AS supplier_cost,
  CAST(selling_price AS VARCHAR) AS selling_price,
  CAST(CAST(gross_margin_pct AS DECIMAL(38,4)) AS VARCHAR) AS gross_margin_percent,
  CAST(effective_target_margin_pct AS VARCHAR) AS target_margin_percent,
  target_source,
  CAST(price_for_target_margin AS VARCHAR) AS price_for_target_margin,
  status
FROM ${ANALYSIS_RESULTS_RELATION}${REPORT_ROW_FILTERS[kind]}
ORDER BY ${SORT_EXPRESSIONS.RISK_HIGHEST},
  display_identifier ASC,
  catalog_source_row_id ASC;`
}

export { REPORT_COLUMNS, createReportExportSql }
export type { ReportKind }
