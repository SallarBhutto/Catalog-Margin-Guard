import {
  ANALYSIS_METADATA_SQL,
  CREATE_IDENTIFIER_MATCHES_SQL,
  createAnalysisResultsSql,
} from "@/features/analysis/margin-analysis-sql"
import type { AnalysisConfiguration } from "@/features/setup/analysis-configuration"

const configuration: AnalysisConfiguration = {
  mapping: {
    supplierIdentifier: "sku",
    supplierCost: "cost",
    catalogIdentifier: "sku",
    catalogPrice: "price",
    catalogMarginOverride: "margin",
  },
  options: {
    storeDefaultMargin: 20,
    caseInsensitive: true,
    numberFormat: "US",
    currency: "USD",
  },
}

describe("margin analysis SQL", () => {
  it("builds duplicate-safe identifier matches independently from pricing validity", () => {
    expect(CREATE_IDENTIFIER_MATCHES_SQL).toContain("'MATCHED' AS match_status")
    expect(CREATE_IDENTIFIER_MATCHES_SQL).toContain("'SUPPLIER_ONLY' AS match_status")
    expect(CREATE_IDENTIFIER_MATCHES_SQL).toContain("'CATALOG_ONLY' AS match_status")
    expect(CREATE_IDENTIFIER_MATCHES_SQL).not.toContain("is_supplier_cost_valid\n  AND")
    expect(CREATE_IDENTIFIER_MATCHES_SQL).not.toContain("is_selling_price_valid\n  AND")
  })

  it("does not turn a duplicate counterpart into a normal one-sided product", () => {
    expect(CREATE_IDENTIFIER_MATCHES_SQL).toContain("FROM normalized_catalog AS catalog")
    expect(CREATE_IDENTIFIER_MATCHES_SQL).toContain(
      "catalog.normalized_identifier = supplier.match_key",
    )
    expect(CREATE_IDENTIFIER_MATCHES_SQL).toContain(
      "FROM normalized_supplier AS supplier",
    )
    expect(CREATE_IDENTIFIER_MATCHES_SQL).toContain(
      "supplier.normalized_identifier = catalog.match_key",
    )
  })

  it("uses catalog display identifiers, fixed-point targets, exact status comparison, and cent ceilings", () => {
    const sql = createAnalysisResultsSql(configuration)

    expect(sql).toContain("catalog_original_identifier AS display_identifier")
    expect(sql).toContain("CAST('20' AS DECIMAL(7,4))")
    expect(sql).toContain("CAST(NULL AS DECIMAL(7,4)) AS manual_override_margin_pct")
    expect(sql).toContain("WHEN catalog_margin_override IS NOT NULL")
    expect(sql).toContain("THEN 'CATALOG_OVERRIDE'")
    expect(sql).toContain("ELSE 'STORE_DEFAULT'")
    expect(sql).toContain("CAST(100 AS DECIMAL(7,4)) * gross_profit")
    expect(sql).toContain("< effective_target_margin_pct * selling_price")
    expect(sql).toContain("+ target_denominator_units")
    expect(sql).toContain("- CAST(1 AS HUGEINT)")
    expect(sql).toContain("// target_denominator_units")
    expect(sql).not.toContain("ROUND(")
    expect(sql).not.toContain("DOUBLE")
    expect(sql).not.toContain("FLOAT")
  })

  it("defines exhaustive, non-overlapping exposure and scalar-only aggregates", () => {
    expect(ANALYSIS_METADATA_SQL).toContain(
      "gross_margin_pct >= CAST(0 AS DECIMAL(38,12)) AND gross_margin_pct < CAST(5 AS DECIMAL(38,12))",
    )
    expect(ANALYSIS_METADATA_SQL).toContain(
      "gross_margin_pct >= CAST(30 AS DECIMAL(38,12))",
    )
    expect(ANALYSIS_METADATA_SQL).not.toMatch(/SELECT\s+\*\s+FROM analysis_results/i)
  })
})
