import type { DuckDBQueryResult } from "@/lib/duckdb/duckdb-types"

type NormalizedRelationName = "normalized_supplier" | "normalized_catalog"

type NormalizedRelationMetadata = Readonly<{
  name: NormalizedRelationName
  rowCount: number
}>

type NormalizationQualityCounts = Readonly<{
  supplierRows: number
  catalogRows: number
  supplierDuplicateIdentifiers: number
  catalogDuplicateIdentifiers: number
  invalidSupplierCosts: number
  invalidSellingPrices: number
  invalidMarginOverrides: number
}>

type NormalizationDiagnostics = Readonly<{
  invalidSupplierIdentifiers: number
  invalidCatalogIdentifiers: number
}>

type NormalizationErrorCode =
  | "INVALID_CONFIGURATION"
  | "INPUT_NOT_READY"
  | "COLUMN_NOT_FOUND"
  | "NORMALIZATION_FAILED"

type NormalizationFailure = Readonly<{
  status: "ERROR"
  error: Readonly<{
    code: NormalizationErrorCode
    userMessage: string
  }>
}>

type NormalizationSuccess = Readonly<{
  status: "READY"
  relations: Readonly<{
    supplier: NormalizedRelationMetadata
    catalog: NormalizedRelationMetadata
  }>
  quality: NormalizationQualityCounts
  diagnostics: NormalizationDiagnostics
}>

type NormalizedInputsResult = NormalizationSuccess | NormalizationFailure

type NormalizationEngine = Readonly<{
  getSnapshot(): Readonly<{ state: string }>
  subscribe(listener: () => void): () => void
  withConnection<T>(
    operation: (connection: {
      query(sql: string): Promise<DuckDBQueryResult>
    }) => Promise<T>,
  ): Promise<T>
}>

export type {
  NormalizationDiagnostics,
  NormalizationEngine,
  NormalizationErrorCode,
  NormalizationFailure,
  NormalizationQualityCounts,
  NormalizationSuccess,
  NormalizedInputsResult,
  NormalizedRelationMetadata,
  NormalizedRelationName,
}
