import { Check, Circle, LoaderCircle } from "lucide-react"

import type { AnalysisStage } from "@/features/analysis/margin-analysis-types"

type AnalysisProgressProps = Readonly<{
  stage: AnalysisStage
}>

const STAGES: readonly Readonly<{ id: AnalysisStage; label: string }>[] = [
  { id: "preparing", label: "Preparing local data" },
  { id: "analyzing", label: "Analyzing margins" },
  { id: "preparing-results", label: "Preparing results" },
]

function AnalysisProgress({ stage }: AnalysisProgressProps) {
  const activeIndex = STAGES.findIndex((item) => item.id === stage)

  return (
    <main id="main-content" className="min-h-[calc(100svh-4rem)] py-12 sm:py-16">
      <div className="mx-auto w-full max-w-copy px-4 sm:px-6">
        <section
          className="rounded-lg border border-border bg-surface p-6 sm:p-8"
          aria-labelledby="analysis-progress-heading"
          aria-live="polite"
          aria-busy="true"
          data-testid="analysis-progress"
          data-analysis-stage={stage}
        >
          <div className="flex items-center gap-3">
            <LoaderCircle
              className="size-5 animate-spin text-brand motion-reduce:animate-none"
              aria-hidden="true"
            />
            <h1
              id="analysis-progress-heading"
              className="text-xl leading-7 font-semibold text-text-primary"
            >
              Analyzing your catalog
            </h1>
          </div>

          <ol className="mt-7 space-y-4">
            {STAGES.map((item, index) => {
              const completed = index < activeIndex
              const active = index === activeIndex

              return (
                <li
                  key={item.id}
                  className={
                    active
                      ? "flex items-center gap-3 font-medium text-text-primary"
                      : completed
                        ? "flex items-center gap-3 text-text-secondary"
                        : "flex items-center gap-3 text-text-muted"
                  }
                  aria-current={active ? "step" : undefined}
                >
                  <span
                    className={
                      active
                        ? "flex size-6 items-center justify-center rounded-full bg-brand-soft text-brand"
                        : completed
                          ? "flex size-6 items-center justify-center rounded-full bg-ok-soft text-ok"
                          : "flex size-6 items-center justify-center text-text-disabled"
                    }
                    aria-hidden="true"
                  >
                    {completed ? (
                      <Check className="size-4" />
                    ) : active ? (
                      <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" />
                    ) : (
                      <Circle className="size-3" />
                    )}
                  </span>
                  {item.label}
                </li>
              )
            })}
          </ol>

          <p className="mt-7 border-t border-border pt-5 text-sm leading-[22px] text-text-secondary">
            Your files are being processed locally in this browser. Large catalogs may
            take a little longer.
          </p>
        </section>
      </div>
    </main>
  )
}

export { AnalysisProgress }
