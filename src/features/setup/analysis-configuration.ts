import { z } from "zod"

import { marginPercentageTextSchema } from "@/features/analysis/margin-target-validation"
import type {
  CatalogColumnSuggestions,
  SupplierColumnSuggestions,
} from "@/features/file-inspection/file-inspection-types"

const NUMBER_FORMATS = ["US", "EU"] as const
const DISPLAY_CURRENCIES = ["USD", "GBP", "EUR", "CAD", "AUD", "OTHER"] as const

type NumberFormat = (typeof NUMBER_FORMATS)[number]
type DisplayCurrency = (typeof DISPLAY_CURRENCIES)[number]

type AnalysisMapping = Readonly<{
  supplierIdentifier: string
  supplierCost: string
  catalogIdentifier: string
  catalogPrice: string
  catalogMarginOverride?: string
}>

type AnalysisOptions = Readonly<{
  storeDefaultMargin: number
  caseInsensitive: boolean
  numberFormat: NumberFormat
  currency: DisplayCurrency
}>

type AnalysisConfiguration = Readonly<{
  mapping: AnalysisMapping
  options: AnalysisOptions
}>

type AnalysisSetupDraft = Readonly<{
  mapping: Readonly<{
    supplierIdentifier: string | null
    supplierCost: string | null
    catalogIdentifier: string | null
    catalogPrice: string | null
    catalogMarginOverride: string | null
  }>
  options: Readonly<{
    storeDefaultMargin: string
    caseInsensitive: boolean | null
    numberFormat: NumberFormat | null
    currency: DisplayCurrency | null
  }>
}>

type SetupFileContext = Readonly<{
  ready: boolean
  columns: readonly string[]
}>

type AnalysisSetupContext = Readonly<{
  supplier: SetupFileContext
  catalog: SetupFileContext
}>

type SetupValidationField =
  | "supplierFile"
  | "catalogFile"
  | "supplierIdentifier"
  | "supplierCost"
  | "catalogIdentifier"
  | "catalogPrice"
  | "catalogMarginOverride"
  | "storeDefaultMargin"
  | "numberFormat"
  | "currency"
  | "caseInsensitive"

type SetupValidationIssue = Readonly<{
  field: SetupValidationField
  code: "REQUIRED" | "STALE_COLUMN" | "DUPLICATE_ROLE" | "INVALID_VALUE"
  message: string
}>

type SetupValidationResult = Readonly<{
  status: "CONFIGURATION_INCOMPLETE" | "READY_FOR_ANALYSIS"
  isReady: boolean
  issues: readonly SetupValidationIssue[]
  errors: Readonly<Partial<Record<SetupValidationField, string>>>
  configuration?: AnalysisConfiguration
}>

type MappingField = keyof AnalysisSetupDraft["mapping"]

type AnalysisSetupAction =
  | Readonly<{ type: "reset" }>
  | Readonly<{ type: "supplier-file-changed" }>
  | Readonly<{ type: "catalog-file-changed" }>
  | Readonly<{
      type: "supplier-inspected"
      suggestions: SupplierColumnSuggestions
    }>
  | Readonly<{
      type: "catalog-inspected"
      suggestions: CatalogColumnSuggestions
    }>
  | Readonly<{
      type: "mapping-changed"
      field: MappingField
      value: string | null
    }>
  | Readonly<{ type: "margin-changed"; value: string }>
  | Readonly<{ type: "number-format-changed"; value: NumberFormat }>
  | Readonly<{ type: "currency-changed"; value: DisplayCurrency }>
  | Readonly<{ type: "case-sensitivity-changed"; value: boolean }>

const defaultMarginSchema = marginPercentageTextSchema.transform(Number)

const optionsSchema = z.object({
  storeDefaultMargin: defaultMarginSchema,
  caseInsensitive: z.boolean(),
  numberFormat: z.enum(NUMBER_FORMATS),
  currency: z.enum(DISPLAY_CURRENCIES),
})

