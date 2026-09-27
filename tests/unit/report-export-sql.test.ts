import {
  REPORT_COLUMNS,
  createReportExportSql,
  type ReportKind,
} from "@/features/exports/report-export-sql"

describe("report export SQL", () => {
  it("uses the column names and order defined by the product requirements", () => {
    expect(REPORT_COLUMNS).toEqual([
      "identifier",
      "supplier_cost",
      "selling_price",
      "gross_margin_percent",
      "target_margin_percent",
      "target_source",
      "price_for_target_margin",
      "status",
    ])
  })

  it("limits Products To Review to LOSS and REVIEW rows", () => {
    const sql = createReportExportSql("PRODUCTS_TO_REVIEW")
    expect(sql).toContain("WHERE status IN ('LOSS', 'REVIEW')")
  })

  it("includes every analyzed product in the Full Margin Report", () => {
    const sql = createReportExportSql("FULL_MARGIN_REPORT")
    expect(sql).not.toMatch(/\bWHERE\b/)
  })

  it("reads stored analysis values in a deterministic risk order without pagination", () => {
    for (const kind of ["PRODUCTS_TO_REVIEW", "FULL_MARGIN_REPORT"] as const) {
      const sql = createReportExportSql(kind)
      expect(sql).toContain("FROM analysis_results")
      expect(sql).toContain("effective_target_margin_pct")
      expect(sql).toContain("price_for_target_margin")
      expect(sql).toContain("WHEN 'LOSS' THEN 0")
      expect(sql).toContain("gross_margin_pct ASC")
      expect(sql).toContain("display_identifier ASC")
      expect(sql).toContain("catalog_source_row_id ASC")
      expect(sql).not.toMatch(/SELECT\s+\*/i)
      expect(sql).not.toMatch(/\b(LIMIT|OFFSET|ILIKE)\b/i)
      // Status and price come from the analysis relation; the export never recomputes them.
      expect(sql).not.toMatch(/selling_price\s*</)
    }
  })

  it("rejects unknown report kinds", () => {
    expect(() => createReportExportSql("EVERYTHING" as ReportKind)).toThrow(
      /unsupported/i,
    )
  })
})
