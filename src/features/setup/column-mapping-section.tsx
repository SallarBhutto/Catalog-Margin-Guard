import { Info } from "lucide-react"
import { useState } from "react"

import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select"
import type {
  CatalogColumnSuggestions,
  SupplierColumnSuggestions,
} from "@/features/file-inspection/file-inspection-types"
import type {
  AnalysisSetupAction,
  AnalysisSetupDraft,
  MappingField,
  SetupValidationResult,
} from "@/features/setup/analysis-configuration"

const UNMAPPED_VALUE = "__CMG_UNMAPPED__"
const NONE_VALUE = "__CMG_NONE__"

type MappingFieldProps = Readonly<{
  id: string
  label: string
  field: MappingField
  value: string | null
  columns: readonly string[]
  suggestion?: string
  optional?: boolean
  error?: string
  showError: boolean
  onTouched: (field: MappingField) => void
  dispatch: (action: AnalysisSetupAction) => void
}>

function MappingFieldControl({
  id,
  label,
  field,
  value,
  columns,
  suggestion,
  optional = false,
  error,
  showError,
  onTouched,
  dispatch,
}: MappingFieldProps) {
  const errorId = `${id}-error`
  const helpId = `${id}-help`
  const isSuggested = Boolean(suggestion && value === suggestion)

  return (
    <div>
      <div className="mb-2 flex min-h-[18px] items-center justify-between gap-3">
        <Label htmlFor={id}>{label}</Label>
        {isSuggested && (
          <span id={helpId} className="text-xs text-text-muted">
            Suggested from column name
          </span>
        )}
      </div>
      <Select
        value={value ?? (optional ? NONE_VALUE : UNMAPPED_VALUE)}
        onValueChange={(nextValue) => {
          onTouched(field)
          dispatch({
            type: "mapping-changed",
            field,
            value:
              nextValue === UNMAPPED_VALUE || nextValue === NONE_VALUE ? null : nextValue,
          })
        }}
      >
        <SelectTrigger
          id={id}
          aria-invalid={showError && Boolean(error)}
          aria-describedby={
            [isSuggested ? helpId : null, showError && error ? errorId : null]
              .filter(Boolean)
              .join(" ") || undefined
          }
        >
          <span className="min-w-0 truncate text-left" title={value ?? undefined}>
            {value ?? (optional ? "None" : "Select a column")}
          </span>
        </SelectTrigger>
        <SelectContent className="max-w-[min(36rem,calc(100vw-2rem))]">
          <SelectItem value={optional ? NONE_VALUE : UNMAPPED_VALUE}>
            {optional ? "None" : "Select a column"}
          </SelectItem>
          {columns.map((column) => (
            <SelectItem
              key={column}
              value={column}
              className="h-auto min-h-9 whitespace-normal"
            >
              <span className="break-words">{column}</span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {showError && error && (
        <p id={errorId} className="mt-2 text-xs leading-[18px] text-loss" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}

type ColumnMappingSectionProps = Readonly<{
  draft: AnalysisSetupDraft
  validation: SetupValidationResult
  supplierColumns: readonly string[]
  catalogColumns: readonly string[]
  supplierSuggestions: SupplierColumnSuggestions
  catalogSuggestions: CatalogColumnSuggestions
  dispatch: (action: AnalysisSetupAction) => void
}>

function ColumnMappingSection({
  draft,
  validation,
  supplierColumns,
  catalogColumns,
  supplierSuggestions,
  catalogSuggestions,
  dispatch,
}: ColumnMappingSectionProps) {
  const [touched, setTouched] = useState<ReadonlySet<MappingField>>(new Set())
  const onTouched = (field: MappingField) => {
    setTouched((current) => new Set(current).add(field))
  }

  const fieldProps = (field: MappingField) => ({
    field,
    error: validation.errors[field],
    showError: touched.has(field),
    onTouched,
    dispatch,
  })

  return (
    <section
      className="mt-6 rounded-lg border border-border bg-surface p-6 sm:p-8"
      aria-labelledby="mapping-step-heading"
      data-testid="column-mapping-section"
    >
      <div className="flex items-start gap-4">
        <span
          className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-soft text-[13px] font-semibold text-brand"
          aria-hidden="true"
        >
          2
        </span>
        <div>
          <h2
            id="mapping-step-heading"
            className="text-lg leading-7 font-semibold text-text-primary"
          >
            Map columns
          </h2>
          <p className="mt-1 text-sm leading-[22px] text-text-secondary">
            Confirm which source columns play each role. Suggested matches are based only
            on column names and can be changed.
          </p>
        </div>
      </div>

      <div className="mt-6 grid gap-8 border-t border-border pt-6 lg:grid-cols-2 lg:gap-10">
        <fieldset className="min-w-0 space-y-5">
          <legend className="text-[15px] font-semibold text-text-primary">
            Supplier
          </legend>
          <MappingFieldControl
            id="supplier-identifier-mapping"
            label="Product Identifier"
            value={draft.mapping.supplierIdentifier}
            columns={supplierColumns}
            suggestion={supplierSuggestions.productIdentifier}
            {...fieldProps("supplierIdentifier")}
          />
          <MappingFieldControl
            id="supplier-cost-mapping"
            label="Supplier Cost"
            value={draft.mapping.supplierCost}
            columns={supplierColumns}
            suggestion={supplierSuggestions.supplierCost}
            {...fieldProps("supplierCost")}
          />
        </fieldset>

        <fieldset className="min-w-0 space-y-5">
          <legend className="text-[15px] font-semibold text-text-primary">Catalog</legend>
          <MappingFieldControl
            id="catalog-identifier-mapping"
            label="Product Identifier"
            value={draft.mapping.catalogIdentifier}
            columns={catalogColumns}
            suggestion={catalogSuggestions.productIdentifier}
            {...fieldProps("catalogIdentifier")}
          />
          <MappingFieldControl
            id="catalog-price-mapping"
            label="Current Selling Price"
            value={draft.mapping.catalogPrice}
            columns={catalogColumns}
            suggestion={catalogSuggestions.sellingPrice}
            {...fieldProps("catalogPrice")}
          />
          <MappingFieldControl
            id="catalog-margin-override-mapping"
            label="Per-product Margin Override"
            value={draft.mapping.catalogMarginOverride}
            columns={catalogColumns}
            suggestion={catalogSuggestions.marginOverride}
            optional
            {...fieldProps("catalogMarginOverride")}
          />
        </fieldset>
      </div>

      <div className="mt-6 flex gap-3 rounded-md border border-brand-soft-border bg-brand-soft px-4 py-3.5 text-[13px] leading-5 text-text-secondary">
        <Info className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden="true" />
        <p>
          <span className="font-semibold text-text-primary">
            Make sure both selected identifier columns represent the same identifier.
          </span>{" "}
          Examples: Supplier SKU ↔ Supplier SKU, UPC ↔ UPC, or MPN ↔ MPN. Catalog Margin
          Guard does not translate between identifier systems.
        </p>
      </div>
    </section>
  )
}

export { ColumnMappingSection }
