import {
  MarginAnalysisError,
  toMarginAnalysisFailure,
} from "@/features/analysis/margin-analysis-error"
import {
  ANALYSIS_RESULTS_RELATION,
  DROP_ANALYSIS_RELATIONS_SQL,
  IDENTIFIER_MATCHES_RELATION,
  createMarginAnalysisSql,
} from "@/features/analysis/margin-analysis-sql"
import type {
  AnalysisLifecycleSnapshot,
  MarginAnalysisEngine,
  MarginAnalysisMetadata,
  MarginAnalysisResult,
  MarginAnalysisSuccess,
} from "@/features/analysis/margin-analysis-types"
import {
  normalizedInputService,
  readSafeCount,
  validateConfigurationShape,
} from "@/features/analysis/normalization-service"
import type {
  NormalizationErrorCode,
  NormalizedInputsResult,
} from "@/features/analysis/normalization-types"
import {
  fileInspectionService,
  type FileInspectionService,
} from "@/features/file-inspection/file-inspection-service"
import type { AnalysisConfiguration } from "@/features/setup/analysis-configuration"
import { duckDBEngine } from "@/lib/duckdb"
import type { DuckDBQueryResult } from "@/lib/duckdb/duckdb-types"

type AnalysisLogger = (message: string) => void
type AnalysisListener = () => void

type NormalizedInputRunner = Readonly<{
  prepare(configuration: AnalysisConfiguration): Promise<NormalizedInputsResult>
}>

const IDLE_SNAPSHOT: AnalysisLifecycleSnapshot = {
  state: "idle",
  error: null,
  metadata: null,
}

function defaultAnalysisLogger(message: string) {
  if (import.meta.env.DEV) console.info(`[Catalog Margin Guard] ${message}`)
}

function readNullableDecimal(result: DuckDBQueryResult, name: string) {
  const value = result.getChild(name)?.get(0)
  if (value == null) return null

  if (typeof value !== "string" || !/^-?\d+(?:\.\d+)?$/.test(value)) {
    throw new MarginAnalysisError("ANALYSIS_FAILED")
  }

  return value
}

function readAnalysisMetadata(result: DuckDBQueryResult): MarginAnalysisMetadata {
  return {
    summary: {
      productsAnalyzed: readSafeCount(result, "products_analyzed"),
      productsAtLoss: readSafeCount(result, "products_at_loss"),
      productsNeedingReview: readSafeCount(result, "products_needing_review"),
      productsMeetingTarget: readSafeCount(result, "products_meeting_target"),
      averageGrossMarginPct: readNullableDecimal(result, "average_gross_margin_pct"),
      productsUsingStoreDefaultTarget: readSafeCount(
        result,
        "products_using_store_default_target",
      ),
      productsUsingProductSpecificTarget: readSafeCount(
        result,
        "products_using_product_specific_target",
      ),
    },
    exposure: {
      belowZero: readSafeCount(result, "exposure_below_zero"),
      zeroToFive: readSafeCount(result, "exposure_zero_to_five"),
      fiveToTen: readSafeCount(result, "exposure_five_to_ten"),
      tenToFifteen: readSafeCount(result, "exposure_ten_to_fifteen"),
      fifteenToTwenty: readSafeCount(result, "exposure_fifteen_to_twenty"),
      twentyToThirty: readSafeCount(result, "exposure_twenty_to_thirty"),
      thirtyAndAbove: readSafeCount(result, "exposure_thirty_and_above"),
    },
    dataQuality: {
      supplierRows: readSafeCount(result, "supplier_rows"),
      catalogRows: readSafeCount(result, "catalog_rows"),
      matchedProducts: readSafeCount(result, "matched_products"),
      supplierOnlyProducts: readSafeCount(result, "supplier_only_products"),
      catalogOnlyProducts: readSafeCount(result, "catalog_only_products"),
      supplierDuplicateIdentifiers: readSafeCount(
        result,
        "supplier_duplicate_identifiers",
      ),
      catalogDuplicateIdentifiers: readSafeCount(result, "catalog_duplicate_identifiers"),
      invalidSupplierCosts: readSafeCount(result, "invalid_supplier_costs"),
      invalidSellingPrices: readSafeCount(result, "invalid_selling_prices"),
      invalidMarginOverrides: readSafeCount(result, "invalid_margin_overrides"),
    },
  }
}

function mapNormalizationFailure(code: NormalizationErrorCode) {
  return code === "INVALID_CONFIGURATION" || code === "COLUMN_NOT_FOUND"
    ? new MarginAnalysisError("INVALID_CONFIGURATION")
    : new MarginAnalysisError("NORMALIZATION_FAILED")
}

class MarginAnalysisService {
  private operationQueue: Promise<void> = Promise.resolve()
  private snapshot: AnalysisLifecycleSnapshot = IDLE_SNAPSHOT
  private latestResult: MarginAnalysisSuccess | null = null
  private readonly listeners = new Set<AnalysisListener>()
  private readonly removeInputInvalidationListener: () => void
  private readonly removeEngineListener: () => void

