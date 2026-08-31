import { FILE_INSPECTION } from "@/app/config"
import { suggestColumns } from "@/features/file-inspection/column-suggestions"
import {
  asFileInspectionError,
  FileInspectionError,
} from "@/features/file-inspection/file-inspection-error"
import type {
  DelimitedFileFormat,
  FileInspectionResult,
  FileRole,
  PreviewRow,
} from "@/features/file-inspection/file-inspection-types"
import {
  createInternalFilename,
  getFileWarning,
  validateDelimitedFile,
} from "@/features/file-inspection/file-validation"
import { duckDBEngine } from "@/lib/duckdb"
import type { DuckDBConnection, DuckDBQueryResult } from "@/lib/duckdb/duckdb-types"
import { quoteSqlString } from "@/lib/security/sql-identifiers"

type FileInspectionEngine = Pick<
  typeof duckDBEngine,
  "registerBrowserFile" | "dropRegisteredFile" | "withConnection"
>

type RegisteredInput = Readonly<{
  internalName: string
}>

const SUPPORTED_DELIMITERS = new Set([",", ";", "|", "\t"])

function duckDBValueToString(value: unknown) {
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "bigint" ||
    typeof value === "boolean"
  ) {
    return String(value)
  }

  throw new FileInspectionError("CSV_PARSE_FAILED")
}

function getColumnByName(result: DuckDBQueryResult, name: string) {
  const field = result.schema.fields.find(
    (candidate) => candidate.name.toLowerCase() === name.toLowerCase(),
  )
  return field ? result.getChild(field.name) : null
}

function getSniffedDelimiter(result: DuckDBQueryResult, format: DelimitedFileFormat) {
  if (format === "TSV") return "\t"

  const value = getColumnByName(result, "Delimiter")?.get(0)
  const delimiter = value == null ? "" : duckDBValueToString(value)

  if (!SUPPORTED_DELIMITERS.has(delimiter)) {
    throw new FileInspectionError("CSV_PARSE_FAILED")
  }

  return delimiter
}

function hasDetectedHeader(result: DuckDBQueryResult) {
  const value = getColumnByName(result, "HasHeader")?.get(0)
  return (
    value === true ||
    (value != null && duckDBValueToString(value).toLowerCase() === "true")
  )
}

function createReadCsvExpression(
  internalName: string,
  delimiter: string,
  hasHeader: boolean,
) {
  return `read_csv(${quoteSqlString(internalName)}, delim = ${quoteSqlString(delimiter)}, header = ${hasHeader ? "true" : "false"}, auto_detect = true, all_varchar = true, sample_size = ${FILE_INSPECTION.sniffSampleSize}, strict_mode = true, ignore_errors = false)`
}

function readHeaderValues(result: DuckDBQueryResult) {
  if (result.numRows < 1 || result.schema.fields.length < 1) {
    throw new FileInspectionError("NO_HEADER_ROW")
  }

  const headers = result.schema.fields.map((_, index) => {
    const value = result.getChildAt(index)?.get(0)
    return value == null ? "" : duckDBValueToString(value)
  })

  if (headers.some((header) => header.trim().length === 0)) {
    throw new FileInspectionError("NO_HEADER_ROW")
  }

  const normalized = headers.map((header) => header.trim().toLowerCase())
  if (new Set(normalized).size !== normalized.length) {
    throw new FileInspectionError("DUPLICATE_COLUMN_NAMES")
  }

  return headers
}

function createPreviewRows(result: DuckDBQueryResult, headers: readonly string[]) {
  const rows: PreviewRow[] = []

  for (let rowIndex = 0; rowIndex < result.numRows; rowIndex += 1) {
    const row: Record<string, string | null> = {}

    headers.forEach((header, columnIndex) => {
      const value = result.getChildAt(columnIndex)?.get(rowIndex)
      row[header] = value == null ? null : duckDBValueToString(value)
    })

    rows.push(row)
  }

  return rows
}

function parseCompletePrefixRows(
  text: string,
  delimiter: string,
  isCompleteFile: boolean,
) {
  const rows: string[][] = []
  let row: string[] = []
  let field = ""
  let inQuotes = false
  let closedQuote = false

  const finishField = () => {
    row.push(field)
    field = ""
    closedQuote = false
  }
  const finishRow = () => {
    finishField()
    if (row.some((value) => value.length > 0)) rows.push(row)
    row = []
  }

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index]

    if (inQuotes) {
      if (character === '"') {
        if (text[index + 1] === '"') {
          field += '"'
          index += 1
        } else {
          inQuotes = false
          closedQuote = true
        }
      } else {
        field += character
      }
      continue
    }

    if (closedQuote) {
      if (character === delimiter) {
        finishField()
      } else if (character === "\n") {
        finishRow()
      } else if (character !== "\r" && character !== " " && character !== "\t") {
        throw new FileInspectionError("CSV_PARSE_FAILED")
      }
      continue
    }

    if (character === '"') {
      if (field.length > 0) throw new FileInspectionError("CSV_PARSE_FAILED")
      inQuotes = true
    } else if (character === delimiter) {
      finishField()
    } else if (character === "\n") {
      finishRow()
    } else if (character !== "\r") {
      field += character
    }
  }

  if (isCompleteFile) {
    if (inQuotes) throw new FileInspectionError("CSV_PARSE_FAILED")
    if (field.length > 0 || row.length > 0 || closedQuote) finishRow()
  }

  return rows
}

