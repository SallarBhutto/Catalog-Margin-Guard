import type { AccessCapabilities } from "@/app/access-policy"
import { readAnalysisMetadata } from "@/features/analysis/margin-analysis-service"
import type { MarginAnalysisMetadata } from "@/features/analysis/margin-analysis-types"
import { validateMarginPercentageText } from "@/features/analysis/margin-target-validation"
import {
  ANALYSIS_METADATA_SQL,
  APPLY_MANUAL_OVERRIDE_SQL,
  CLEAR_ALL_MANUAL_OVERRIDES_SQL,
  REMOVE_MANUAL_OVERRIDE_SQL,
  ROW_EXISTS_SQL,
} from "@/features/results/manual-override-sql"
import { readResultCount } from "@/features/results/results-query-service"
import { duckDBEngine } from "@/lib/duckdb"
import type { DuckDBConnection } from "@/lib/duckdb/duckdb-types"

type ManualOverrideAccess = Pick<AccessCapabilities, "canUseManualOverrides">
type ManualOverrideConnection = Pick<DuckDBConnection, "prepare" | "query">
type ManualOverrideEngine = Readonly<{
  getSnapshot(): Readonly<{ state: string }>
  withConnection<T>(
    operation: (connection: ManualOverrideConnection) => Promise<T>,
  ): Promise<T>
}>

type ManualOverrideMutationResult = Readonly<{
  metadata: MarginAnalysisMetadata
}>

class ManualOverrideError extends Error {
  readonly userMessage =
    "We couldn't update this target. Your current analysis is unchanged."

  constructor(
    readonly code: "NOT_ALLOWED" | "INVALID_VALUE" | "ROW_NOT_FOUND" | "STALE" | "FAILED",
  ) {
    super(code)
    this.name = "ManualOverrideError"
  }
}

async function runPrepared(
  connection: ManualOverrideConnection,
  sql: string,
  parameters: readonly unknown[],
) {
  const statement = await connection.prepare(sql)
  try {
    return await statement.query(...parameters)
  } finally {
    await statement.close()
  }
}

function assertStableRowId(rowId: string) {
  if (!/^\d+$/.test(rowId)) throw new ManualOverrideError("ROW_NOT_FOUND")
}

class ManualOverrideService {
  private queue: Promise<void> = Promise.resolve()
  private generation = 0

  constructor(private readonly engine: ManualOverrideEngine) {}

  apply(
    rowId: string,
    marginText: string,
    access: ManualOverrideAccess,
  ): Promise<ManualOverrideMutationResult> {
    if (!access.canUseManualOverrides) {
      return Promise.reject(new ManualOverrideError("NOT_ALLOWED"))
    }
    assertStableRowId(rowId)
    const parsed = validateMarginPercentageText(marginText)
    if (!parsed.valid) return Promise.reject(new ManualOverrideError("INVALID_VALUE"))

    const generation = this.generation
    return this.enqueue(() =>
      this.mutateRow(generation, rowId, APPLY_MANUAL_OVERRIDE_SQL, [
        parsed.value,
        parsed.value,
        parsed.value,
        parsed.value,
        parsed.value,
        rowId,
      ]),
    )
  }

  remove(
    rowId: string,
    access: ManualOverrideAccess,
  ): Promise<ManualOverrideMutationResult> {
    if (!access.canUseManualOverrides) {
      return Promise.reject(new ManualOverrideError("NOT_ALLOWED"))
    }
    assertStableRowId(rowId)
    const generation = this.generation
    return this.enqueue(() =>
      this.mutateRow(generation, rowId, REMOVE_MANUAL_OVERRIDE_SQL, [rowId]),
    )
  }

  /** Invalidates late row mutations immediately, then restores all rows in one SQL update. */
  cancelPendingAndClear(): Promise<ManualOverrideMutationResult | null> {
    this.generation += 1
    const generation = this.generation
    return this.enqueue(async () => {
      if (generation !== this.generation || this.engine.getSnapshot().state !== "ready") {
        return null
      }

      try {
        return await this.engine.withConnection(async (connection) => {
          await connection.query("BEGIN TRANSACTION;")
          try {
            await connection.query(CLEAR_ALL_MANUAL_OVERRIDES_SQL)
            const metadata = readAnalysisMetadata(
              await connection.query(ANALYSIS_METADATA_SQL),
            )
            await connection.query("COMMIT;")
            return { metadata }
          } catch (error) {
            await connection.query("ROLLBACK;").catch(() => undefined)
            throw error
          }
        })
      } catch (error) {
        if (error instanceof ManualOverrideError) throw error
        throw new ManualOverrideError("FAILED")
      }
    })
  }

  private async mutateRow(
    generation: number,
    rowId: string,
    sql: string,
    parameters: readonly unknown[],
  ): Promise<ManualOverrideMutationResult> {
    if (generation !== this.generation) throw new ManualOverrideError("STALE")

    try {
      const result = await this.engine.withConnection(async (connection) => {
        await connection.query("BEGIN TRANSACTION;")
        try {
          const exists = readResultCount(
            await runPrepared(connection, ROW_EXISTS_SQL, [rowId]),
          )
          if (exists !== 1) throw new ManualOverrideError("ROW_NOT_FOUND")
          await runPrepared(connection, sql, parameters)
          const metadata = readAnalysisMetadata(
            await connection.query(ANALYSIS_METADATA_SQL),
          )
          await connection.query("COMMIT;")
          return { metadata }
        } catch (error) {
          await connection.query("ROLLBACK;").catch(() => undefined)
          throw error
        }
      })

      if (generation !== this.generation) throw new ManualOverrideError("STALE")
      return result
    } catch (error) {
      if (error instanceof ManualOverrideError) throw error
      throw new ManualOverrideError("FAILED")
    }
  }

  private enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.queue.then(operation, operation)
    this.queue = result.then(
      () => undefined,
      () => undefined,
    )
    return result
  }
}

const manualOverrideService = new ManualOverrideService(duckDBEngine)

export { ManualOverrideError, ManualOverrideService, manualOverrideService }
export type { ManualOverrideMutationResult }
