import type { AccessCapabilities } from "@/app/access-policy"
import { marginAnalysisService } from "@/features/analysis/margin-analysis-service"
import type { TargetSource } from "@/features/analysis/margin-analysis-types"
import {
  CSV_BYTE_ORDER_MARK,
  joinCsvRow,
  serializeCsvDecimal,
  serializeGeneratedCsvText,
  serializeUntrustedCsvText,
} from "@/features/exports/csv-serialization"
import { deliverBrowserDownload } from "@/features/exports/report-download"
import {
  REPORT_COLUMNS,
  createReportExportSql,
  type ReportKind,
} from "@/features/exports/report-export-sql"
import { manualOverrideService } from "@/features/results/manual-override-service"
import { formatTargetSource } from "@/features/results/results-formatting"
import { duckDBEngine } from "@/lib/duckdb"
import type { DuckDBConnection, DuckDBRecordBatch } from "@/lib/duckdb/duckdb-types"

type ReportExportAccess = Pick<AccessCapabilities, "canExportResults">
type ReportExportConnection = Pick<DuckDBConnection, "send" | "cancelSent">
type ReportExportEngine = Readonly<{
  withConnection<T>(
    operation: (connection: ReportExportConnection) => Promise<T>,
  ): Promise<T>
}>
/** Serializes the export with manual-target mutations of the same analysis relation. */
type ReportExportCoordinator = Readonly<{
  runExclusive<T>(operation: () => Promise<T>): Promise<T>
}>
/** Identity of the active analysis; it changes when the analysis is cleared or replaced. */
type ActiveAnalysisSource = Readonly<{ getLatestResult(): unknown }>

type ReportExportOutcome =
  | Readonly<{ status: "DOWNLOADED"; rows: number; filename: string }>
  | Readonly<{ status: "EMPTY" }>
  | Readonly<{ status: "CANCELLED" }>

type ReportExportOptions = Readonly<{
  onProgress?: (rowsWritten: number) => void
}>

type ReportExportDependencies = Readonly<{
  engine: ReportExportEngine
  coordinator: ReportExportCoordinator
  analysis: ActiveAnalysisSource
  deliver: (file: Blob, filename: string) => void
  now?: () => Date
  log?: (message: string) => void
}>

const REPORT_FILENAME_PREFIXES: Readonly<Record<ReportKind, string>> = {
  PRODUCTS_TO_REVIEW: "products-to-review",
  FULL_MARGIN_REPORT: "catalog-margin-report",
}

const STATUSES = new Set<string>(["LOSS", "REVIEW", "OK"])
const TARGET_SOURCES = new Set<string>([
  "STORE_DEFAULT",
  "CATALOG_OVERRIDE",
  "MANUAL_OVERRIDE",
])

/** Serialized text is folded into a Blob part once it reaches roughly this many characters. */
const BLOB_PART_CHARACTERS = 4 * 1024 * 1024

class ReportExportError extends Error {
  readonly userMessage: string

  constructor(readonly code: "NOT_ALLOWED" | "NO_ANALYSIS" | "BUSY" | "FAILED") {
    super(code)
    this.name = "ReportExportError"
    this.userMessage =
      code === "NOT_ALLOWED"
        ? "Sign in free to download your complete margin report."
        : code === "BUSY"
          ? "Another report is still being prepared."
          : "We couldn't prepare this report. Your analysis is unchanged. Try again."
  }
}

