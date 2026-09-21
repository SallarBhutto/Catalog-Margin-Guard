import * as duckdb from "@duckdb/duckdb-wasm"
import ehWorkerUrl from "@duckdb/duckdb-wasm/dist/duckdb-browser-eh.worker.js?url"
import mvpWorkerUrl from "@duckdb/duckdb-wasm/dist/duckdb-browser-mvp.worker.js?url"
import ehWasmUrl from "@duckdb/duckdb-wasm/dist/duckdb-eh.wasm?url"
import mvpWasmUrl from "@duckdb/duckdb-wasm/dist/duckdb-mvp.wasm?url"

import { resolveDuckDBModuleSource } from "@/lib/duckdb/duckdb-module-source"
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

/**
 * The worker's Content Security Policy is the one served with its script, and that script
 * is cached as immutable. Versioning the URL with the deployed policy guarantees a worker
 * never runs under a policy from an earlier release.
 */
function createWorkerUrl(workerUrl: string) {
  const policyVersion = import.meta.env.VITE_DEPLOYMENT_POLICY_VERSION
  return policyVersion ? `${workerUrl}?policy=${policyVersion}` : workerUrl
}

async function loadDuckDBRuntime(): Promise<DuckDBRuntimeResources> {
  const bundle = await duckdb.selectBundle(LOCAL_BUNDLES)

  if (!bundle.mainWorker) {
    throw new Error("DuckDB bundle selection did not provide a worker")
  }

  // Only the selected bundle is downloaded (and, in production, decompressed).
  const moduleSource = await resolveDuckDBModuleSource(bundle.mainModule)
  const worker = new Worker(createWorkerUrl(bundle.mainWorker))

  try {
    const database = new duckdb.AsyncDuckDB(new duckdb.VoidLogger(), worker)

    return {
      bundleType: bundle.mainModule === ehWasmUrl ? "eh" : "mvp",
      database,
      mainModule: moduleSource.url,
      pthreadWorker: bundle.pthreadWorker,
      releaseModule: moduleSource.release,
    }
  } catch (error) {
    worker.terminate()
    moduleSource.release()
    throw error
  }
}

export { loadDuckDBRuntime }
