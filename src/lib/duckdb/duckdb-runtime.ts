import * as duckdb from "@duckdb/duckdb-wasm"
import ehWorkerUrl from "@duckdb/duckdb-wasm/dist/duckdb-browser-eh.worker.js?url"
import mvpWorkerUrl from "@duckdb/duckdb-wasm/dist/duckdb-browser-mvp.worker.js?url"
import ehWasmUrl from "@duckdb/duckdb-wasm/dist/duckdb-eh.wasm?url"
import mvpWasmUrl from "@duckdb/duckdb-wasm/dist/duckdb-mvp.wasm?url"

import type { DuckDBRuntimeResources } from "@/lib/duckdb/duckdb-types"

const LOCAL_BUNDLES: duckdb.DuckDBBundles = {
  eh: {
    mainModule: ehWasmUrl,
    mainWorker: ehWorkerUrl,
  },
  mvp: {
    mainModule: mvpWasmUrl,
    mainWorker: mvpWorkerUrl,
  },
}

async function loadDuckDBRuntime(): Promise<DuckDBRuntimeResources> {
  const bundle = await duckdb.selectBundle(LOCAL_BUNDLES)

  if (!bundle.mainWorker) {
    throw new Error("DuckDB bundle selection did not provide a worker")
  }

  const worker = new Worker(bundle.mainWorker)

  try {
    const database = new duckdb.AsyncDuckDB(new duckdb.VoidLogger(), worker)

    return {
      bundleType: bundle.mainModule === ehWasmUrl ? "eh" : "mvp",
      database,
      mainModule: bundle.mainModule,
      pthreadWorker: bundle.pthreadWorker,
    }
  } catch (error) {
    worker.terminate()
    throw error
  }
}

export { loadDuckDBRuntime }
