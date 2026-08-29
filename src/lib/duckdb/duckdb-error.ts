export type DuckDBEngineErrorCode =
  "DUCKDB_INITIALIZATION_FAILED" | "DUCKDB_HEALTH_CHECK_FAILED" | "DUCKDB_ENGINE_DISPOSED"

const ERROR_MESSAGES: Readonly<Record<DuckDBEngineErrorCode, string>> = {
  DUCKDB_INITIALIZATION_FAILED:
    "We couldn't prepare local analysis in this browser. Try again or use a current desktop browser.",
  DUCKDB_HEALTH_CHECK_FAILED:
    "Local analysis did not start correctly. Try preparing it again.",
  DUCKDB_ENGINE_DISPOSED:
    "This local analysis session has ended. Start a new session to continue.",
}

class DuckDBEngineError extends Error {
  readonly code: DuckDBEngineErrorCode
  readonly userMessage: string

  constructor(code: DuckDBEngineErrorCode, options?: ErrorOptions) {
    super(ERROR_MESSAGES[code], options)
    this.name = "DuckDBEngineError"
    this.code = code
    this.userMessage = ERROR_MESSAGES[code]
  }
}

function asDuckDBEngineError(
  error: unknown,
  code: DuckDBEngineErrorCode,
): DuckDBEngineError {
  return error instanceof DuckDBEngineError
    ? error
    : new DuckDBEngineError(code, { cause: error })
}

export { asDuckDBEngineError, DuckDBEngineError }
