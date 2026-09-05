import { useId, useState, type FormEvent } from "react"

import type { AccessCapabilities } from "@/app/access-policy"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { validateMarginPercentageText } from "@/features/analysis/margin-target-validation"
import {
  ManualOverrideError,
  manualOverrideService,
  type ManualOverrideMutationResult,
} from "@/features/results/manual-override-service"
import { formatPercent, formatTargetSource } from "@/features/results/results-formatting"
import type { MarginResultRow } from "@/features/results/results-query-types"
import type { NumberFormat } from "@/features/setup/analysis-configuration"

type ManualOverrideMutationService = Pick<
  typeof manualOverrideService,
  "apply" | "remove"
>

type ManualOverrideDialogProps = Readonly<{
  row: MarginResultRow | null
  open: boolean
  onOpenChange: (open: boolean) => void
  access: Pick<AccessCapabilities, "canUseManualOverrides">
  numberFormat: NumberFormat
  service?: ManualOverrideMutationService
  onChanged: (result: ManualOverrideMutationResult) => void
}>

function ManualOverrideDialogContent({
  row,
  open,
  onOpenChange,
  access,
  numberFormat,
  service = manualOverrideService,
  onChanged,
}: ManualOverrideDialogProps & { row: MarginResultRow }) {
  const inputId = useId()
  const errorId = useId()
  const [value, setValue] = useState(
    () => row.manualOverrideMarginPercent ?? row.targetMarginPercent,
  )
  const [attempted, setAttempted] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [operationError, setOperationError] = useState<string | null>(null)

  const validation = validateMarginPercentageText(value)
  const fieldError = attempted && !validation.valid ? validation.error : null

  const save = async (event: FormEvent) => {
    event.preventDefault()
    if (isSaving) return
    setAttempted(true)
    setOperationError(null)
    if (!validation.valid) return

    setIsSaving(true)
    try {
      const result = await service.apply(row.rowId, validation.value, access)
      onChanged(result)
      onOpenChange(false)
    } catch (error) {
      if (!(error instanceof ManualOverrideError) || error.code !== "STALE") {
        setOperationError(
          error instanceof ManualOverrideError
            ? error.userMessage
            : "We couldn't update this target. Your current analysis is unchanged.",
        )
      }
    } finally {
      setIsSaving(false)
    }
  }

  const remove = async () => {
    if (isSaving || !row.manualOverrideMarginPercent) return
    setOperationError(null)
    setIsSaving(true)
    try {
      const result = await service.remove(row.rowId, access)
      onChanged(result)
      onOpenChange(false)
    } catch (error) {
      if (!(error instanceof ManualOverrideError) || error.code !== "STALE") {
        setOperationError(
          error instanceof ManualOverrideError
            ? error.userMessage
            : "We couldn't update this target. Your current analysis is unchanged.",
        )
      }
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !isSaving && onOpenChange(next)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Set product target</DialogTitle>
          <DialogDescription className="break-all font-medium text-text-primary">
            {row.identifier}
          </DialogDescription>
        </DialogHeader>

        <dl className="divide-y divide-border rounded-md border border-border bg-surface-subtle px-3">
          <div className="flex items-center justify-between gap-4 py-2.5 text-[13px]">
            <dt className="text-text-secondary">Store default</dt>
            <dd className="font-semibold tabular-nums text-text-primary">
              {formatPercent(row.storeDefaultMarginPercent, numberFormat)}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-4 py-2.5 text-[13px]">
            <dt className="text-text-secondary">Catalog override</dt>
            <dd className="font-semibold tabular-nums text-text-primary">
              {row.catalogOverrideMarginPercent
                ? formatPercent(row.catalogOverrideMarginPercent, numberFormat)
                : "—"}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-4 py-2.5 text-[13px]">
            <dt className="text-text-secondary">Current target</dt>
            <dd className="font-semibold tabular-nums text-text-primary">
              {formatPercent(row.targetMarginPercent, numberFormat)}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-4 py-2.5 text-[13px]">
            <dt className="text-text-secondary">Current source</dt>
            <dd className="font-semibold text-text-primary">
              {formatTargetSource(row.targetSource)}
            </dd>
          </div>
        </dl>

        <form onSubmit={(event) => void save(event)} noValidate>
          <Label htmlFor={inputId}>Manual override</Label>
          <div className="relative mt-2 max-w-48">
            <Input
              id={inputId}
              type="text"
              inputMode="decimal"
              autoComplete="off"
              value={value}
              onChange={(event) => {
                setValue(event.target.value)
                setOperationError(null)
              }}
              onBlur={() => setAttempted(true)}
              aria-invalid={Boolean(fieldError)}
              aria-describedby={fieldError ? errorId : undefined}
              className="pr-9 tabular-nums"
              disabled={isSaving}
              autoFocus
            />
            <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-text-muted">
              %
            </span>
          </div>
          {fieldError && (
            <p id={errorId} className="mt-2 text-xs font-medium text-loss" role="alert">
              {fieldError}
            </p>
          )}
          <p className="mt-2 text-xs leading-[18px] text-text-muted">
            Enter a percentage from 0 through 95. For example, 0.20 means 0.20%.
          </p>

          {row.manualOverrideMarginPercent && (
            <Button
              type="button"
              variant="ghost"
              size="small"
              className="mt-3 -ml-3"
              onClick={() => void remove()}
              disabled={isSaving}
            >
              Remove Manual Override
            </Button>
          )}

          {operationError && (
            <p className="mt-3 text-sm text-loss-strong" role="alert">
              {operationError}
            </p>
          )}

          <DialogFooter className="mt-5">
            <Button
              type="button"
              variant="secondary"
              onClick={() => onOpenChange(false)}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? "Saving…" : "Save Override"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function ManualOverrideDialog(props: ManualOverrideDialogProps) {
  if (!props.row || !props.access.canUseManualOverrides) return null
  return <ManualOverrideDialogContent key={props.row.rowId} {...props} row={props.row} />
}

export { ManualOverrideDialog }
export type { ManualOverrideMutationService }
