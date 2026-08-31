import { DuckDBEngine, HEALTH_CHECK_SQL } from "@/lib/duckdb/duckdb-engine"
import { DuckDBEngineError } from "@/lib/duckdb/duckdb-error"
import type {
  DuckDBConnection,
  DuckDBDatabase,
  DuckDBRuntimeResources,
} from "@/lib/duckdb/duckdb-types"

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void
  const promise = new Promise<T>((promiseResolve) => {
    resolve = promiseResolve
  })

  return { promise, resolve }
}

function createRuntime(
  options: { healthValue?: unknown; instantiateError?: Error } = {},
) {
  const close = vi.fn(() => Promise.resolve())
  const query = vi.fn(() =>
    Promise.resolve({
      getChild: (name: string) =>
        name === "value" ? { get: () => options.healthValue ?? 42n } : null,
      getChildAt: () => null,
      numRows: 1,
      schema: { fields: [{ name: "value" }] },
    }),
  )
  const connection: DuckDBConnection = { close, query }
  const instantiate = options.instantiateError
    ? vi.fn(() => Promise.reject(options.instantiateError!))
    : vi.fn(() => Promise.resolve())
  const connect = vi.fn(() => Promise.resolve(connection))
  const terminate = vi.fn(() => Promise.resolve())
  const open = vi.fn(() => Promise.resolve())
  const registerFileHandle = vi.fn(() => Promise.resolve())
  const dropFile = vi.fn(() => Promise.resolve(null))
  const database: DuckDBDatabase & { open: typeof open } = {
    connect,
    dropFile,
    instantiate,
    open,
    registerFileHandle,
    terminate,
  }
  const resources: DuckDBRuntimeResources = {
    bundleType: "eh",
    database,
    mainModule: "/assets/duckdb-eh.wasm",
    pthreadWorker: null,
  }

  return {
    close,
    connect,
    connection,
    database,
    instantiate,
    open,
    query,
    registerFileHandle,
    resources,
    dropFile,
    terminate,
  }
}

