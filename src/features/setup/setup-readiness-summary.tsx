import { CheckCircle2, CircleDashed, LockKeyhole } from "lucide-react"

import { Button } from "@/components/ui/button"
import type { SetupValidationResult } from "@/features/setup/analysis-configuration"

type SetupReadinessSummaryProps = Readonly<{
  validation: SetupValidationResult
  onAnalyze: () => void
}>

function SetupReadinessSummary({ validation, onAnalyze }: SetupReadinessSummaryProps) {
  return (
    <section
      className={
        validation.isReady
          ? "mt-6 rounded-lg border border-ok-border bg-ok-soft p-5 sm:p-6"
          : "mt-6 rounded-lg border border-border bg-surface p-5 sm:p-6"
      }
      aria-live="polite"
      data-testid="setup-readiness"
      data-setup-state={validation.status}
    >
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-3">
          {validation.isReady ? (
            <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-ok" aria-hidden="true" />
          ) : (
            <CircleDashed
              className="mt-0.5 size-5 shrink-0 text-text-muted"
              aria-hidden="true"
            />
          )}
          <div>
            <h2 className="text-[15px] font-semibold text-text-primary">
              {validation.isReady
                ? "Configuration ready for analysis"
                : "Complete the required setup"}
            </h2>
            <p className="mt-1 text-[13px] leading-5 text-text-secondary">
              {validation.isReady
                ? "Your mappings and options are valid. The complete catalog will be analyzed locally."
                : "Review the required mappings and any field-level messages above."}
            </p>
            <p className="mt-2 flex items-center gap-1.5 text-xs text-text-muted">
              <LockKeyhole className="size-3.5 text-brand" aria-hidden="true" />
              Files stay on your computer.
            </p>
          </div>
        </div>
        <Button
          type="button"
          onClick={onAnalyze}
          disabled={!validation.isReady}
          className="w-full sm:w-auto"
        >
          Analyze Catalog
        </Button>
      </div>
    </section>
  )
}

export { SetupReadinessSummary }
