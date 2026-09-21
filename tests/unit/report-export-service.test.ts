import {
  ReportExportService,
  createReportFilename,
} from "@/features/exports/report-export-service"
import type { DuckDBRecordBatch } from "@/lib/duckdb/duckdb-types"

type ExportRow = Readonly<{
  identifier: string
  supplier_cost: string
  selling_price: string
  gross_margin_percent: string
  target_margin_percent: string
  target_source: string
  price_for_target_margin: string
  status: string
}>

const allowed = { canExportResults: true }

function row(overrides: Partial<ExportRow> = {}): ExportRow {
  return {
    identifier: "ABC-12",
    supplier_cost: "96.0000",
    selling_price: "105.0000",
    gross_margin_percent: "8.5714",
    target_margin_percent: "10.0000",
    target_source: "CATALOG_OVERRIDE",
    price_for_target_margin: "106.67",
    status: "REVIEW",
    ...overrides,
  }
}

function batch(rows: readonly ExportRow[]): DuckDBRecordBatch {
  return {
    numRows: rows.length,
    getChild: (name) => ({
      get: (index) => rows[index]?.[name as keyof ExportRow] ?? null,
    }),
  }
}

async function readCsv(file: Blob) {
  const bytes = new Uint8Array(
    await new Promise<ArrayBuffer>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as ArrayBuffer)
      reader.onerror = () => reject(new Error("read failed"))
      reader.readAsArrayBuffer(file)
    }),
  )
  return {
    hasUtf8Bom: bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf,
    // Keep the byte-order mark in the decoded text so the test sees the exact file content.
    text: new TextDecoder("utf-8", { ignoreBOM: true }).decode(bytes),
  }
}

function createHarness(
  batches: readonly DuckDBRecordBatch[],
  hooks: { beforeBatch?: (index: number) => void; failAtBatch?: number } = {},
) {
  const analysis = { current: { id: "analysis-1" } as object | null }
  const deliver = vi.fn<(file: Blob, filename: string) => void>()
  const cancelSent = vi.fn(() => Promise.resolve(true))
  const sentSql: string[] = []
  const send = vi.fn((sql: string, allowStreamResult?: boolean) => {
    sentSql.push(`${sql}|stream=${String(allowStreamResult)}`)
    async function* stream() {
      for (const [index, item] of batches.entries()) {
        await Promise.resolve()
        hooks.beforeBatch?.(index)
        if (hooks.failAtBatch === index) throw new Error("engine failure")
        yield item
      }
    }
    return Promise.resolve(stream())
  })
  const exclusiveRuns: string[] = []
  const service = new ReportExportService({
    engine: { withConnection: (operation) => operation({ send, cancelSent }) },
    coordinator: {
      runExclusive: async (operation) => {
        exclusiveRuns.push("start")
        try {
          return await operation()
        } finally {
          exclusiveRuns.push("end")
        }
      },
    },
    analysis: { getLatestResult: () => analysis.current },
    deliver,
    now: () => new Date(2026, 8, 5, 23, 59),
    log: vi.fn(),
  })

  return { analysis, cancelSent, deliver, exclusiveRuns, send, sentSql, service }
}

