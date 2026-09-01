export {
  clearNormalizedInputs,
  normalizedInputService,
  prepareNormalizedInputs,
} from "@/features/analysis/normalization-service"
export {
  clearMarginAnalysis,
  marginAnalysisService,
  runMarginAnalysis,
} from "@/features/analysis/margin-analysis-service"
export { MarginAnalysisError } from "@/features/analysis/margin-analysis-error"
export {
  ANALYSIS_RESULTS_RELATION,
  IDENTIFIER_MATCHES_RELATION,
  UNIQUE_CATALOG_RELATION,
  UNIQUE_SUPPLIER_RELATION,
} from "@/features/analysis/margin-analysis-sql"
export { NormalizationError } from "@/features/analysis/normalization-error"
export {
  NORMALIZED_CATALOG_RELATION,
  NORMALIZED_SUPPLIER_RELATION,
} from "@/features/analysis/normalization-sql"
export type {
  NormalizationDiagnostics,
  NormalizationErrorCode,
  NormalizationQualityCounts,
  NormalizationSuccess,
  NormalizedInputsResult,
  NormalizedRelationMetadata,
} from "@/features/analysis/normalization-types"
export type {
  AnalysisDataQuality,
  AnalysisLifecycleSnapshot,
  AnalysisStage,
  AnalysisSummary,
  MarginAnalysisErrorCode,
  MarginAnalysisFailure,
  MarginAnalysisMetadata,
  MarginAnalysisResult,
  MarginAnalysisSuccess,
  MarginExposure,
  MatchStatus,
  ProductAnalysisStatus,
  TargetSource,
} from "@/features/analysis/margin-analysis-types"
