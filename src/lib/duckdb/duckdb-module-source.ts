/**
 * The production build ships the DuckDB WebAssembly modules gzip-compressed because the
 * static host limits single files to 25 MiB. The selected module is fetched from the
 * application's own origin, decompressed with the browser's native `DecompressionStream`,
 * and handed to DuckDB as a same-origin `blob:` URL typed `application/wasm`.
 * Development serves the raw `.wasm`, which passes through unchanged.
 */

import { DuckDBEngineError } from "@/lib/duckdb/duckdb-error"

const COMPRESSED_MODULE_SUFFIX = ".gz"
const GZIP_MAGIC = [0x1f, 0x8b] as const

type DuckDBModuleSource = Readonly<{
  url: string
  /** Frees the decompressed copy once DuckDB has compiled the module. */
  release: () => void
}>

type ModuleFetcher = (url: string) => Promise<Response>

async function resolveDuckDBModuleSource(
  moduleUrl: string,
  fetchModule: ModuleFetcher = (url) => fetch(url),
): Promise<DuckDBModuleSource> {
  if (!moduleUrl.endsWith(COMPRESSED_MODULE_SUFFIX)) {
    return { url: moduleUrl, release: () => undefined }
  }

  // Checked before the download so an unsupported browser is told immediately.
  if (typeof DecompressionStream === "undefined") {
    throw new DuckDBEngineError("DUCKDB_UNSUPPORTED_BROWSER")
  }

  const response = await fetchModule(moduleUrl)
  if (!response.ok) throw new Error("The DuckDB module could not be downloaded.")

  const downloaded = await response.arrayBuffer()
  const header = new Uint8Array(downloaded, 0, Math.min(2, downloaded.byteLength))
  // A host or proxy that labels the file `Content-Encoding: gzip` makes the browser
  // decompress it transparently; in that case the bytes are already the module.
  const isGzip = header[0] === GZIP_MAGIC[0] && header[1] === GZIP_MAGIC[1]

  let moduleBytes: Blob
  if (isGzip) {
    const decompressed = new Blob([downloaded])
      .stream()
      .pipeThrough(new DecompressionStream("gzip"))
    moduleBytes = await new Response(decompressed).blob()
  } else {
    moduleBytes = new Blob([downloaded])
  }

  const url = URL.createObjectURL(new Blob([moduleBytes], { type: "application/wasm" }))
  return { url, release: () => URL.revokeObjectURL(url) }
}

export { resolveDuckDBModuleSource }
export type { DuckDBModuleSource }
