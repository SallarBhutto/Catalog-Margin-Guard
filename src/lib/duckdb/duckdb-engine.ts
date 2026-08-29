import { asDuckDBEngineError, DuckDBEngineError } from "@/lib/duckdb/duckdb-error"
import type {
  DuckDBConnection,
  DuckDBDatabase,
  DuckDBEngineSnapshot,
  DuckDBRuntimeLoader,
} from "@/lib/duckdb/duckdb-types"

const HEALTH_CHECK_SQL = "SELECT 42 AS value;"

type LifecycleOperation = "dispose" | "reset" | null
type EngineListener = () => void
type TrackedConnection = {
  connection: DuckDBConnection
  closed: boolean
}

type DuckDBEngineOptions = {
  loadRuntime?: DuckDBRuntimeLoader
  now?: () => number
  logLifecycle?: (message: string) => void
}

const INITIAL_SNAPSHOT: DuckDBEngineSnapshot = {
  state: "idle",
  bundleType: null,
  initializationMs: null,
  error: null,
}

async function defaultRuntimeLoader() {
  if (typeof Worker === "undefined") {
    throw new Error("Web Workers are unavailable")
  }

  const { loadDuckDBRuntime } = await import("./duckdb-runtime")
  return loadDuckDBRuntime()
}

function defaultLifecycleLogger(message: string) {
  if (import.meta.env.DEV) console.info(`[Catalog Margin Guard] ${message}`)
}

class DuckDBEngine {
  private readonly loadRuntime: DuckDBRuntimeLoader
  private readonly now: () => number
  private readonly logLifecycle: (message: string) => void
  private readonly listeners = new Set<EngineListener>()
  private readonly connections = new Set<TrackedConnection>()

  private snapshot: DuckDBEngineSnapshot = INITIAL_SNAPSHOT
  private database: DuckDBDatabase | null = null
  private lifecycleQueue: Promise<void> = Promise.resolve()
  private initializationPromise: Promise<DuckDBEngineSnapshot> | null = null
  private resetPromise: Promise<DuckDBEngineSnapshot> | null = null
  private disposalPromise: Promise<void> | null = null
  private lastLifecycleOperation: LifecycleOperation = null

  constructor(options: DuckDBEngineOptions = {}) {
    this.loadRuntime = options.loadRuntime ?? defaultRuntimeLoader
    this.now = options.now ?? (() => performance.now())
    this.logLifecycle = options.logLifecycle ?? defaultLifecycleLogger
  }

  getSnapshot = (): DuckDBEngineSnapshot => this.snapshot

  subscribe = (listener: EngineListener) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  initialize(): Promise<DuckDBEngineSnapshot> {
    if (this.lastLifecycleOperation === "reset" && this.resetPromise) {
      return this.resetPromise
    }

    if (this.lastLifecycleOperation === "dispose" && this.disposalPromise) {
      return this.disposalPromise.then(() => {
        throw new DuckDBEngineError("DUCKDB_ENGINE_DISPOSED")
      })
    }

    if (this.snapshot.state === "ready") return Promise.resolve(this.snapshot)
    if (this.initializationPromise) return this.initializationPromise

    if (this.snapshot.state === "disposed") {
      return Promise.reject(new DuckDBEngineError("DUCKDB_ENGINE_DISPOSED"))
    }

    if (this.snapshot.state === "error" && this.snapshot.error) {
      return Promise.reject(this.snapshot.error)
    }

    const initialization = this.enqueueLifecycle(() => this.initializeDirect())
    this.initializationPromise = initialization

    void initialization
      .finally(() => {
        if (this.initializationPromise === initialization) {
          this.initializationPromise = null
        }
      })
      .catch(() => undefined)

    return initialization
  }

  async withConnection<T>(
    operation: (connection: DuckDBConnection) => Promise<T>,
  ): Promise<T> {
    await this.initialize()

    const database = this.database
    if (!database || this.snapshot.state !== "ready") {
      throw new DuckDBEngineError("DUCKDB_ENGINE_DISPOSED")
    }

    let connection: DuckDBConnection

    try {
      connection = await database.connect()
    } catch (error) {
      throw asDuckDBEngineError(error, "DUCKDB_INITIALIZATION_FAILED")
    }

    const tracked = { connection, closed: false }

    if (database !== this.database || this.snapshot.state !== "ready") {
      await this.closeConnection(tracked)
      throw new DuckDBEngineError("DUCKDB_ENGINE_DISPOSED")
    }

    this.connections.add(tracked)

    try {
      return await operation(connection)
    } finally {
      await this.closeConnection(tracked)
    }
  }

