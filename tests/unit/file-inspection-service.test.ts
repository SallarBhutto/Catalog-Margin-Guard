import {
  FileInspectionService,
  parseCompletePrefixRows,
  validateDelimitedPrefix,
} from "@/features/file-inspection/file-inspection-service"
import type { FileInspectionEngine } from "@/features/file-inspection/file-inspection-service"
import type { DuckDBConnection, DuckDBQueryResult } from "@/lib/duckdb/duckdb-types"

function createQueryResult(
  fields: readonly string[],
  rows: readonly (readonly unknown[])[],
) {
  const result: DuckDBQueryResult = {
    schema: { fields: fields.map((name) => ({ name })) },
    numRows: rows.length,
    getChild: (name) => {
      const index = fields.indexOf(name)
      return index < 0 ? null : { get: (rowIndex) => rows[rowIndex]?.[index] }
    },
    getChildAt: (index) =>
      index < 0 || index >= fields.length
        ? null
        : { get: (rowIndex) => rows[rowIndex]?.[index] },
  }
  return result
}

function createServiceHarness(headers = ["Supplier SKU", "Unit Cost"]) {
  const query = vi.fn((sql: string) => {
    if (sql.includes("sniff_csv")) {
      return Promise.resolve(
        createQueryResult(
          ["Delimiter", "HasHeader"],
          [[sql.includes("delim = '\t'") ? "\t" : ",", true]],
        ),
      )
    }

    if (sql.includes("header = false")) {
      return Promise.resolve(
        createQueryResult(
          headers.map((_, index) => `column${index}`),
          [headers],
        ),
      )
    }

    return Promise.resolve(createQueryResult(headers, [["001234", "12.50"]]))
  })
  const connection: DuckDBConnection = {
    query,
    close: vi.fn(() => Promise.resolve()),
  }
  const registerBrowserFile = vi.fn(() => Promise.resolve())
  const dropRegisteredFile = vi.fn(() => Promise.resolve())
  const engine: FileInspectionEngine = {
    registerBrowserFile,
    dropRegisteredFile,
    withConnection: <T>(operation: (value: DuckDBConnection) => Promise<T>) =>
      operation(connection),
  }

  return {
    service: new FileInspectionService(engine),
    query,
    registerBrowserFile,
    dropRegisteredFile,
  }
}

describe("file inspection service ownership", () => {
  it("detects inconsistent row widths in a bounded delimited prefix", () => {
    const rows = parseCompletePrefixRows(
      "sku,cost,description\n001234,12.50,widget,unexpected\n",
      ",",
      true,
    )
    expect(rows.map((row) => row.length)).toEqual([3, 4])
  })

  it("rejects a browser File with inconsistent row widths", async () => {
    const file = new File(
      ["sku,cost,description\n001234,12.50,widget,unexpected\nABC-12,96.00,widget\n"],
      "malformed.csv",
    )
    await expect(validateDelimitedPrefix(file, ",")).rejects.toMatchObject({
      code: "CSV_PARSE_FAILED",
    })
  })

  it("registers the browser File directly and preserves raw preview strings", async () => {
    const harness = createServiceHarness()
    const file = new File(["Supplier SKU,Unit Cost\n001234,12.50"], "private-name.csv", {
      type: "text/csv",
    })

    const result = await harness.service.inspect("supplier", file)

    expect(harness.registerBrowserFile).toHaveBeenCalledWith("supplier-input.csv", file)
    expect(
      harness.query.mock.calls.every(([sql]) => !sql.includes("private-name.csv")),
    ).toBe(true)
    expect(result.preview[0]?.["Supplier SKU"]).toBe("001234")
    expect(result.columns.map((column) => column.name)).toEqual([
      "Supplier SKU",
      "Unit Cost",
    ])
  })

  it("drops a previous role registration before replacing it without touching the other role", async () => {
    const harness = createServiceHarness()
    const first = new File(["a,b\n1,2"], "supplier.csv")
    const catalog = new File(["a,b\n1,2"], "catalog.csv")
    const replacement = new File(["a\tb\n1\t2"], "replacement.tsv")

    await harness.service.inspect("supplier", first)
    await harness.service.inspect("catalog", catalog)
    harness.dropRegisteredFile.mockClear()

    await harness.service.inspect("supplier", replacement)

    expect(harness.dropRegisteredFile).toHaveBeenCalledTimes(1)
    expect(harness.dropRegisteredFile).toHaveBeenCalledWith("supplier-input.csv")
    expect(harness.dropRegisteredFile).not.toHaveBeenCalledWith("catalog-input.csv")
    expect(harness.registerBrowserFile).toHaveBeenLastCalledWith(
      "supplier-input.tsv",
      replacement,
    )
  })

  it("releases the old registration even when a replacement format is unsupported", async () => {
    const harness = createServiceHarness()
    await harness.service.inspect("supplier", new File(["a,b\n1,2"], "supplier.csv"))
    harness.dropRegisteredFile.mockClear()

    await expect(
      harness.service.inspect("supplier", new File(["a"], "supplier.xlsx")),
    ).rejects.toMatchObject({ code: "UNSUPPORTED_FILE_FORMAT" })

    expect(harness.dropRegisteredFile).toHaveBeenCalledWith("supplier-input.csv")
  })

  it("rejects duplicate source headers instead of accepting parser-renamed columns", async () => {
    const harness = createServiceHarness(["sku", "cost", "SKU"])

    await expect(
      harness.service.inspect(
        "supplier",
        new File(["sku,cost,SKU\n1,2,3"], "supplier.csv"),
      ),
    ).rejects.toMatchObject({ code: "DUPLICATE_COLUMN_NAMES" })
    expect(harness.dropRegisteredFile).toHaveBeenCalledWith("supplier-input.csv")
  })
})