  constructor(
    private readonly engine: MarginAnalysisEngine,
    private readonly normalizedInputs: NormalizedInputRunner,
    inspectionService: Pick<FileInspectionService, "onInputsInvalidated">,
    private readonly log: AnalysisLogger = defaultAnalysisLogger,
  ) {
    this.removeInputInvalidationListener = inspectionService.onInputsInvalidated(() =>
      this.invalidate(),
    )
    this.removeEngineListener = engine.subscribe(() => {
      if (engine.getSnapshot().state !== "ready") {
        this.latestResult = null
        this.updateSnapshot(IDLE_SNAPSHOT)
      }
    })
  }

  getSnapshot = () => this.snapshot

  subscribe = (listener: AnalysisListener) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  getLatestResult() {
    return this.latestResult
  }

  run(configuration: AnalysisConfiguration): Promise<MarginAnalysisResult> {
    return this.enqueue(() => this.runDirect(configuration))
  }

  invalidate(): Promise<void> {
    this.latestResult = null
    this.updateSnapshot(IDLE_SNAPSHOT)
    return this.enqueue(() => this.cleanupDirect())
  }

  dispose() {
    this.removeInputInvalidationListener()
    this.removeEngineListener()
    this.listeners.clear()
    this.latestResult = null
    this.snapshot = IDLE_SNAPSHOT
  }

  private enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.operationQueue.then(operation, operation)
    this.operationQueue = result.then(
      () => undefined,
      () => undefined,
    )
    return result
  }

  private async runDirect(
    configuration: AnalysisConfiguration,
  ): Promise<MarginAnalysisResult> {
    this.latestResult = null
    this.updateSnapshot({
      state: "running",
      stage: "preparing",
      error: null,
      metadata: null,
    })
    this.log("analysis started")

    await this.cleanupDirect().catch(() => undefined)

    try {
      validateConfigurationShape(configuration)
    } catch (error) {
      return this.fail(new MarginAnalysisError("INVALID_CONFIGURATION", { cause: error }))
    }

    const normalized = await this.normalizedInputs.prepare(configuration)
    if (normalized.status === "ERROR") {
      return this.fail(mapNormalizationFailure(normalized.error.code))
    }

    this.updateSnapshot({
      state: "running",
      stage: "analyzing",
      error: null,
      metadata: null,
    })
    const sql = createMarginAnalysisSql(configuration)
    let stage: "matching" | "analysis" = "matching"

    try {
      const aggregateResult = await this.engine.withConnection(async (connection) => {
        await connection.query("BEGIN TRANSACTION;")
        try {
          for (const statement of sql.matching) await connection.query(statement)
          this.log("matching complete")
          stage = "analysis"
          await connection.query(sql.analysis)
          this.updateSnapshot({
            state: "running",
            stage: "preparing-results",
            error: null,
            metadata: null,
          })
          const metadata = await connection.query(sql.metadata)
          await connection.query("COMMIT;")
          return metadata
        } catch (error) {
          await connection.query("ROLLBACK;").catch(() => undefined)
          throw error
        }
      })

      const metadata = readAnalysisMetadata(aggregateResult)
      const success: MarginAnalysisSuccess = {
        status: "READY",
        relations: {
          matches: {
            name: IDENTIFIER_MATCHES_RELATION,
            rowCount:
              metadata.dataQuality.matchedProducts +
              metadata.dataQuality.supplierOnlyProducts +
              metadata.dataQuality.catalogOnlyProducts,
          },
          results: {
            name: ANALYSIS_RESULTS_RELATION,
            rowCount: metadata.summary.productsAnalyzed,
          },
        },
        metadata,
      }
      this.latestResult = success
      this.updateSnapshot({ state: "ready", error: null, metadata })
      this.log("analysis ready")
      return success
    } catch (error) {
      await this.cleanupDirect().catch(() => undefined)
      return this.fail(
        new MarginAnalysisError(
          stage === "matching" ? "MATCHING_FAILED" : "ANALYSIS_FAILED",
          { cause: error },
        ),
      )
    }
  }

  private fail(error: MarginAnalysisError): MarginAnalysisResult {
    const failure = toMarginAnalysisFailure(error)
    this.latestResult = null
    this.updateSnapshot({ state: "error", error: failure.error, metadata: null })
    this.log(`analysis failed: ${error.code}`)
    return failure
  }

  private async cleanupDirect() {
    if (this.engine.getSnapshot().state !== "ready") return

    await this.engine.withConnection(async (connection) => {
      for (const statement of DROP_ANALYSIS_RELATIONS_SQL) {
        await connection.query(statement)
      }
    })
    this.log("analysis relations cleared")
  }

  private updateSnapshot(snapshot: AnalysisLifecycleSnapshot) {
    this.snapshot = snapshot
    for (const listener of this.listeners) listener()
  }
}

const marginAnalysisService = new MarginAnalysisService(
  duckDBEngine,
  normalizedInputService,
  fileInspectionService,
)

function runMarginAnalysis(configuration: AnalysisConfiguration) {
  return marginAnalysisService.run(configuration)
}

function clearMarginAnalysis() {
  return marginAnalysisService.invalidate()
}

export {
  MarginAnalysisService,
  clearMarginAnalysis,
  marginAnalysisService,
  mapNormalizationFailure,
  readAnalysisMetadata,
  readNullableDecimal,
  runMarginAnalysis,
}
export type { AnalysisLogger, NormalizedInputRunner }
