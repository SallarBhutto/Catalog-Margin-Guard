import { useState } from "react"

import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select"
import {
  DISPLAY_CURRENCIES,
  type AnalysisSetupAction,
  type AnalysisSetupDraft,
  type DisplayCurrency,
  type NumberFormat,
  type SetupValidationResult,
} from "@/features/setup/analysis-configuration"

const CURRENCY_LABELS: Readonly<Record<DisplayCurrency, string>> = {
  USD: "USD",
  GBP: "GBP",
  EUR: "EUR",
  CAD: "CAD",
  AUD: "AUD",
  OTHER: "Other",
}

type MarginSettingsSectionProps = Readonly<{
  draft: AnalysisSetupDraft
  validation: SetupValidationResult
  dispatch: (action: AnalysisSetupAction) => void
}>

function MarginSettingsSection({
  draft,
  validation,
  dispatch,
}: MarginSettingsSectionProps) {
  const [marginTouched, setMarginTouched] = useState(false)
  const marginError = validation.errors.storeDefaultMargin

  return (
    <section
      className="mt-6 rounded-lg border border-border bg-surface p-6 sm:p-8"
      aria-labelledby="settings-step-heading"
      data-testid="margin-settings-section"
    >
      <div className="flex items-start gap-4">
        <span
          className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-soft text-[13px] font-semibold text-brand"
          aria-hidden="true"
        >
          3
        </span>
        <div>
          <h2
            id="settings-step-heading"
            className="text-lg leading-7 font-semibold text-text-primary"
          >
            Margin settings
          </h2>
          <p className="mt-1 text-sm leading-[22px] text-text-secondary">
            Set the target and formatting rules that the future analysis will use.
          </p>
        </div>
      </div>

      <div className="mt-6 border-t border-border pt-6">
        <div className="grid gap-6 lg:grid-cols-[minmax(230px,0.8fr)_minmax(230px,1fr)_minmax(180px,0.7fr)] lg:gap-8">
          <div>
            <Label htmlFor="store-default-margin">Store Default Margin</Label>
            <div className="mt-2 flex max-w-64">
              <Input
                id="store-default-margin"
                className="rounded-r-none tabular-nums"
                type="text"
                inputMode="decimal"
                autoComplete="off"
                value={draft.options.storeDefaultMargin}
                aria-invalid={marginTouched && Boolean(marginError)}
                aria-describedby={
                  marginTouched && marginError
                    ? "store-default-margin-help store-default-margin-error"
                    : "store-default-margin-help"
                }
                onChange={(event) =>
                  dispatch({ type: "margin-changed", value: event.currentTarget.value })
                }
                onBlur={() => setMarginTouched(true)}
              />
              <span
                className="flex h-10 items-center rounded-r-md border border-l-0 border-border-strong bg-surface-subtle px-3 text-sm font-medium text-text-secondary"
                aria-hidden="true"
              >
                %
              </span>
            </div>
            <p
              id="store-default-margin-help"
              className="mt-2 text-xs leading-[18px] text-text-muted"
            >
              Products without an individual override will use this target.
            </p>
            {marginTouched && marginError && (
              <p
                id="store-default-margin-error"
                className="mt-2 text-xs leading-[18px] text-loss"
                role="alert"
              >
                {marginError}
              </p>
            )}
          </div>

          <fieldset>
            <legend className="text-[13px] leading-[18px] font-medium text-text-primary">
              Number Format
            </legend>
            <RadioGroup
              className="mt-3 gap-3"
              value={draft.options.numberFormat ?? undefined}
              onValueChange={(value) =>
                dispatch({
                  type: "number-format-changed",
                  value: value as NumberFormat,
                })
              }
              aria-label="Number Format"
            >
              <div className="flex items-center gap-3">
                <RadioGroupItem id="number-format-us" value="US" />
                <Label htmlFor="number-format-us" className="font-normal tabular-nums">
                  1,234.56
                </Label>
              </div>
              <div className="flex items-center gap-3">
                <RadioGroupItem id="number-format-eu" value="EU" />
                <Label htmlFor="number-format-eu" className="font-normal tabular-nums">
                  1.234,56
                </Label>
              </div>
            </RadioGroup>
          </fieldset>

          <div>
            <Label htmlFor="display-currency">Display Currency</Label>
            <Select
              value={draft.options.currency ?? undefined}
              onValueChange={(value) =>
                dispatch({
                  type: "currency-changed",
                  value: value as DisplayCurrency,
                })
              }
            >
              <SelectTrigger id="display-currency" className="mt-2">
                <span>
                  {draft.options.currency
                    ? CURRENCY_LABELS[draft.options.currency]
                    : "Choose currency"}
                </span>
              </SelectTrigger>
              <SelectContent>
                {DISPLAY_CURRENCIES.map((currency) => (
                  <SelectItem key={currency} value={currency}>
                    {CURRENCY_LABELS[currency]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="mt-2 text-xs leading-[18px] text-text-muted">
              Formatting only. No currency conversion is performed.
            </p>
          </div>
        </div>

        <div className="mt-6 border-t border-border pt-5">
          <div className="flex items-start gap-3">
            <Checkbox
              id="case-insensitive-identifiers"
              checked={draft.options.caseInsensitive ?? false}
              onCheckedChange={(checked) =>
                dispatch({
                  type: "case-sensitivity-changed",
                  value: checked === true,
                })
              }
            />
            <div>
              <Label htmlFor="case-insensitive-identifiers">
                Ignore uppercase/lowercase differences
              </Label>
              <p className="mt-1 text-xs leading-[18px] text-text-muted">
                Records this choice for future identifier matching. Preview values are not
                changed.
              </p>
            </div>
          </div>
        </div>

        <p className="mt-5 text-xs leading-[18px] text-text-secondary">
          Supplier cost and catalog selling price must use the same currency.
        </p>
      </div>
    </section>
  )
}

export { MarginSettingsSection }
