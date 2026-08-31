import { FILE_LIMITS } from "@/app/config"
import { FileInspectionError } from "@/features/file-inspection/file-inspection-error"
import {
  createInternalFilename,
  getDelimitedFileFormat,
  getFileWarning,
  validateDelimitedFile,
} from "@/features/file-inspection/file-validation"

describe("delimited file validation", () => {
  it.each([
    ["supplier.csv", "CSV"],
    ["SUPPLIER.CSV", "CSV"],
    ["catalog.tsv", "TSV"],
  ] as const)("supports %s", (name, expected) => {
    expect(getDelimitedFileFormat(name)).toBe(expected)
  })

  it.each(["catalog.xlsx", "legacy.xls", "catalog.json", "catalog", "catalog.csv.exe"])(
    "rejects unsupported input %s",
    (name) => {
      expect(() => getDelimitedFileFormat(name)).toThrowError(
        expect.objectContaining({ code: "UNSUPPORTED_FILE_FORMAT" }),
      )
    },
  )

  it("returns a controlled empty-file error", () => {
    expect(() => validateDelimitedFile({ name: "empty.csv", size: 0 })).toThrowError(
      expect.objectContaining({ code: "FILE_EMPTY" }),
    )
  })

  it("uses synthetic internal names that never include the source filename", () => {
    expect(createInternalFilename("supplier", "CSV")).toBe("supplier-input.csv")
    expect(createInternalFilename("catalog", "TSV")).toBe("catalog-input.tsv")
    expect(createInternalFilename("supplier", "CSV")).not.toContain("private-prices")
  })

  it("warns above, but not at, the configurable 500 MB threshold", () => {
    expect(getFileWarning(FILE_LIMITS.csvWarningBytes)).toBeNull()
    expect(getFileWarning(FILE_LIMITS.csvWarningBytes + 1)).toBe("LARGE_FILE")
  })

  it("uses application-level file errors", () => {
    expect(() => getDelimitedFileFormat("catalog.pdf")).toThrow(FileInspectionError)
  })
})
