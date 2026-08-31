import {
  fileInspectionService,
  type FileInspectionService,
} from "@/features/file-inspection/file-inspection-service"
import {
  NormalizationError,
  asNormalizationError,
  toNormalizationFailure,
} from "@/features/analysis/normalization-error"
import {
  NORMALIZED_CATALOG_RELATION,
  NORMALIZED_SUPPLIER_RELATION,
  createNormalizationSql,
} from "@/features/analysis/normalization-sql"
import type {
  NormalizationEngine,
  NormalizationSuccess,
  NormalizedInputsResult,
} from "@/features/analysis/normalization-types"
import type { AnalysisConfiguration } from "@/features/setup/analysis-configuration"
import { duckDBEngine } from "@/lib/duckdb"
import type { DuckDBQueryResult } from "@/lib/duckdb/duckdb-types"

const DROP_NORMALIZED_RELATIONS_SQL = [
  `DROP TABLE IF EXISTS ${NORMALIZED_SUPPLIER_RELATION};`,
  `DROP TABLE IF EXISTS ${NORMALIZED_CATALOG_RELATION};`,
] as const

type NormalizationLogger = (message: string) => void

function defaultNormalizationLogger(message: string) {
  if (import.meta.env.DEV) console.info(`[Catalog Margin Guard] ${message}`)
}

function readSafeCount(result: DuckDBQueryResult, name: string) {
  const value = result.getChild(name)?.get(0)
  const count = Number(value)

  if (!Number.isSafeInteger(count) || count < 0) {
    throw new NormalizationError("NORMALIZATION_FAILED")
  }

  return count
}

function validateConfigurationShape(configuration: AnalysisConfiguration) {
  const mappingValues = [
    configuration?.mapping?.supplierIdentifier,
    configuration?.mapping?.supplierCost,
    configuration?.mapping?.catalogIdentifier,
    configuration?.mapping?.catalogPrice,
  ]
  const validNumberFormat =
    configuration?.options?.numberFormat === "US" ||
    configuration?.options?.numberFormat === "EU"

  if (
    mappingValues.some((value) => typeof value !== "string" || value.length === 0) ||
    typeof configuration?.options?.caseInsensitive !== "boolean" ||
    !validNumberFormat
  ) {
    throw new NormalizationError("INVALID_CONFIGURATION")
  }
}

class NormalizedInputService {
  private operationQueue: Promise<void> = Promise.resolve()
  private latestResult: NormalizationSuccess | null = null
  private readonly removeInputInvalidationListener: () => void
  private readonly removeEngineListener: () => void

  constructor(
    private readonly engine: NormalizationEngine,
    private readonly inspectionService: Pick<
      FileInspectionService,
      "getRegisteredInput" | "onInputsInvalidated"
    >,
    private readonly log: NormalizationLogger = defaultNormalizationLogger,
  ) {
    this.removeInputInvalidationListener = inspectionService.onInputsInvalidated(() =>
      this.cleanup(),
    )
    this.removeEngineListener = engine.subscribe(() => {
      if (engine.getSnapshot().state !== "ready") this.latestResult = null
    })
  }

  prepare(configuration: AnalysisConfiguration): Promise<NormalizedInputsResult> {
    return this.enqueue(() => this.prepareDirect(configuration))
  }

  cleanup(): Promise<void> {
    this.latestResult = null
    return this.enqueue(() => this.cleanupDirect())
  }

  getLatestResult() {
    return this.latestResult
  }

  dispose() {
    this.removeInputInvalidationListener()
    this.removeEngineListener()
    this.latestResult = null
  }

  private enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.operationQueue.then(operation, operation)
    this.operationQueue = result.then(
      () => undefined,
      () => undefined,
    )
    return result
  }

  private async prepareDirect(
    configuration: AnalysisConfiguration,
  ): Promise<NormalizedInputsResult> {
    this.latestResult = null
    this.log("normalization started")

    try {
      validateConfigurationShape(configuration)
      const supplier = this.inspectionService.getRegisteredInput("supplier")
      const catalog = this.inspectionService.getRegisteredInput("catalog")

      if (!supplier || !catalog) throw new NormalizationError("INPUT_NOT_READY")

      const sql = createNormalizationSql(configuration, { supplier, catalog })
      const result = await this.engine.withConnection(async (connection) => {
        for (const statement of DROP_NORMALIZED_RELATIONS_SQL) {
          await connection.query(statement)
        }

        await connection.query("BEGIN TRANSACTION;")
        try {
          await connection.query(sql.supplier)
          this.log("supplier normalization complete")
          await connection.query(sql.catalog)
          this.log("catalog normalization complete")
          const quality = await connection.query(sql.quality)
          await connection.query("COMMIT;")
          return quality
        } catch (error) {
          await connection.query("ROLLBACK;").catch(() => undefined)
          for (const statement of DROP_NORMALIZED_RELATIONS_SQL) {
            await connection.query(statement).catch(() => undefined)
          }
          throw error
        }
      })

      const quality = {
        supplierRows: readSafeCount(result, "supplier_rows"),
        catalogRows: readSafeCount(result, "catalog_rows"),
        supplierDuplicateIdentifiers: readSafeCount(
          result,
          "supplier_duplicate_identifiers",
        ),
        catalogDuplicateIdentifiers: readSafeCount(
          result,
          "catalog_duplicate_identifiers",
        ),
        invalidSupplierCosts: readSafeCount(result, "invalid_supplier_costs"),
        invalidSellingPrices: readSafeCount(result, "invalid_selling_prices"),
        invalidMarginOverrides: readSafeCount(result, "invalid_margin_overrides"),
      }
      const success: NormalizationSuccess = {
        status: "READY",
        relations: {
          supplier: {
            name: NORMALIZED_SUPPLIER_RELATION,
            rowCount: quality.supplierRows,
          },
          catalog: {
            name: NORMALIZED_CATALOG_RELATION,
            rowCount: quality.catalogRows,
          },
        },
        quality,
        diagnostics: {
          invalidSupplierIdentifiers: readSafeCount(
            result,
            "invalid_supplier_identifiers",
          ),
          invalidCatalogIdentifiers: readSafeCount(result, "invalid_catalog_identifiers"),
        },
      }
      this.latestResult = success
      return success
    } catch (error) {
      const normalizedError = asNormalizationError(error)
      await this.cleanupDirect().catch(() => undefined)
      this.log(`normalization failed: ${normalizedError.code}`)
      return toNormalizationFailure(normalizedError)
    }
  }

  private async cleanupDirect() {
    if (this.engine.getSnapshot().state !== "ready") return

    await this.engine.withConnection(async (connection) => {
      for (const statement of DROP_NORMALIZED_RELATIONS_SQL) {
        await connection.query(statement)
      }
    })
    this.log("normalized inputs cleared")
  }
}

const normalizedInputService = new NormalizedInputService(
  duckDBEngine,
  fileInspectionService,
)

function prepareNormalizedInputs(configuration: AnalysisConfiguration) {
  return normalizedInputService.prepare(configuration)
}

function clearNormalizedInputs() {
  return normalizedInputService.cleanup()
}

export {
  DROP_NORMALIZED_RELATIONS_SQL,
  NormalizedInputService,
  clearNormalizedInputs,
  normalizedInputService,
  prepareNormalizedInputs,
  readSafeCount,
  validateConfigurationShape,
}
export type { NormalizationLogger }
