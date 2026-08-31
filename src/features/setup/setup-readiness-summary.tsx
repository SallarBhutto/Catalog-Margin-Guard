import { CheckCircle2, CircleDashed } from "lucide-react"

import type { SetupValidationResult } from "@/features/setup/analysis-configuration"

type SetupReadinessSummaryProps = Readonly<{
  validation: SetupValidationResult
}>

function SetupReadinessSummary({ validation }: SetupReadinessSummaryProps) {
  return (
    <section
      className={
        validation.isReady
          ? "mt-6 flex gap-3 rounded-lg border border-ok-border bg-ok-soft p-5 sm:p-6"
          : "mt-6 flex gap-3 rounded-lg border border-border bg-surface p-5 sm:p-6"
      }
      aria-live="polite"
      data-testid="setup-readiness"
      data-setup-state={validation.status}
    >
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
            ? "Your mappings and options are valid. Analysis execution will be added in the next implementation phase."
            : "Review the required mappings and any field-level messages above."}
        </p>
      </div>
    </section>
  )
}

export { SetupReadinessSummary }
