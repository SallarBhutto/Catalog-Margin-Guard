// @vitest-environment node
import { gzipSync } from "node:zlib"

import { resolveDuckDBModuleSource } from "@/lib/duckdb/duckdb-module-source"

const WASM_BYTES = new Uint8Array([
  0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00, 7, 7, 7,
])

async function readObjectUrl(url: string) {
  const response = await fetch(url)
  return {
    type: response.headers.get("content-type"),
    bytes: new Uint8Array(await response.arrayBuffer()),
  }
}

describe("DuckDB module source", () => {
  it("passes an uncompressed development module through without fetching it", async () => {
    const fetchModule = vi.fn()
    const source = await resolveDuckDBModuleSource("/assets/duckdb-eh.wasm", fetchModule)

    expect(source.url).toBe("/assets/duckdb-eh.wasm")
    expect(fetchModule).not.toHaveBeenCalled()
    expect(() => source.release()).not.toThrow()
  })

  it("decompresses a gzip module into a same-origin application/wasm blob URL", async () => {
    const fetchModule = vi.fn(() =>
      Promise.resolve(new Response(gzipSync(WASM_BYTES), { status: 200 })),
    )
    const source = await resolveDuckDBModuleSource(
      "/assets/duckdb-eh-abc.wasm.gz",
      fetchModule,
    )

    expect(fetchModule).toHaveBeenCalledWith("/assets/duckdb-eh-abc.wasm.gz")
    expect(source.url.startsWith("blob:")).toBe(true)
    const module = await readObjectUrl(source.url)
    expect(module.type).toBe("application/wasm")
    expect([...module.bytes]).toEqual([...WASM_BYTES])

    source.release()
    await expect(fetch(source.url)).rejects.toThrow()
  })

  it("accepts a module the host already decompressed in transit", async () => {
    const source = await resolveDuckDBModuleSource("/assets/duckdb-mvp-abc.wasm.gz", () =>
      Promise.resolve(new Response(WASM_BYTES, { status: 200 })),
    )

    const module = await readObjectUrl(source.url)
    expect(module.type).toBe("application/wasm")
    expect([...module.bytes]).toEqual([...WASM_BYTES])
    source.release()
  })

  it("reports an unsupported browser before downloading when decompression is unavailable", async () => {
    const original = globalThis.DecompressionStream
    const fetchModule = vi.fn()
    // @ts-expect-error simulating a browser without the Compression Streams API
    delete globalThis.DecompressionStream

    try {
      await expect(
        resolveDuckDBModuleSource("/assets/duckdb-eh-abc.wasm.gz", fetchModule),
      ).rejects.toMatchObject({
        code: "DUCKDB_UNSUPPORTED_BROWSER",
        userMessage: expect.stringContaining("This browser is not supported") as unknown,
      })
      expect(fetchModule).not.toHaveBeenCalled()
    } finally {
      globalThis.DecompressionStream = original
    }
  })

  it("fails clearly when the module cannot be downloaded", async () => {
    await expect(
      resolveDuckDBModuleSource("/assets/duckdb-eh-abc.wasm.gz", () =>
        Promise.resolve(new Response("missing", { status: 404 })),
      ),
    ).rejects.toThrow(/could not be downloaded/)
  })
})