describe("report export service", () => {
  it("names reports with the local date", () => {
    const date = new Date(2026, 0, 9, 8, 0)
    expect(createReportFilename("PRODUCTS_TO_REVIEW", date)).toBe(
      "products-to-review-2026-01-09.csv",
    )
    expect(createReportFilename("FULL_MARGIN_REPORT", date)).toBe(
      "catalog-margin-report-2026-01-09.csv",
    )
  })

  it("rejects anonymous access before touching the engine", async () => {
    const harness = createHarness([batch([row()])])

    await expect(
      harness.service.exportReport("FULL_MARGIN_REPORT", { canExportResults: false }),
    ).rejects.toMatchObject({ code: "NOT_ALLOWED" })
    expect(harness.send).not.toHaveBeenCalled()
    expect(harness.exclusiveRuns).toEqual([])
    expect(harness.deliver).not.toHaveBeenCalled()
  })

  it("requires an active analysis", async () => {
    const harness = createHarness([batch([row()])])
    harness.analysis.current = null

    await expect(
      harness.service.exportReport("FULL_MARGIN_REPORT", allowed),
    ).rejects.toMatchObject({ code: "NO_ANALYSIS" })
    expect(harness.send).not.toHaveBeenCalled()
  })

  it("streams every batch into one CSV inside the override queue", async () => {
    const progress: number[] = []
    const harness = createHarness([
      batch([
        row({
          identifier: "KLP-91",
          supplier_cost: "151.0000",
          selling_price: "149.0000",
          gross_margin_percent: "-1.3423",
          target_margin_percent: "20.0000",
          target_source: "STORE_DEFAULT",
          price_for_target_margin: "188.75",
          status: "LOSS",
        }),
        row(),
      ]),
      batch([
        row({
          identifier: "=SUM(A1)",
          target_source: "MANUAL_OVERRIDE",
          target_margin_percent: "35.5000",
        }),
        row({ identifier: '00123,"x"', status: "OK", target_source: "STORE_DEFAULT" }),
      ]),
    ])

    const outcome = await harness.service.exportReport("FULL_MARGIN_REPORT", allowed, {
      onProgress: (rows) => progress.push(rows),
    })

    expect(outcome).toEqual({
      status: "DOWNLOADED",
      rows: 4,
      filename: "catalog-margin-report-2026-09-05.csv",
    })
    expect(progress).toEqual([2, 4])
    expect(harness.exclusiveRuns).toEqual(["start", "end"])
    expect(harness.sentSql).toHaveLength(1)
    expect(harness.sentSql[0]).toContain("FROM analysis_results")
    expect(harness.sentSql[0]).toContain("|stream=true")

    expect(harness.deliver).toHaveBeenCalledOnce()
    const [file, filename] = harness.deliver.mock.calls[0] ?? []
    expect(filename).toBe("catalog-margin-report-2026-09-05.csv")
    expect(file?.type).toBe("text/csv;charset=utf-8")
    const csv = await readCsv(file as Blob)
    expect(csv.hasUtf8Bom).toBe(true)
    expect(csv.text.codePointAt(0)).toBe(0xfeff)
    expect(csv.text.slice(1)).toBe(
      [
        "identifier,supplier_cost,selling_price,gross_margin_percent,target_margin_percent,target_source,price_for_target_margin,status",
        "KLP-91,151.00,149.00,-1.3423,20.00,Store Default,188.75,LOSS",
        "ABC-12,96.00,105.00,8.5714,10.00,Product Override,106.67,REVIEW",
        `"'=SUM(A1)",96.00,105.00,8.5714,35.50,Manual Override,106.67,REVIEW`,
        `"00123,""x""",96.00,105.00,8.5714,10.00,Store Default,106.67,OK`,
        "",
      ].join("\r\n"),
    )
  })

  it("reports an empty report without creating a file", async () => {
    const harness = createHarness([])

    await expect(
      harness.service.exportReport("PRODUCTS_TO_REVIEW", allowed),
    ).resolves.toEqual({ status: "EMPTY" })
    expect(harness.sentSql[0]).toContain("WHERE status IN ('LOSS', 'REVIEW')")
    expect(harness.deliver).not.toHaveBeenCalled()
  })

  it("cancels the statement and never downloads when cancelled mid-generation", async () => {
    const harness = createHarness([batch([row()]), batch([row()]), batch([row()])], {
      beforeBatch: (index) => {
        if (index === 1) harness.service.cancelActive()
      },
    })

    await expect(
      harness.service.exportReport("FULL_MARGIN_REPORT", allowed),
    ).resolves.toEqual({ status: "CANCELLED" })
    expect(harness.cancelSent).toHaveBeenCalledOnce()
    expect(harness.deliver).not.toHaveBeenCalled()

    // The service is reusable after a cancellation.
    const retry = createHarness([batch([row()])])
    await expect(
      retry.service.exportReport("FULL_MARGIN_REPORT", allowed),
    ).resolves.toMatchObject({ status: "DOWNLOADED", rows: 1 })
  })

  it("invalidates the export when the analysis is cleared or replaced", async () => {
    const replaced = createHarness([batch([row()]), batch([row()])], {
      beforeBatch: (index) => {
        if (index === 1) replaced.analysis.current = { id: "analysis-2" }
      },
    })
    await expect(
      replaced.service.exportReport("FULL_MARGIN_REPORT", allowed),
    ).resolves.toEqual({ status: "CANCELLED" })
    expect(replaced.deliver).not.toHaveBeenCalled()

    // Dropping the relation makes the running statement fail; that is still a cancellation.
    const cleared = createHarness([batch([row()]), batch([row()])], {
      beforeBatch: (index) => {
        if (index === 1) cleared.analysis.current = null
      },
      failAtBatch: 1,
    })
    await expect(
      cleared.service.exportReport("FULL_MARGIN_REPORT", allowed),
    ).resolves.toEqual({ status: "CANCELLED" })
    expect(cleared.deliver).not.toHaveBeenCalled()
  })

  it("does not download when invalidated after the final batch", async () => {
    const harness = createHarness([batch([row()])])
    const originalRunExclusive = harness.service
    const outcome = originalRunExclusive.exportReport("FULL_MARGIN_REPORT", allowed, {
      onProgress: () => harness.service.cancelActive(),
    })

    await expect(outcome).resolves.toEqual({ status: "CANCELLED" })
    expect(harness.deliver).not.toHaveBeenCalled()
  })

  it("refuses a second export while one is being prepared", async () => {
    const harness = createHarness([batch([row()])])
    const first = harness.service.exportReport("FULL_MARGIN_REPORT", allowed)

    await expect(
      harness.service.exportReport("PRODUCTS_TO_REVIEW", allowed),
    ).rejects.toMatchObject({ code: "BUSY" })
    await expect(first).resolves.toMatchObject({ status: "DOWNLOADED" })
    expect(harness.deliver).toHaveBeenCalledOnce()
  })

  it("fails without a partial file when the engine fails", async () => {
    const harness = createHarness([batch([row()]), batch([row()])], { failAtBatch: 1 })

    await expect(
      harness.service.exportReport("FULL_MARGIN_REPORT", allowed),
    ).rejects.toMatchObject({ code: "FAILED" })
    expect(harness.deliver).not.toHaveBeenCalled()

    // A failure releases the service for another attempt.
    await expect(
      harness.service.exportReport("FULL_MARGIN_REPORT", allowed),
    ).rejects.toMatchObject({ code: "FAILED" })
  })

  it("fails instead of writing unexpected values", async () => {
    for (const badRow of [
      row({ supplier_cost: "=1+1" }),
      row({ status: "UNKNOWN" }),
      row({ target_source: "OTHER" }),
    ]) {
      const harness = createHarness([batch([badRow])])
      await expect(
        harness.service.exportReport("FULL_MARGIN_REPORT", allowed),
      ).rejects.toMatchObject({ code: "FAILED" })
      expect(harness.deliver).not.toHaveBeenCalled()
    }
  })
})
