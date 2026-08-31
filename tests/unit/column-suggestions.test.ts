import {
  normalizeHeaderForSuggestion,
  suggestCatalogColumns,
  suggestSupplierColumns,
} from "@/features/file-inspection/column-suggestions"

describe("deterministic header suggestions", () => {
  it.each([
    [" Supplier SKU ", "supplier_sku"],
    ["supplier-sku", "supplier_sku"],
    ["SUPPLIER   SKU", "supplier_sku"],
    ["min-margin-pct", "min_margin_pct"],
  ])("normalizes %s for matching only", (input, expected) => {
    expect(normalizeHeaderForSuggestion(input)).toBe(expected)
  })

  it.each([
    ["sku", "sku"],
    ["Part Number", "Part Number"],
    ["item-no", "item-no"],
    ["GTIN", "GTIN"],
  ])("suggests important product identifier alias %s", (header, original) => {
    expect(suggestSupplierColumns([header]).productIdentifier).toBe(original)
  })

  it.each(["cost", "Unit Cost", "wholesale-price", "Purchase Price"])(
    "suggests supplier cost alias %s",
    (header) => {
      expect(suggestSupplierColumns([header]).supplierCost).toBe(header)
    },
  )

  it("suggests catalog price and optional margin override aliases", () => {
    expect(suggestCatalogColumns(["Product SKU", "Retail Price", "Min Margin"])).toEqual({
      productIdentifier: "Product SKU",
      sellingPrice: "Retail Price",
      marginOverride: "Min Margin",
    })
  })

  it("preserves the exact original column name", () => {
    const original = "  Supplier SKU  "
    expect(suggestSupplierColumns([original]).productIdentifier).toBe(original)
  })

  it("returns no suggestion when more than one column matches a field", () => {
    expect(
      suggestSupplierColumns(["SKU", "supplier_sku"]).productIdentifier,
    ).toBeUndefined()
  })

  it("does not fuzzy match unrelated headers", () => {
    expect(suggestCatalogColumns(["productish", "best guess price"])).toEqual({
      productIdentifier: undefined,
      sellingPrice: undefined,
      marginOverride: undefined,
    })
  })
})
