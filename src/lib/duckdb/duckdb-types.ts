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

export type DuckDBPreparedStatement = {
  query(...params: unknown[]): Promise<DuckDBQueryResult>
  close(): Promise<void>
}

export type DuckDBConnection = {
  query(sql: string): Promise<DuckDBQueryResult>
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
}

export type DuckDBRuntimeLoader = () => Promise<DuckDBRuntimeResources>

export type DuckDBEngineSnapshot = Readonly<{
  state: DuckDBEngineState
  bundleType: DuckDBBundleType | null
  initializationMs: number | null
  error: DuckDBEngineError | null
}>
import type { DuckDBEngineError } from "@/lib/duckdb/duckdb-error"