function createDefaultAnalysisSetupDraft(): AnalysisSetupDraft {
  return {
    mapping: {
      supplierIdentifier: null,
      supplierCost: null,
      catalogIdentifier: null,
      catalogPrice: null,
      catalogMarginOverride: null,
    },
    options: {
      storeDefaultMargin: "20",
      caseInsensitive: true,
      numberFormat: "US",
      currency: "USD",
    },
  }
}

function analysisSetupReducer(
  state: AnalysisSetupDraft,
  action: AnalysisSetupAction,
): AnalysisSetupDraft {
  switch (action.type) {
    case "reset":
      return createDefaultAnalysisSetupDraft()
    case "supplier-file-changed":
      return {
        ...state,
        mapping: {
          ...state.mapping,
          supplierIdentifier: null,
          supplierCost: null,
        },
      }
    case "catalog-file-changed":
      return {
        ...state,
        mapping: {
          ...state.mapping,
          catalogIdentifier: null,
          catalogPrice: null,
          catalogMarginOverride: null,
        },
      }
    case "supplier-inspected":
      return {
        ...state,
        mapping: {
          ...state.mapping,
          supplierIdentifier: action.suggestions.productIdentifier ?? null,
          supplierCost: action.suggestions.supplierCost ?? null,
        },
      }
    case "catalog-inspected":
      return {
        ...state,
        mapping: {
          ...state.mapping,
          catalogIdentifier: action.suggestions.productIdentifier ?? null,
          catalogPrice: action.suggestions.sellingPrice ?? null,
          catalogMarginOverride: action.suggestions.marginOverride ?? null,
        },
      }
    case "mapping-changed":
      return {
        ...state,
        mapping: { ...state.mapping, [action.field]: action.value },
      }
    case "margin-changed":
      return {
        ...state,
        options: { ...state.options, storeDefaultMargin: action.value },
      }
    case "number-format-changed":
      return {
        ...state,
        options: { ...state.options, numberFormat: action.value },
      }
    case "currency-changed":
      return {
        ...state,
        options: { ...state.options, currency: action.value },
      }
    case "case-sensitivity-changed":
      return {
        ...state,
        options: { ...state.options, caseInsensitive: action.value },
      }
  }
}