  async healthCheck(): Promise<42> {
    try {
      return await this.withConnection(async (connection) => {
        const result = await connection.query(HEALTH_CHECK_SQL)
        const value = result.getChild("value")?.get(0)

        if (Number(value) !== 42) {
          throw new DuckDBEngineError("DUCKDB_HEALTH_CHECK_FAILED")
        }

        return 42 as const
      })
    } catch (error) {
      throw asDuckDBEngineError(error, "DUCKDB_HEALTH_CHECK_FAILED")
    }
  }

  reset(): Promise<DuckDBEngineSnapshot> {
    if (this.lastLifecycleOperation === "reset" && this.resetPromise) {
      return this.resetPromise
    }

    this.lastLifecycleOperation = "reset"
    const reset = this.enqueueLifecycle(async () => {
      await this.cleanupResources()
      this.updateSnapshot(INITIAL_SNAPSHOT)
      return this.initializeDirect()
    })
    this.resetPromise = reset

    void reset
      .finally(() => {
        if (this.resetPromise === reset) this.resetPromise = null
        if (this.lastLifecycleOperation === "reset") this.lastLifecycleOperation = null
      })
      .catch(() => undefined)

    return reset
  }

  dispose(): Promise<void> {
    if (this.lastLifecycleOperation === "dispose" && this.disposalPromise) {
      return this.disposalPromise
    }

    if (this.snapshot.state === "disposed" && !this.database) {
      return Promise.resolve()
    }

    this.lastLifecycleOperation = "dispose"
    const disposal = this.enqueueLifecycle(async () => {
      await this.cleanupResources()
      this.updateSnapshot({
        state: "disposed",
        bundleType: null,
        initializationMs: null,
        error: null,
      })
      this.logLifecycle("DuckDB disposed")
    })
    this.disposalPromise = disposal

    void disposal
      .finally(() => {
        if (this.disposalPromise === disposal) this.disposalPromise = null
        if (this.lastLifecycleOperation === "dispose") this.lastLifecycleOperation = null
      })
      .catch(() => undefined)

    return disposal
  }

  private async initializeDirect(): Promise<DuckDBEngineSnapshot> {
    const startedAt = this.now()
    this.updateSnapshot({
      state: "initializing",
      bundleType: null,
      initializationMs: null,
      error: null,
    })
    this.logLifecycle("DuckDB initializing")

    try {
      const runtime = await this.loadRuntime()
      this.database = runtime.database
      await runtime.database.instantiate(runtime.mainModule, runtime.pthreadWorker)

      const initializationMs = Math.max(0, this.now() - startedAt)
      this.updateSnapshot({
        state: "ready",
        bundleType: runtime.bundleType,
        initializationMs,
        error: null,
      })
      this.logLifecycle(`DuckDB ready (${runtime.bundleType} bundle)`)
      return this.snapshot
    } catch (error) {
      await this.cleanupResources()
      const engineError = asDuckDBEngineError(error, "DUCKDB_INITIALIZATION_FAILED")
      this.updateSnapshot({
        state: "error",
        bundleType: null,
        initializationMs: Math.max(0, this.now() - startedAt),
        error: engineError,
      })
      throw engineError
    }
  }

  private enqueueLifecycle<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.lifecycleQueue.then(operation, operation)
    this.lifecycleQueue = result.then(
      () => undefined,
      () => undefined,
    )
    return result
  }

  private async cleanupResources() {
    const database = this.database
    this.database = null

    const activeConnections = [...this.connections]
    await Promise.allSettled(
      activeConnections.map((tracked) => this.closeConnection(tracked)),
    )

    if (database) {
      try {
        await database.terminate()
      } catch {
        this.logLifecycle("DuckDB teardown encountered an error")
      }
    }
  }

  private async closeConnection(tracked: TrackedConnection) {
    if (tracked.closed) return

    tracked.closed = true
    this.connections.delete(tracked)

    try {
      await tracked.connection.close()
    } catch {
      this.logLifecycle("DuckDB connection cleanup encountered an error")
    }
  }

  private updateSnapshot(snapshot: DuckDBEngineSnapshot) {
    this.snapshot = snapshot
    for (const listener of this.listeners) listener()
  }
}

export { DuckDBEngine, HEALTH_CHECK_SQL }
export type { DuckDBEngineOptions }
