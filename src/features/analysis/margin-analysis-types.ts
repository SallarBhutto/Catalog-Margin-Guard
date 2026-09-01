import type { DuckDBQueryResult } from "@/lib/duckdb/duckdb-types"

type MatchStatus = "MATCHED" | "SUPPLIER_ONLY" | "CATALOG_ONLY"
type ProductAnalysisStatus = "LOSS" | "REVIEW" | "OK"
type TargetSource = "CATALOG_OVERRIDE" | "STORE_DEFAULT"

type AnalysisRelationName =
  | "unique_supplier_identifiers"
  | "unique_catalog_identifiers"
  | "identifier_matches"
  | "analysis_results"

type AnalysisRelationMetadata = Readonly<{
  name: AnalysisRelationName
  rowCount: number
}>

type AnalysisSummary = Readonly<{
  productsAnalyzed: number
  productsAtLoss: number
  productsNeedingReview: number
  productsMeetingTarget: number
  averageGrossMarginPct: string | null
  productsUsingStoreDefaultTarget: number
  productsUsingProductSpecificTarget: number
}>

type MarginExposure = Readonly<{
  belowZero: number
  zeroToFive: number
  fiveToTen: number
  tenToFifteen: number
  fifteenToTwenty: number
  twentyToThirty: number
  thirtyAndAbove: number
}>

type AnalysisDataQuality = Readonly<{
  supplierRows: number
  catalogRows: number
  matchedProducts: number
  supplierOnlyProducts: number
  catalogOnlyProducts: number
  supplierDuplicateIdentifiers: number
  catalogDuplicateIdentifiers: number
  invalidSupplierCosts: number
  invalidSellingPrices: number
  invalidMarginOverrides: number
}>

type MarginAnalysisMetadata = Readonly<{
  summary: AnalysisSummary
  exposure: MarginExposure
  dataQuality: AnalysisDataQuality
}>

type MarginAnalysisErrorCode =
  "INVALID_CONFIGURATION" | "NORMALIZATION_FAILED" | "MATCHING_FAILED" | "ANALYSIS_FAILED"

type MarginAnalysisFailure = Readonly<{
  status: "ERROR"
  error: Readonly<{
    code: MarginAnalysisErrorCode
    userMessage: string
  }>
}>

type MarginAnalysisSuccess = Readonly<{
  status: "READY"
  relations: Readonly<{
    matches: AnalysisRelationMetadata
    results: AnalysisRelationMetadata
  }>
  metadata: MarginAnalysisMetadata
}>

type MarginAnalysisResult = MarginAnalysisSuccess | MarginAnalysisFailure

type AnalysisStage = "preparing" | "analyzing" | "preparing-results"

type AnalysisLifecycleSnapshot =
  | Readonly<{ state: "idle"; error: null; metadata: null }>
  | Readonly<{
      state: "running"
      stage: AnalysisStage
      error: null
      metadata: null
    }>
  | Readonly<{
      state: "ready"
      error: null
      metadata: MarginAnalysisMetadata
    }>
  | Readonly<{
      state: "error"
      error: MarginAnalysisFailure["error"]
      metadata: null
    }>

type MarginAnalysisEngine = Readonly<{
  getSnapshot(): Readonly<{ state: string }>
  subscribe(listener: () => void): () => void
  withConnection<T>(
    operation: (connection: {
      query(sql: string): Promise<DuckDBQueryResult>
    }) => Promise<T>,
  ): Promise<T>
}>

export type {
  AnalysisDataQuality,
  AnalysisLifecycleSnapshot,
  AnalysisStage,
  AnalysisRelationMetadata,
  AnalysisRelationName,
  AnalysisSummary,
  MarginAnalysisEngine,
  MarginAnalysisErrorCode,
  MarginAnalysisFailure,
  MarginAnalysisMetadata,
  MarginAnalysisResult,
  MarginAnalysisSuccess,
  MarginExposure,
  MatchStatus,
  ProductAnalysisStatus,
  TargetSource,
}
