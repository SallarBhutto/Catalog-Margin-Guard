type FileInspectionErrorCode =
  | "UNSUPPORTED_FILE_FORMAT"
  | "FILE_EMPTY"
  | "CSV_PARSE_FAILED"
  | "NO_HEADER_ROW"
  | "DUPLICATE_COLUMN_NAMES"
  | "OUT_OF_MEMORY"
  | "UNKNOWN_PROCESSING_ERROR"

const ERROR_MESSAGES: Readonly<Record<FileInspectionErrorCode, string>> = {
  UNSUPPORTED_FILE_FORMAT:
    "Choose a CSV or TSV file. Excel and other file formats are not supported in this step.",
  FILE_EMPTY: "This file is empty. Choose a CSV or TSV file that contains a header row.",
  CSV_PARSE_FAILED:
    "We couldn't read this file. Check that it is a valid CSV or TSV with a consistent delimiter.",
  NO_HEADER_ROW:
    "We couldn't identify a usable header row. Add column names to the first row and try again.",
  DUPLICATE_COLUMN_NAMES:
    "This file has duplicate column names. Rename each column so every header is unique, then try again.",
  OUT_OF_MEMORY:
    "This browser ran out of memory while reading the file. Try a desktop computer or close memory-heavy tabs.",
  UNKNOWN_PROCESSING_ERROR:
    "We couldn't inspect this file locally. Check the file and try again in a current desktop browser.",
}

class FileInspectionError extends Error {
  readonly code: FileInspectionErrorCode
  readonly userMessage: string

  constructor(code: FileInspectionErrorCode, options?: ErrorOptions) {
    super(ERROR_MESSAGES[code], options)
    this.name = "FileInspectionError"
    this.code = code
    this.userMessage = ERROR_MESSAGES[code]
  }
}

function asFileInspectionError(error: unknown): FileInspectionError {
  if (error instanceof FileInspectionError) return error

  const message = error instanceof Error ? error.message.toLowerCase() : ""
  if (message.includes("out of memory") || message.includes("memory limit")) {
    return new FileInspectionError("OUT_OF_MEMORY", { cause: error })
  }

  return new FileInspectionError("CSV_PARSE_FAILED", { cause: error })
}

export { asFileInspectionError, FileInspectionError }
export type { FileInspectionErrorCode }
