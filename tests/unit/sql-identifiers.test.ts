import { quoteDiscoveredColumn, quoteSqlIdentifier } from "@/lib/security/sql-identifiers"

describe("SQL identifier safety", () => {
  it.each([
    ["Supplier SKU", '"Supplier SKU"'],
    ['cost"quoted', '"cost""quoted"'],
    ["select", '"select"'],
    ["日本語", '"日本語"'],
    ["sku); DROP TABLE data; --", '"sku); DROP TABLE data; --"'],
  ])("quotes %s as one DuckDB identifier", (input, expected) => {
    expect(quoteSqlIdentifier(input)).toBe(expected)
  })

  it("only quotes columns discovered in the current schema", () => {
    expect(quoteDiscoveredColumn("Supplier SKU", ["Supplier SKU", "Cost"])).toBe(
      '"Supplier SKU"',
    )
    expect(() => quoteDiscoveredColumn("not discovered", ["Supplier SKU"])).toThrow(
      "Column is not present",
    )
  })
})