async function validateDelimitedPrefix(file: File, delimiter: string) {
  const byteLength = Math.min(file.size, FILE_INSPECTION.prefixValidationBytes)
  const prefix = await file.slice(0, byteLength).text()
  const rows = parseCompletePrefixRows(prefix, delimiter, byteLength === file.size)
  const headerLength = rows[0]?.length

  if (!headerLength) throw new FileInspectionError("NO_HEADER_ROW")

  for (const row of rows.slice(1, 21)) {
    if (row.length !== headerLength) {
      throw new FileInspectionError("CSV_PARSE_FAILED")
    }
  }
}

async function inspectPrefixDelimiter(file: File, format: DelimitedFileFormat) {
  if (format === "TSV") {
    await validateDelimitedPrefix(file, "\t")
    return "\t"
  }

  const byteLength = Math.min(file.size, FILE_INSPECTION.prefixValidationBytes)
  const prefix = await file.slice(0, byteLength).text()
  const candidates = [",", ";", "|"] as const
  const counts = new Map(candidates.map((candidate) => [candidate, 0]))
  let inQuotes = false

  for (let index = 0; index < prefix.length; index += 1) {
    const character = prefix[index]
    if (character === '"') {
      if (inQuotes && prefix[index + 1] === '"') index += 1
      else inQuotes = !inQuotes
    } else if (!inQuotes && character === "\n") {
      break
    } else if (!inQuotes && counts.has(character as (typeof candidates)[number])) {
      const candidate = character as (typeof candidates)[number]
      counts.set(candidate, (counts.get(candidate) ?? 0) + 1)
    }
  }

  const ranked = [...counts.entries()].sort((left, right) => right[1] - left[1])
  const delimiter = ranked[0]
  if (!delimiter || delimiter[1] === 0 || delimiter[1] === ranked[1]?.[1]) {
    throw new FileInspectionError("CSV_PARSE_FAILED")
  }

  await validateDelimitedPrefix(file, delimiter[0])
  return delimiter[0]
}

async function inspectRegisteredFile(
  connection: DuckDBConnection,
  role: FileRole,
  internalName: string,
  format: DelimitedFileFormat,
  expectedDelimiter: string,
) {
  const forcedDelimiter = format === "TSV" ? `, delim = ${quoteSqlString("\t")}` : ""
  const sniffResult = await connection.query(
    `SELECT * FROM sniff_csv(${quoteSqlString(internalName)}, sample_size = ${FILE_INSPECTION.sniffSampleSize}${forcedDelimiter});`,
  )

  if (!hasDetectedHeader(sniffResult)) {
    throw new FileInspectionError("NO_HEADER_ROW")
  }

  const delimiter = getSniffedDelimiter(sniffResult, format)
  if (delimiter !== expectedDelimiter) throw new FileInspectionError("CSV_PARSE_FAILED")
  const withoutHeader = createReadCsvExpression(internalName, delimiter, false)
  const headerResult = await connection.query(`SELECT * FROM ${withoutHeader} LIMIT 1;`)
  const headers = readHeaderValues(headerResult)

  const withHeader = createReadCsvExpression(internalName, delimiter, true)
  const previewResult = await connection.query(
    `SELECT * FROM ${withHeader} LIMIT ${FILE_INSPECTION.previewRowLimit};`,
  )

  if (previewResult.schema.fields.length !== headers.length) {
    throw new FileInspectionError("CSV_PARSE_FAILED")
  }

  return {
    delimiter,
    columns: headers.map((name, sourceIndex) => ({ name, sourceIndex })),
    preview: createPreviewRows(previewResult, headers),
    suggestions: suggestColumns(role, headers),
  }
}

class FileInspectionService {
  private readonly sessions = new Map<FileRole, RegisteredInput>()
  private readonly roleQueues = new Map<FileRole, Promise<void>>()

  constructor(private readonly engine: FileInspectionEngine) {}

  inspect(role: FileRole, file: File): Promise<FileInspectionResult> {
    return this.enqueue(role, async () => {
      await this.releaseDirect(role)

      const metadata = validateDelimitedFile(file)
      const internalName = createInternalFilename(role, metadata.format)

      try {
        const expectedDelimiter = await inspectPrefixDelimiter(file, metadata.format)
        await this.engine.registerBrowserFile(internalName, file)
        this.sessions.set(role, { internalName })

        const inspection = await this.engine.withConnection((connection) =>
          inspectRegisteredFile(
            connection,
            role,
            internalName,
            metadata.format,
            expectedDelimiter,
          ),
        )

        return {
          metadata,
          internalName,
          ...inspection,
          warning: getFileWarning(metadata.size),
        }
      } catch (error) {
        await this.releaseDirect(role)
        throw asFileInspectionError(error)
      }
    })
  }

  release(role: FileRole): Promise<void> {
    return this.enqueue(role, () => this.releaseDirect(role))
  }

  async releaseAll(): Promise<void> {
    await Promise.all([this.release("supplier"), this.release("catalog")])
  }

  private enqueue<T>(role: FileRole, operation: () => Promise<T>): Promise<T> {
    const previous = this.roleQueues.get(role) ?? Promise.resolve()
    const result = previous.catch(() => undefined).then(operation)
    const settled = result.then(
      () => undefined,
      () => undefined,
    )
    this.roleQueues.set(role, settled)
    return result
  }

  private async releaseDirect(role: FileRole) {
    const registered = this.sessions.get(role)
    this.sessions.delete(role)
    if (registered) await this.engine.dropRegisteredFile(registered.internalName)
  }
}

const fileInspectionService = new FileInspectionService(duckDBEngine)

export {
  FileInspectionService,
  fileInspectionService,
  parseCompletePrefixRows,
  inspectPrefixDelimiter,
  validateDelimitedPrefix,
}
export type { FileInspectionEngine }