function validateAnalysisConfiguration(
  draft: AnalysisSetupDraft,
  context: AnalysisSetupContext,
): SetupValidationResult {
  const issues: SetupValidationIssue[] = []
  const errors: Partial<Record<SetupValidationField, string>> = {}

  const addIssue = (issue: SetupValidationIssue) => {
    issues.push(issue)
    errors[issue.field] ??= issue.message
  }

  if (!context.supplier.ready) {
    addIssue({
      field: "supplierFile",
      code: "REQUIRED",
      message: "Choose and inspect a supplier file.",
    })
  }
  if (!context.catalog.ready) {
    addIssue({
      field: "catalogFile",
      code: "REQUIRED",
      message: "Choose and inspect a catalog file.",
    })
  }

  const validateRequiredMapping = (
    field: Extract<
      SetupValidationField,
      "supplierIdentifier" | "supplierCost" | "catalogIdentifier" | "catalogPrice"
    >,
    value: string | null,
    columns: readonly string[],
    label: string,
  ) => {
    if (!value) {
      addIssue({
        field,
        code: "REQUIRED",
        message: `Select the ${label} column.`,
      })
    } else if (!columns.includes(value)) {
      addIssue({
        field,
        code: "STALE_COLUMN",
        message: "This column is no longer available in the selected file.",
      })
    }
  }

  validateRequiredMapping(
    "supplierIdentifier",
    draft.mapping.supplierIdentifier,
    context.supplier.columns,
    "supplier product identifier",
  )
  validateRequiredMapping(
    "supplierCost",
    draft.mapping.supplierCost,
    context.supplier.columns,
    "supplier cost",
  )
  validateRequiredMapping(
    "catalogIdentifier",
    draft.mapping.catalogIdentifier,
    context.catalog.columns,
    "catalog product identifier",
  )
  validateRequiredMapping(
    "catalogPrice",
    draft.mapping.catalogPrice,
    context.catalog.columns,
    "catalog selling price",
  )

  if (
    draft.mapping.catalogMarginOverride &&
    !context.catalog.columns.includes(draft.mapping.catalogMarginOverride)
  ) {
    addIssue({
      field: "catalogMarginOverride",
      code: "STALE_COLUMN",
      message: "This column is no longer available in the selected file.",
    })
  }

  const addDuplicateIssues = (
    fields: readonly MappingField[],
    labels: Readonly<Partial<Record<MappingField, string>>>,
  ) => {
    for (const field of fields) {
      const value = draft.mapping[field]
      if (!value) continue

      const duplicate = fields.find(
        (candidate) => candidate !== field && draft.mapping[candidate] === value,
      )
      if (duplicate) {
        addIssue({
          field,
          code: "DUPLICATE_ROLE",
          message: `This column is already being used as ${labels[duplicate] ?? "another role"}.`,
        })
      }
    }
  }

  addDuplicateIssues(["supplierIdentifier", "supplierCost"], {
    supplierIdentifier: "the product identifier",
    supplierCost: "the supplier cost",
  })
  addDuplicateIssues(["catalogIdentifier", "catalogPrice", "catalogMarginOverride"], {
    catalogIdentifier: "the product identifier",
    catalogPrice: "the selling price",
    catalogMarginOverride: "the margin override",
  })

  const parsedOptions = optionsSchema.safeParse(draft.options)
  if (!parsedOptions.success) {
    for (const issue of parsedOptions.error.issues) {
      const field = issue.path[0] as keyof AnalysisSetupDraft["options"] | undefined
      if (field === "storeDefaultMargin") {
        addIssue({
          field,
          code: "INVALID_VALUE",
          message: "Enter a margin between 0% and 95%.",
        })
      } else if (field === "numberFormat") {
        addIssue({
          field,
          code: "REQUIRED",
          message: "Choose a number format.",
        })
      } else if (field === "currency") {
        addIssue({
          field,
          code: "REQUIRED",
          message: "Choose a display currency.",
        })
      } else if (field === "caseInsensitive") {
        addIssue({
          field,
          code: "REQUIRED",
          message: "Choose how identifier case should be matched.",
        })
      }
    }
  }

  if (issues.length > 0 || !parsedOptions.success) {
    return {
      status: "CONFIGURATION_INCOMPLETE",
      isReady: false,
      issues,
      errors,
    }
  }

  const mapping: AnalysisMapping = {
    supplierIdentifier: draft.mapping.supplierIdentifier!,
    supplierCost: draft.mapping.supplierCost!,
    catalogIdentifier: draft.mapping.catalogIdentifier!,
    catalogPrice: draft.mapping.catalogPrice!,
    ...(draft.mapping.catalogMarginOverride
      ? { catalogMarginOverride: draft.mapping.catalogMarginOverride }
      : {}),
  }

  return {
    status: "READY_FOR_ANALYSIS",
    isReady: true,
    issues: [],
    errors: {},
    configuration: {
      mapping,
      options: parsedOptions.data,
    },
  }
}

export {
  DISPLAY_CURRENCIES,
  NUMBER_FORMATS,
  analysisSetupReducer,
  createDefaultAnalysisSetupDraft,
  validateAnalysisConfiguration,
}
export type {
  AnalysisConfiguration,
  AnalysisSetupAction,
  AnalysisSetupContext,
  AnalysisSetupDraft,
  DisplayCurrency,
  MappingField,
  NumberFormat,
  SetupValidationField,
  SetupValidationIssue,
  SetupValidationResult,
}
