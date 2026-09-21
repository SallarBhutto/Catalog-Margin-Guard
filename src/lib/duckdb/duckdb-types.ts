export type DuckDBEngineState = "idle" | "initializing" | "ready" | "error" | "disposed"

export type DuckDBBundleType = "eh" | "mvp"

export type DuckDBValueVector = {
  get(index: number): unknown
}

export type DuckDBSchemaField = {
  readonly name: string
}

export type DuckDBQueryResult = {
  getChild(name: string): DuckDBValueVector | null
  getChildAt(index: number): DuckDBValueVector | null
  readonly numRows: number
  readonly schema: {
    readonly fields: readonly DuckDBSchemaField[]
  }
}

/** One chunk of a streamed result. Only a bounded number of rows is held at a time. */
export type DuckDBRecordBatch = Pick<DuckDBQueryResult, "getChild" | "numRows">

export type DuckDBPreparedStatement = {
  query(...params: unknown[]): Promise<DuckDBQueryResult>
  close(): Promise<void>
}

export type DuckDBConnection = {
  query(sql: string): Promise<DuckDBQueryResult>
  /** Streams a result as record batches instead of materializing every row at once. */
  send(
    sql: string,
    allowStreamResult?: boolean,
  ): Promise<AsyncIterable<DuckDBRecordBatch>>
  /** Cancels the statement started by `send`. */
  cancelSent(): Promise<boolean>
  prepare(sql: string): Promise<DuckDBPreparedStatement>
  close(): Promise<void>
}

export type DuckDBDatabase = {
  instantiate(mainModule: string, pthreadWorker?: string | null): Promise<unknown>
  connect(): Promise<DuckDBConnection>
  registerFileHandle<HandleType>(
    name: string,
    handle: HandleType,
    protocol: number,
    directIO: boolean,
  ): Promise<void>
  dropFile(name: string): Promise<unknown>
  terminate(): Promise<void>
}

export type DuckDBRuntimeResources = {
  bundleType: DuckDBBundleType
  database: DuckDBDatabase
  mainModule: string
  pthreadWorker: string | null
  /** Releases a temporary module copy after DuckDB has compiled it. */
  releaseModule?: () => void
}

export type DuckDBRuntimeLoader = () => Promise<DuckDBRuntimeResources>

export type DuckDBEngineSnapshot = Readonly<{
  state: DuckDBEngineState
  bundleType: DuckDBBundleType | null
  initializationMs: number | null
  error: DuckDBEngineError | null
}>
import type { DuckDBEngineError } from "@/lib/duckdb/duckdb-error"
