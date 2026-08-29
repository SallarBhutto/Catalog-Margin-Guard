export type DuckDBEngineState = "idle" | "initializing" | "ready" | "error" | "disposed"

export type DuckDBBundleType = "eh" | "mvp"

export type DuckDBValueVector = {
  get(index: number): unknown
}

export type DuckDBQueryResult = {
  getChild(name: string): DuckDBValueVector | null
}

export type DuckDBConnection = {
  query(sql: string): Promise<DuckDBQueryResult>
  close(): Promise<void>
}

export type DuckDBDatabase = {
  instantiate(mainModule: string, pthreadWorker?: string | null): Promise<unknown>
  connect(): Promise<DuckDBConnection>
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
