import type {
  NormalizationErrorCode,
  NormalizationFailure,
} from "@/features/analysis/normalization-types"

const NORMALIZATION_ERROR_MESSAGES: Readonly<Record<NormalizationErrorCode, string>> = {
  INVALID_CONFIGURATION:
    "The analysis settings are incomplete or no longer valid. Review the setup and try again.",
  INPUT_NOT_READY:
    "Both local files must be inspected and ready before analysis can be prepared.",
  COLUMN_NOT_FOUND:
    "A mapped column is no longer available. Review the column mappings and try again.",
  NORMALIZATION_FAILED:
    "We couldn't prepare the selected files for local analysis. Review the files and try again.",
}

class NormalizationError extends Error {
  readonly code: NormalizationErrorCode
  readonly userMessage: string

  constructor(code: NormalizationErrorCode, options?: ErrorOptions) {
    super(NORMALIZATION_ERROR_MESSAGES[code], options)
    this.name = "NormalizationError"
    this.code = code
    this.userMessage = NORMALIZATION_ERROR_MESSAGES[code]
  }
}

function asNormalizationError(error: unknown): NormalizationError {
  if (error instanceof NormalizationError) return error

  if (
    error instanceof Error &&
    error.message === "Column is not present in the discovered schema"
  ) {
    return new NormalizationError("COLUMN_NOT_FOUND", { cause: error })
  }

  return new NormalizationError("NORMALIZATION_FAILED", { cause: error })
}

function toNormalizationFailure(error: NormalizationError): NormalizationFailure {
  return {
    status: "ERROR",
    error: { code: error.code, userMessage: error.userMessage },
  }
}

export {
  NORMALIZATION_ERROR_MESSAGES,
  NormalizationError,
  asNormalizationError,
  toNormalizationFailure,
}
