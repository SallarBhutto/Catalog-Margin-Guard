import {
  analysisSetupReducer,
  createDefaultAnalysisSetupDraft,
  validateAnalysisConfiguration,
  type AnalysisSetupContext,
  type AnalysisSetupDraft,
} from "@/features/setup/analysis-configuration"

const context: AnalysisSetupContext = {
  supplier: {
    ready: true,
    columns: ["Supplier SKU", "Unit Cost", "Description"],
  },
  catalog: {
    ready: true,
    columns: ["SKU", "Selling Price", "min_margin", "Title"],
  },
}

function completeDraft(overrides: Partial<AnalysisSetupDraft["options"]> = {}) {
  const defaults = createDefaultAnalysisSetupDraft()
  return {
    mapping: {
      supplierIdentifier: "Supplier SKU",
      supplierCost: "Unit Cost",
      catalogIdentifier: "SKU",
      catalogPrice: "Selling Price",
      catalogMarginOverride: null,
    },
    options: { ...defaults.options, ...overrides },
  } satisfies AnalysisSetupDraft
}

describe("analysis configuration validation", () => {
  it("requires both supplier mappings", () => {
    const draft = completeDraft()
    const result = validateAnalysisConfiguration(
      {
        ...draft,
        mapping: {
          ...draft.mapping,
          supplierIdentifier: null,
          supplierCost: null,
        },
      },
      context,
    )

    expect(result.errors.supplierIdentifier).toBe(
      "Select the supplier product identifier column.",
    )
    expect(result.errors.supplierCost).toBe("Select the supplier cost column.")
    expect(result.isReady).toBe(false)
  })

  it("requires both catalog mappings", () => {
    const draft = completeDraft()
    const result = validateAnalysisConfiguration(
      {
        ...draft,
        mapping: {
          ...draft.mapping,
          catalogIdentifier: null,
          catalogPrice: null,
        },
      },
      context,
    )

    expect(result.errors.catalogIdentifier).toBe(
      "Select the catalog product identifier column.",
    )
    expect(result.errors.catalogPrice).toBe("Select the catalog selling price column.")
  })

  it("accepts None for the optional catalog override", () => {
    const result = validateAnalysisConfiguration(completeDraft(), context)

    expect(result.isReady).toBe(true)
    expect(result.configuration?.mapping.catalogMarginOverride).toBeUndefined()
  })

  it("accepts a discovered catalog override column", () => {
    const draft = completeDraft()
    const result = validateAnalysisConfiguration(
      {
        ...draft,
        mapping: { ...draft.mapping, catalogMarginOverride: "min_margin" },
      },
      context,
    )

    expect(result.configuration?.mapping.catalogMarginOverride).toBe("min_margin")
  })

  it("rejects invalid or stale source columns", () => {
    const draft = completeDraft()
    const result = validateAnalysisConfiguration(
      {
        ...draft,
        mapping: {
          ...draft.mapping,
          supplierCost: "Old Cost",
          catalogMarginOverride: "Removed Margin",
        },
      },
      context,
    )

    expect(result.errors.supplierCost).toContain("no longer available")
    expect(result.errors.catalogMarginOverride).toContain("no longer available")
  })

  it("rejects duplicate supplier and catalog role mappings", () => {
    const draft = completeDraft()
    const result = validateAnalysisConfiguration(
      {
        ...draft,
        mapping: {
          supplierIdentifier: "Supplier SKU",
          supplierCost: "Supplier SKU",
          catalogIdentifier: "SKU",
          catalogPrice: "Selling Price",
          catalogMarginOverride: "Selling Price",
        },
      },
      context,
    )

    expect(result.errors.supplierCost).toContain("product identifier")
    expect(result.errors.catalogMarginOverride).toContain("selling price")
    expect(result.isReady).toBe(false)
  })

  it.each([
    ["0", 0],
    ["20", 20],
    ["95", 95],
    ["35.25", 35.25],
    ["0.20", 0.2],
  ])("keeps %s as percentage points", (input, expected) => {
    const result = validateAnalysisConfiguration(
      completeDraft({ storeDefaultMargin: input }),
      context,
    )

    expect(result.configuration?.options.storeDefaultMargin).toBe(expected)
  })

  it.each(["-0.01", "95.01", "", "20%", "1e1"])(
    "rejects invalid margin value %s",
    (storeDefaultMargin) => {
      const result = validateAnalysisConfiguration(
        completeDraft({ storeDefaultMargin }),
        context,
      )

      expect(result.errors.storeDefaultMargin).toBe("Enter a margin between 0% and 95%.")
      expect(result.isReady).toBe(false)
    },
  )

  it.each(["US", "EU"] as const)("records the %s number format", (numberFormat) => {
    const result = validateAnalysisConfiguration(completeDraft({ numberFormat }), context)

    expect(result.configuration?.options.numberFormat).toBe(numberFormat)
  })

  it.each(["USD", "GBP", "EUR", "CAD", "AUD", "OTHER"] as const)(
    "records %s as a display currency without conversion",
    (currency) => {
      const result = validateAnalysisConfiguration(completeDraft({ currency }), context)

      expect(result.configuration?.options.currency).toBe(currency)
    },
  )

  it("defaults case-insensitive identifier matching to enabled", () => {
    expect(createDefaultAnalysisSetupDraft().options.caseInsensitive).toBe(true)
  })

  it("stays incomplete until files and required values are valid", () => {
    const result = validateAnalysisConfiguration(createDefaultAnalysisSetupDraft(), {
      supplier: { ready: false, columns: [] },
      catalog: { ready: false, columns: [] },
    })

    expect(result.status).toBe("CONFIGURATION_INCOMPLETE")
    expect(result.configuration).toBeUndefined()
  })

  it("returns a domain-only configuration at READY_FOR_ANALYSIS", () => {
    const result = validateAnalysisConfiguration(completeDraft(), context)

    expect(result.status).toBe("READY_FOR_ANALYSIS")
    expect(result.configuration).toEqual({
      mapping: {
        supplierIdentifier: "Supplier SKU",
        supplierCost: "Unit Cost",
        catalogIdentifier: "SKU",
        catalogPrice: "Selling Price",
      },
      options: {
        storeDefaultMargin: 20,
        caseInsensitive: true,
        numberFormat: "US",
        currency: "USD",
      },
    })
  })
})

