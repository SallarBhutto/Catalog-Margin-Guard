import { DuckDBEngine } from "@/lib/duckdb/duckdb-engine"

const duckDBEngine = new DuckDBEngine()

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    void duckDBEngine.dispose()
  })
}

export { duckDBEngine }
export { DuckDBEngine, HEALTH_CHECK_SQL } from "@/lib/duckdb/duckdb-engine"
export { DuckDBEngineError } from "@/lib/duckdb/duckdb-error"
export type {
  DuckDBBundleType,
  DuckDBConnection,
  DuckDBEngineSnapshot,
  DuckDBEngineState,
} from "@/lib/duckdb/duckdb-types"