function createReportFilename(kind: ReportKind, date: Date) {
  const year = String(date.getFullYear())
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${REPORT_FILENAME_PREFIXES[kind]}-${year}-${month}-${day}.csv`
}

function readRequiredString(batch: DuckDBRecordBatch, name: string, rowIndex: number) {
  const value = batch.getChild(name)?.get(rowIndex)
  if (typeof value !== "string") throw new Error("Invalid export query response.")
  return value
}

/** Serializes one record batch. Any unexpected value fails the export instead of being written. */
function serializeReportBatch(batch: DuckDBRecordBatch) {
  let text = ""

  for (let rowIndex = 0; rowIndex < batch.numRows; rowIndex += 1) {
    const targetSource = readRequiredString(batch, "target_source", rowIndex)
    const status = readRequiredString(batch, "status", rowIndex)
    if (!TARGET_SOURCES.has(targetSource) || !STATUSES.has(status)) {
      throw new Error("Invalid export query response.")
    }

    text += joinCsvRow([
      serializeUntrustedCsvText(readRequiredString(batch, "identifier", rowIndex)),
      serializeCsvDecimal(readRequiredString(batch, "supplier_cost", rowIndex)),
      serializeCsvDecimal(readRequiredString(batch, "selling_price", rowIndex)),
      serializeCsvDecimal(readRequiredString(batch, "gross_margin_percent", rowIndex)),
      serializeCsvDecimal(readRequiredString(batch, "target_margin_percent", rowIndex)),
      serializeGeneratedCsvText(formatTargetSource(targetSource as TargetSource)),
      serializeCsvDecimal(readRequiredString(batch, "price_for_target_margin", rowIndex)),
      serializeGeneratedCsvText(status),
    ])
  }

  return text
}

class ReportExportService {
  private active: { cancelled: boolean } | null = null
  private readonly now: () => Date
  private readonly log: (message: string) => void

  constructor(private readonly dependencies: ReportExportDependencies) {
    this.now = dependencies.now ?? (() => new Date())
    this.log =
      dependencies.log ??
      ((message) => {
        if (import.meta.env.DEV) console.info(`[Catalog Margin Guard] ${message}`)
      })
  }

  /**
   * Invalidates the export in progress, if any. Called on sign-out, Start New Scan, and when
   * the export controls unmount, so a report started under earlier conditions never downloads.
   */
  cancelActive() {
    if (this.active) this.active.cancelled = true
  }

  async exportReport(
    kind: ReportKind,
    access: ReportExportAccess,
    options: ReportExportOptions = {},
  ): Promise<ReportExportOutcome> {
    // A workflow gate that mirrors the interface, not a security or entitlement boundary:
    // all analysis data already lives in this browser.
    if (!access.canExportResults) throw new ReportExportError("NOT_ALLOWED")
    if (this.active) throw new ReportExportError("BUSY")

    const { analysis, coordinator, deliver, engine } = this.dependencies
    const activeAnalysis = analysis.getLatestResult()
    if (!activeAnalysis) throw new ReportExportError("NO_ANALYSIS")

    const sql = createReportExportSql(kind)
    const token = { cancelled: false }
    this.active = token
    const isStale = () => token.cancelled || analysis.getLatestResult() !== activeAnalysis

    try {
      // Queued with manual-target mutations: targets saved before this request are included,
      // later ones wait, and the single statement below reads one consistent snapshot.
      return await coordinator.runExclusive(async () => {
        if (isStale()) return { status: "CANCELLED" }
        this.log("report export started")

        const parts: Blob[] = []
        let pending = CSV_BYTE_ORDER_MARK + joinCsvRow(REPORT_COLUMNS)
        let rows = 0

        const completed = await engine.withConnection(async (connection) => {
          const batches = await connection.send(sql, true)

          for await (const batch of batches) {
            if (isStale()) {
              await connection.cancelSent().catch(() => false)
              return false
            }

            pending += serializeReportBatch(batch)
            rows += batch.numRows
            if (pending.length >= BLOB_PART_CHARACTERS) {
              parts.push(new Blob([pending]))
              pending = ""
            }
            options.onProgress?.(rows)
          }

          return true
        })

        if (!completed || isStale()) return { status: "CANCELLED" }
        if (rows === 0) return { status: "EMPTY" }

        parts.push(new Blob([pending]))
        const filename = createReportFilename(kind, this.now())
        deliver(new Blob(parts, { type: "text/csv;charset=utf-8" }), filename)
        this.log(`report export completed (${rows} rows)`)
        return { status: "DOWNLOADED", rows, filename }
      })
    } catch (error) {
      // Clearing or replacing the analysis can fail the running statement; that is a
      // cancellation, not an export failure.
      if (isStale()) return { status: "CANCELLED" }
      if (error instanceof ReportExportError) throw error
      this.log("report export failed")
      throw new ReportExportError("FAILED")
    } finally {
      if (this.active === token) this.active = null
    }
  }
}

const reportExportService = new ReportExportService({
  engine: duckDBEngine,
  coordinator: manualOverrideService,
  analysis: marginAnalysisService,
  deliver: deliverBrowserDownload,
})

export {
  ReportExportError,
  ReportExportService,
  createReportFilename,
  reportExportService,
  serializeReportBatch,
}
export type { ReportExportAccess, ReportExportOutcome }
