import type {
  CatalogColumnSuggestions,
  FileRole,
  SupplierColumnSuggestions,
} from "@/features/file-inspection/file-inspection-types"

const PRODUCT_IDENTIFIER_ALIASES = [
  "sku",
  "supplier_sku",
  "product_sku",
  "item_sku",
  "item_number",
  "item_no",
  "part_number",
  "part_no",
  "mpn",
  "upc",
  "ean",
  "gtin",
  "product_code",
  "item_code",
] as const

const SUPPLIER_COST_ALIASES = [
  "cost",
  "unit_cost",
  "supplier_cost",
  "wholesale_cost",
  "wholesale_price",
  "net_cost",
  "buy_price",
  "purchase_price",
] as const

const SELLING_PRICE_ALIASES = [
  "price",
  "selling_price",
  "sell_price",
  "retail_price",
  "regular_price",
  "current_price",
] as const

const MARGIN_OVERRIDE_ALIASES = [
  "margin",
  "target_margin",
  "minimum_margin",
  "min_margin",
  "margin_floor",
  "margin_pct",
  "target_margin_pct",
  "min_margin_pct",
  "minimum_margin_pct",
] as const

function normalizeHeaderForSuggestion(header: string) {
  return header
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_")
    .replace(/_+/g, "_")
}

function findUnambiguousSuggestion(
  columns: readonly string[],
  aliases: readonly string[],
): string | undefined {
  const aliasSet = new Set(aliases)
  const matches = columns.filter((column) =>
    aliasSet.has(normalizeHeaderForSuggestion(column)),
  )

  return matches.length === 1 ? matches[0] : undefined
}

function suggestSupplierColumns(columns: readonly string[]): SupplierColumnSuggestions {
  return {
    productIdentifier: findUnambiguousSuggestion(columns, PRODUCT_IDENTIFIER_ALIASES),
    supplierCost: findUnambiguousSuggestion(columns, SUPPLIER_COST_ALIASES),
  }
}

function suggestCatalogColumns(columns: readonly string[]): CatalogColumnSuggestions {
  return {
    productIdentifier: findUnambiguousSuggestion(columns, PRODUCT_IDENTIFIER_ALIASES),
    sellingPrice: findUnambiguousSuggestion(columns, SELLING_PRICE_ALIASES),
    marginOverride: findUnambiguousSuggestion(columns, MARGIN_OVERRIDE_ALIASES),
  }
}

function suggestColumns(role: FileRole, columns: readonly string[]) {
  return role === "supplier"
    ? suggestSupplierColumns(columns)
    : suggestCatalogColumns(columns)
}

export {
  findUnambiguousSuggestion,
  normalizeHeaderForSuggestion,
  suggestCatalogColumns,
  suggestColumns,
  suggestSupplierColumns,
}