describe("DuckDB engine lifecycle", () => {
  it("starts idle without loading a runtime", () => {
    const loadRuntime = vi.fn(() => Promise.resolve(createRuntime().resources))
    const engine = new DuckDBEngine({ loadRuntime, logLifecycle: vi.fn() })

    expect(engine.getSnapshot()).toEqual({
      state: "idle",
      bundleType: null,
      initializationMs: null,
      error: null,
    })
    expect(loadRuntime).not.toHaveBeenCalled()
  })

  it("initializes one in-memory worker-backed database", async () => {
    const runtime = createRuntime()
    const now = vi.fn().mockReturnValueOnce(100).mockReturnValueOnce(125)
    const engine = new DuckDBEngine({
      loadRuntime: vi.fn(() => Promise.resolve(runtime.resources)),
      logLifecycle: vi.fn(),
      now,
    })

    await expect(engine.initialize()).resolves.toMatchObject({
      state: "ready",
      bundleType: "eh",
      initializationMs: 25,
    })
    expect(runtime.instantiate).toHaveBeenCalledWith("/assets/duckdb-eh.wasm", null)
    expect(runtime.open).not.toHaveBeenCalled()
  })

  it("runs SELECT 42 and closes its owned connection", async () => {
    const runtime = createRuntime()
    const engine = new DuckDBEngine({
      loadRuntime: vi.fn(() => Promise.resolve(runtime.resources)),
      logLifecycle: vi.fn(),
    })

    await expect(engine.healthCheck()).resolves.toBe(42)
    expect(runtime.query).toHaveBeenCalledWith(HEALTH_CHECK_SQL)
    expect(runtime.close).toHaveBeenCalledOnce()
  })

  it("does not create duplicate engines for repeated initialization", async () => {
    const runtime = createRuntime()
    const loadRuntime = vi.fn(() => Promise.resolve(runtime.resources))
    const engine = new DuckDBEngine({ loadRuntime, logLifecycle: vi.fn() })

    await engine.initialize()
    await engine.initialize()

    expect(loadRuntime).toHaveBeenCalledOnce()
    expect(runtime.instantiate).toHaveBeenCalledOnce()
  })

  it("shares one promise and runtime across concurrent initialization", async () => {
    const runtime = createRuntime()
    const runtimeGate = deferred<DuckDBRuntimeResources>()
    const loadRuntime = vi.fn(() => runtimeGate.promise)
    const engine = new DuckDBEngine({ loadRuntime, logLifecycle: vi.fn() })

    const first = engine.initialize()
    const second = engine.initialize()

    expect(second).toBe(first)
    runtimeGate.resolve(runtime.resources)
    await Promise.all([first, second])

    expect(loadRuntime).toHaveBeenCalledOnce()
    expect(runtime.instantiate).toHaveBeenCalledOnce()
  })

  it("closes a connection even when its operation fails", async () => {
    const runtime = createRuntime()
    const engine = new DuckDBEngine({
      loadRuntime: vi.fn(() => Promise.resolve(runtime.resources)),
      logLifecycle: vi.fn(),
    })

    await expect(
      engine.withConnection(() => Promise.reject(new Error("query failed"))),
    ).rejects.toThrow("query failed")
    expect(runtime.close).toHaveBeenCalledOnce()
  })

  it("resets by tearing down the old in-memory database and creating a clean one", async () => {
    const firstRuntime = createRuntime()
    const secondRuntime = createRuntime()
    const loadRuntime = vi
      .fn<() => Promise<DuckDBRuntimeResources>>()
      .mockResolvedValueOnce(firstRuntime.resources)
      .mockResolvedValueOnce(secondRuntime.resources)
    const engine = new DuckDBEngine({ loadRuntime, logLifecycle: vi.fn() })

    await engine.initialize()
    await engine.reset()

    expect(firstRuntime.terminate).toHaveBeenCalledOnce()
    expect(secondRuntime.instantiate).toHaveBeenCalledOnce()
    expect(loadRuntime).toHaveBeenCalledTimes(2)
    expect(engine.getSnapshot().state).toBe("ready")
  })

  it("disposes active connections before terminating the database", async () => {
    const runtime = createRuntime()
    const operationStarted = deferred<void>()
    const operationRelease = deferred<void>()
    const engine = new DuckDBEngine({
      loadRuntime: vi.fn(() => Promise.resolve(runtime.resources)),
      logLifecycle: vi.fn(),
    })

    const operation = engine.withConnection(async () => {
      operationStarted.resolve()
      await operationRelease.promise
    })
    await operationStarted.promise

    await engine.dispose()
    operationRelease.resolve()
    await operation

    expect(runtime.close).toHaveBeenCalledOnce()
    expect(runtime.terminate).toHaveBeenCalledOnce()
    expect(runtime.close.mock.invocationCallOrder[0]).toBeLessThan(
      runtime.terminate.mock.invocationCallOrder[0] ?? Infinity,
    )
    expect(engine.getSnapshot().state).toBe("disposed")
  })

  it("allows repeated disposal without duplicate teardown", async () => {
    const runtime = createRuntime()
    const engine = new DuckDBEngine({
      loadRuntime: vi.fn(() => Promise.resolve(runtime.resources)),
      logLifecycle: vi.fn(),
    })

    await engine.initialize()
    await Promise.all([engine.dispose(), engine.dispose()])
    await engine.dispose()

    expect(runtime.terminate).toHaveBeenCalledOnce()
    expect(engine.getSnapshot().state).toBe("disposed")
  })

  it("serializes reset and disposal so the latest lifecycle request wins", async () => {
    const firstRuntime = createRuntime()
    const secondRuntime = createRuntime()
    const loadRuntime = vi
      .fn<() => Promise<DuckDBRuntimeResources>>()
      .mockResolvedValueOnce(firstRuntime.resources)
      .mockResolvedValueOnce(secondRuntime.resources)
    const engine = new DuckDBEngine({ loadRuntime, logLifecycle: vi.fn() })

    await engine.initialize()
    const reset = engine.reset()
    const disposal = engine.dispose()
    await Promise.all([reset, disposal])

    expect(firstRuntime.terminate).toHaveBeenCalledOnce()
    expect(secondRuntime.terminate).toHaveBeenCalledOnce()
    expect(engine.getSnapshot().state).toBe("disposed")
  })

  it("maps initialization failures to a controlled application error", async () => {
    const cause = new Error("raw wasm failure")
    const runtime = createRuntime({ instantiateError: cause })
    const engine = new DuckDBEngine({
      loadRuntime: vi.fn(() => Promise.resolve(runtime.resources)),
      logLifecycle: vi.fn(),
    })

    const error = await engine.initialize().catch((caught: unknown) => caught)

    expect(error).toBeInstanceOf(DuckDBEngineError)
    expect(error).toMatchObject({ code: "DUCKDB_INITIALIZATION_FAILED", cause })
    expect(engine.getSnapshot()).toMatchObject({
      state: "error",
      error: { code: "DUCKDB_INITIALIZATION_FAILED" },
    })
    expect(runtime.terminate).toHaveBeenCalledOnce()
  })

  it("rejects an unexpected health-check result with a controlled error", async () => {
    const runtime = createRuntime({ healthValue: 41 })
    const engine = new DuckDBEngine({
      loadRuntime: vi.fn(() => Promise.resolve(runtime.resources)),
      logLifecycle: vi.fn(),
    })

    await expect(engine.healthCheck()).rejects.toMatchObject({
      code: "DUCKDB_HEALTH_CHECK_FAILED",
    })
    expect(runtime.close).toHaveBeenCalledOnce()
  })
})
