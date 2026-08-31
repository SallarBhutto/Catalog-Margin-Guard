import {
  NORMALIZED_CATALOG_RELATION,
  NORMALIZED_SUPPLIER_RELATION,
  createNormalizationSql,
} from "@/features/analysis/normalization-sql"
import type { AnalysisConfiguration } from "@/features/setup/analysis-configuration"

const configuration: AnalysisConfiguration = {
  mapping: {
    supplierIdentifier: 'Supplier "SKU"',
    supplierCost: "select",
    catalogIdentifier: "Produkt № / ID",
    catalogPrice: 'Selling "Price"',
    catalogMarginOverride: "marge-%",
  },
  options: {
    storeDefaultMargin: 20,
    caseInsensitive: true,
    numberFormat: "US",
    currency: "USD",
  },
}

const sources = {
  supplier: {
    internalName: "supplier-input.csv",
    delimiter: ",",
    columns: ['Supplier "SKU"', "select", "Unicode / note"],
  },
  catalog: {
    internalName: "catalog-input.csv",
    delimiter: ",",
    columns: ["Produkt № / ID", 'Selling "Price"', "marge-%"],
  },
} as const

describe("normalization SQL", () => {
  it("quotes discovered source columns and uses only controlled relation/file names", () => {
    const sql = createNormalizationSql(configuration, sources)

    expect(sql.supplier).toContain('CAST("Supplier ""SKU""" AS VARCHAR)')
    expect(sql.supplier).toContain('CAST("select" AS VARCHAR)')
    expect(sql.catalog).toContain('CAST("Produkt № / ID" AS VARCHAR)')
    expect(sql.catalog).toContain('CAST("Selling ""Price""" AS VARCHAR)')
    expect(sql.catalog).toContain('CAST("marge-%" AS VARCHAR)')
    expect(sql.supplier).toContain("read_csv('supplier-input.csv'")
    expect(sql.catalog).toContain("read_csv('catalog-input.csv'")
    expect(sql.supplier).toContain(`CREATE TABLE ${NORMALIZED_SUPPLIER_RELATION}`)
    expect(sql.catalog).toContain(`CREATE TABLE ${NORMALIZED_CATALOG_RELATION}`)
  })

  it("rejects stale mapped columns before producing executable SQL", () => {
    expect(() =>
      createNormalizationSql(
        {
          ...configuration,
          mapping: { ...configuration.mapping, supplierCost: "missing" },
        },
        sources,
      ),
    ).toThrow("Column is not present in the discovered schema")
  })

  it("builds case-sensitive keys without removing identifier punctuation", () => {
    const sql = createNormalizationSql(
      {
        ...configuration,
        options: { ...configuration.options, caseInsensitive: false },
      },
      sources,
    )

    expect(sql.supplier).toContain("ELSE trim(original_identifier) END")
    expect(sql.supplier).not.toContain("upper(trim(original_identifier))")
    expect(sql.supplier).not.toMatch(/replace\([^)]*original_identifier/)
  })

  it("uses fixed-point DECIMAL parsing for money and percentage-point overrides", () => {
    const sql = createNormalizationSql(configuration, sources)

    expect(sql.supplier).toContain("DECIMAL(18,4)")
    expect(sql.catalog).toContain("DECIMAL(18,4)")
    expect(sql.catalog).toContain("DECIMAL(7,4)")
    expect(sql.catalog).toContain("BETWEEN CAST(0 AS DECIMAL(7,4))")
    expect(sql.catalog).toContain("CAST(95 AS DECIMAL(7,4))")
    expect(sql.catalog).not.toContain("DOUBLE")
    expect(sql.catalog).not.toContain("FLOAT")
  })

  it("treats an unmapped override as valid absence", () => {
    const sql = createNormalizationSql(
      {
        ...configuration,
        mapping: {
          supplierIdentifier: configuration.mapping.supplierIdentifier,
          supplierCost: configuration.mapping.supplierCost,
          catalogIdentifier: configuration.mapping.catalogIdentifier,
          catalogPrice: configuration.mapping.catalogPrice,
        },
      },
      sources,
    )

    expect(sql.catalog).toContain("CAST(NULL AS VARCHAR) AS raw_margin_override")
    expect(sql.catalog).toContain("NOT has_margin_override OR")
  })
})
