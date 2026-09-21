/**
 * Build-output rules for the first-party static host.
 *
 * Cloudflare Pages rejects any single asset larger than 25 MiB. The self-hosted DuckDB
 * WebAssembly modules are larger than that, so the production build ships them
 * gzip-compressed (`*.wasm.gz`) and the browser decompresses the selected module before
 * handing it to DuckDB. Everything stays on the application's own origin.
 */

const CLOUDFLARE_PAGES_MAX_ASSET_BYTES = 25 * 1024 * 1024
const COMPRESSED_MODULE_SUFFIX = ".gz"
const DUCKDB_MODULE_PATTERN = /(^|\/)duckdb-[a-z]+(?:-[\w-]+)?\.wasm$/

function isDuckDBModuleAsset(fileName: string) {
  return DUCKDB_MODULE_PATTERN.test(fileName)
}

type BuiltAsset = Readonly<{ fileName: string; bytes: number }>

function findOversizedAssets(
  assets: readonly BuiltAsset[],
  limitBytes = CLOUDFLARE_PAGES_MAX_ASSET_BYTES,
) {
  return assets
    .filter((asset) => asset.bytes > limitBytes)
    .sort((left, right) => right.bytes - left.bytes)
}

function describeOversizedAssets(
  oversized: readonly BuiltAsset[],
  limitBytes = CLOUDFLARE_PAGES_MAX_ASSET_BYTES,
) {
  const toMiB = (bytes: number) => (bytes / (1024 * 1024)).toFixed(1)
  return [
    `Build output exceeds the ${toMiB(limitBytes)} MiB per-file limit of the static host:`,
    ...oversized.map((asset) => `  ${asset.fileName} is ${toMiB(asset.bytes)} MiB`),
    "Compress or split the asset; do not move it to a third-party CDN.",
  ].join("\n")
}

export {
  CLOUDFLARE_PAGES_MAX_ASSET_BYTES,
  COMPRESSED_MODULE_SUFFIX,
  describeOversizedAssets,
  findOversizedAssets,
  isDuckDBModuleAsset,
}
export type { BuiltAsset }