describe("analysis setup state transitions", () => {
  it("replacing a supplier file invalidates only supplier mappings", () => {
    const next = analysisSetupReducer(completeDraft(), {
      type: "supplier-file-changed",
    })

    expect(next.mapping.supplierIdentifier).toBeNull()
    expect(next.mapping.supplierCost).toBeNull()
    expect(next.mapping.catalogIdentifier).toBe("SKU")
    expect(next.mapping.catalogPrice).toBe("Selling Price")
  })

  it("replacing a catalog file invalidates only catalog mappings", () => {
    const next = analysisSetupReducer(completeDraft(), {
      type: "catalog-file-changed",
    })

    expect(next.mapping.catalogIdentifier).toBeNull()
    expect(next.mapping.catalogPrice).toBeNull()
    expect(next.mapping.catalogMarginOverride).toBeNull()
    expect(next.mapping.supplierIdentifier).toBe("Supplier SKU")
    expect(next.mapping.supplierCost).toBe("Unit Cost")
  })

  it("initializes deterministic suggestions while keeping mappings user-editable", () => {
    const suggested = analysisSetupReducer(createDefaultAnalysisSetupDraft(), {
      type: "supplier-inspected",
      suggestions: {
        productIdentifier: "Supplier SKU",
        supplierCost: "Unit Cost",
      },
    })
    const edited = analysisSetupReducer(suggested, {
      type: "mapping-changed",
      field: "supplierIdentifier",
      value: "Description",
    })

    expect(suggested.mapping.supplierIdentifier).toBe("Supplier SKU")
    expect(edited.mapping.supplierIdentifier).toBe("Description")
  })
})
