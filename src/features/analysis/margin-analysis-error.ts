import type {
  MarginAnalysisErrorCode,
  MarginAnalysisFailure,
} from "@/features/analysis/margin-analysis-types"

const MARGIN_ANALYSIS_ERROR_MESSAGES: Readonly<Record<MarginAnalysisErrorCode, string>> =
  {
    INVALID_CONFIGURATION:
      "The analysis settings are incomplete or no longer valid. Review the setup and try again.",
    NORMALIZATION_FAILED:
      "We couldn't prepare the selected files for local analysis. Review the files and try again.",
    MATCHING_FAILED:
      "We couldn't safely match the product identifiers. Review the selected files and try again.",
    ANALYSIS_FAILED:
      "We couldn't complete the local margin analysis. Review the files and settings and try again.",
  }

class MarginAnalysisError extends Error {
  readonly code: MarginAnalysisErrorCode
  readonly userMessage: string

  constructor(code: MarginAnalysisErrorCode, options?: ErrorOptions) {
    super(MARGIN_ANALYSIS_ERROR_MESSAGES[code], options)
    this.name = "MarginAnalysisError"
    this.code = code
    this.userMessage = MARGIN_ANALYSIS_ERROR_MESSAGES[code]
  }
}

function toMarginAnalysisFailure(error: MarginAnalysisError): MarginAnalysisFailure {
  return {
    status: "ERROR",
    error: { code: error.code, userMessage: error.userMessage },
  }
}

export { MARGIN_ANALYSIS_ERROR_MESSAGES, MarginAnalysisError, toMarginAnalysisFailure }
