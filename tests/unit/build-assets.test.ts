import {
  CLOUDFLARE_PAGES_MAX_ASSET_BYTES,
  COMPRESSED_MODULE_SUFFIX,
  describeOversizedAssets,
  findOversizedAssets,
  isDuckDBModuleAsset,
} from "../../deployment/build-assets"

describe("deployable build assets", () => {
  it("uses the Cloudflare Pages per-file limit", () => {
    expect(CLOUDFLARE_PAGES_MAX_ASSET_BYTES).toBe(26_214_400)
    expect(COMPRESSED_MODULE_SUFFIX).toBe(".gz")
  })

  it("recognizes only the DuckDB WebAssembly modules", () => {
    expect(isDuckDBModuleAsset("assets/duckdb-eh-9ubY-jlA.wasm")).toBe(true)
    expect(isDuckDBModuleAsset("assets/duckdb-mvp-BP0pRkMH.wasm")).toBe(true)
    expect(isDuckDBModuleAsset("duckdb-coi-abc.wasm")).toBe(true)
    for (const other of [
      "assets/duckdb-eh-9ubY-jlA.wasm.gz",
      "assets/duckdb-browser-eh.worker-hQa.js",
      "assets/other-module.wasm",
      "assets/index-abc.js",
    ]) {
      expect(isDuckDBModuleAsset(other)).toBe(false)
    }
  })

  it("reports every file over the limit, largest first, and none at the limit", () => {
    const oversized = findOversizedAssets([
      { fileName: "assets/ok.js", bytes: 800_000 },
      { fileName: "assets/at-limit.bin", bytes: CLOUDFLARE_PAGES_MAX_ASSET_BYTES },
      { fileName: "assets/duckdb-eh.wasm", bytes: 34_242_586 },
      { fileName: "assets/duckdb-mvp.wasm", bytes: 39_362_651 },
    ])

    expect(oversized.map((asset) => asset.fileName)).toEqual([
      "assets/duckdb-mvp.wasm",
      "assets/duckdb-eh.wasm",
    ])
    const message = describeOversizedAssets(oversized)
    expect(message).toContain("25.0 MiB per-file limit")
    expect(message).toContain("assets/duckdb-mvp.wasm is 37.5 MiB")
    expect(message).toContain("assets/duckdb-eh.wasm is 32.7 MiB")
  })
})
