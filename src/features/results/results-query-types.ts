import type {
  ProductAnalysisStatus,
  TargetSource,
} from "@/features/analysis/margin-analysis-types"

/**
 * Customer-facing, bounded result data only. Financial values cross the
 * DuckDB/Arrow boundary as decimal strings so JavaScript floating-point
 * conversion cannot change their canonical value.
 */
type MarginResultRow = Readonly<{
  rowId: string
  identifier: string
  supplierCost: string
  sellingPrice: string
  grossMarginPercent: string
  targetMarginPercent: string
  targetSource: TargetSource
  storeDefaultMarginPercent: string
  catalogOverrideMarginPercent: string | null
  manualOverrideMarginPercent: string | null
  priceForTargetMargin: string
  status: ProductAnalysisStatus
}>

const RESULT_PAGE_SIZES = [50, 100, 250] as const
const DEFAULT_RESULT_PAGE_SIZE = 100

type ResultPageSize = (typeof RESULT_PAGE_SIZES)[number]
type ResultStatusFilter = "ALL" | ProductAnalysisStatus
type ResultTargetSourceFilter = "ALL" | "STORE_DEFAULT" | "PRODUCT_OVERRIDE"
type ResultSort =
  | "RISK_HIGHEST"
  | "MARGIN_LOWEST"
  | "MARGIN_HIGHEST"
  | "IDENTIFIER_ASC"
  | "IDENTIFIER_DESC"
  | "SUPPLIER_COST_ASC"
  | "SUPPLIER_COST_DESC"
  | "SELLING_PRICE_ASC"
  | "SELLING_PRICE_DESC"
  | "TARGET_MARGIN_ASC"
  | "TARGET_MARGIN_DESC"
  | "PRICE_FOR_TARGET_ASC"
  | "PRICE_FOR_TARGET_DESC"

type HighestRiskPreviewQuery = Readonly<{
  limit: number
  sort: "RISK_HIGHEST"
}>

type ResultsQuery = Readonly<{
  search?: string
  status: ResultStatusFilter
  targetSource: ResultTargetSourceFilter
  sort: ResultSort
  page: number
  pageSize: ResultPageSize
}>

type ResultsPage = Readonly<{
  rows: readonly MarginResultRow[]
  totalRows: number
  page: number
  pageSize: ResultPageSize
}>

export { DEFAULT_RESULT_PAGE_SIZE, RESULT_PAGE_SIZES }
export type {
  HighestRiskPreviewQuery,
  MarginResultRow,
  ResultPageSize,
  ResultSort,
  ResultStatusFilter,
  ResultsPage,
  ResultsQuery,
  ResultTargetSourceFilter,
}
