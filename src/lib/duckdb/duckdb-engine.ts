import { asDuckDBEngineError, DuckDBEngineError } from "@/lib/duckdb/duckdb-error"
import { DuckDBDataProtocol } from "@duckdb/duckdb-wasm"
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
  database: DuckDBDatabase
  closed: boolean
}
type AbortInFlight = (error: DuckDBEngineError) => void

/**
 * DuckDB never settles `instantiate` when its worker cannot load the module (for example a
 * blocked request), which would leave the interface preparing forever. The module itself is
 * downloaded before this step, so the limit only covers compiling it.
 */
const DEFAULT_INSTANTIATE_TIMEOUT_MS = 60_000

type DuckDBEngineOptions = {
  instantiateTimeoutMs?: number
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
  if (typeof Worker === "undefined" || typeof WebAssembly === "undefined") {
    throw new DuckDBEngineError("DUCKDB_UNSUPPORTED_BROWSER")
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
  private readonly instantiateTimeoutMs: number
  private readonly listeners = new Set<EngineListener>()
  private readonly connections = new Set<TrackedConnection>()
  private readonly inFlightAborts = new Set<AbortInFlight>()

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
    this.instantiateTimeoutMs =
      options.instantiateTimeoutMs ?? DEFAULT_INSTANTIATE_TIMEOUT_MS
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

    // Terminating the worker never settles its pending requests, so an operation that is
    // still running when `restart()` is called is rejected here instead of hanging forever.
    let abort!: AbortInFlight
    const aborted = new Promise<never>((_, reject) => {
      abort = reject
    })
    this.inFlightAborts.add(abort)
    let tracked: TrackedConnection | null = null

    try {
      let connection: DuckDBConnection
      try {
        connection = await Promise.race([database.connect(), aborted])
      } catch (error) {
        throw asDuckDBEngineError(error, "DUCKDB_INITIALIZATION_FAILED")
      }

      tracked = { connection, database, closed: false }

      if (database !== this.database || this.snapshot.state !== "ready") {
        throw new DuckDBEngineError("DUCKDB_ENGINE_DISPOSED")
      }

      this.connections.add(tracked)
      return await Promise.race([operation(connection), aborted])
    } finally {
      this.inFlightAborts.delete(abort)
      if (tracked) await this.closeConnection(tracked)
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

  async registerBrowserFile(name: string, file: File): Promise<void> {
    await this.initialize()

    const database = this.database
    if (!database || this.snapshot.state !== "ready") {
      throw new DuckDBEngineError("DUCKDB_ENGINE_DISPOSED")
    }

    await database.registerFileHandle(
      name,
      file,
      DuckDBDataProtocol.BROWSER_FILEREADER,
      true,
    )

    if (database !== this.database || this.snapshot.state !== "ready") {
      await database.dropFile(name).catch(() => undefined)
      throw new DuckDBEngineError("DUCKDB_ENGINE_DISPOSED")
    }
  }

  async dropRegisteredFile(name: string): Promise<void> {
    const database = this.database
    if (!database || this.snapshot.state !== "ready") return

    await database.dropFile(name).catch(() => undefined)
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

  /**
   * Stops whatever the worker is doing right now and starts a clean in-memory engine. Unlike
   * `reset()`, it does not wait for open connections to close first: a close request would
   * queue behind the statement being cancelled. In-flight operations reject with
   * `DUCKDB_ENGINE_DISPOSED`, and every registered file and relation is gone afterwards.
   */
  restart(): Promise<DuckDBEngineSnapshot> {
    if (this.lastLifecycleOperation === "reset" && this.resetPromise) {
      return this.resetPromise
    }

    this.lastLifecycleOperation = "reset"
    const restart = this.enqueueLifecycle(async () => {
      await this.cleanupResources({ immediate: true })
      this.updateSnapshot(INITIAL_SNAPSHOT)
      this.logLifecycle("DuckDB restarted")
      return this.initializeDirect()
    })
    this.resetPromise = restart

    void restart
      .finally(() => {
        if (this.resetPromise === restart) this.resetPromise = null
        if (this.lastLifecycleOperation === "reset") this.lastLifecycleOperation = null
      })
      .catch(() => undefined)

    return restart
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
      let timeout: ReturnType<typeof setTimeout> | undefined
      try {
        await Promise.race([
          runtime.database.instantiate(runtime.mainModule, runtime.pthreadWorker),
          new Promise<never>((_, reject) => {
            timeout = setTimeout(
              () => reject(new DuckDBEngineError("DUCKDB_INITIALIZATION_FAILED")),
              this.instantiateTimeoutMs,
            )
          }),
        ])
      } finally {
        clearTimeout(timeout)
        runtime.releaseModule?.()
      }

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

  private async cleanupResources(options: { immediate?: boolean } = {}) {
    const database = this.database
    this.database = null

    const activeConnections = [...this.connections]
    if (options.immediate) {
      // The worker is about to be terminated: closing would wait behind the running
      // statement, and nothing sent to a terminated worker is ever answered.
      for (const tracked of activeConnections) tracked.closed = true
      this.connections.clear()
      const aborts = [...this.inFlightAborts]
      this.inFlightAborts.clear()
      for (const abort of aborts) abort(new DuckDBEngineError("DUCKDB_ENGINE_DISPOSED"))
    } else {
      await Promise.allSettled(
        activeConnections.map((tracked) => this.closeConnection(tracked)),
      )
    }

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

    if (tracked.database !== this.database) {
      // The owning database was torn down while this connection was open. Its worker may
      // already be terminated and would never answer, so closing must not be awaited.
      void tracked.connection.close().catch(() => undefined)
      return
    }

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
