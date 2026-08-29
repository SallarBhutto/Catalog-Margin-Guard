import { ArrowLeft, FileSpreadsheet, LockKeyhole } from "lucide-react"

import { PageContainer } from "@/components/shared/page-container"
import { PrivacyNotice } from "@/components/shared/privacy-notice"
import { Button } from "@/components/ui/button"
import { EngineReadiness } from "@/features/setup/engine-readiness"
import { duckDBEngine } from "@/lib/duckdb"

type SetupShellProps = {
  onBack: () => void
}

function SetupShell({ onBack }: SetupShellProps) {
  const leaveWorkflow = async () => {
    await duckDBEngine.dispose()
    onBack()
  }

  return (
    <main id="main-content" className="min-h-[calc(100svh-4rem)] py-10 sm:py-12">
      <PageContainer width="app">
        <button
          type="button"
          onClick={() => void leaveWorkflow()}
          className="inline-flex min-h-10 items-center gap-2 rounded-md text-sm font-medium text-text-secondary outline-none hover:text-text-primary focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Back to overview
        </button>

        <div className="mt-6 max-w-copy">
          <h1 className="text-[28px] leading-9 font-semibold tracking-[-0.02em] text-text-primary">
            Check your catalog
          </h1>
          <p className="mt-3 text-base leading-[26px] text-text-secondary">
            Compare supplier costs with current selling prices in a guided, browser-local
            workflow.
          </p>
          <PrivacyNotice className="mt-4" />
        </div>

        <section
          className="mt-8 rounded-lg border border-border bg-surface p-6 sm:p-8"
          aria-labelledby="setup-step-heading"
        >
          <div className="flex items-start gap-4">
            <span
              className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-soft text-[13px] font-semibold text-brand"
              aria-hidden="true"
            >
              1
            </span>
            <div>
              <h2
                id="setup-step-heading"
                className="text-lg leading-7 font-semibold text-text-primary"
              >
                Choose your files
              </h2>
              <p className="mt-1 text-sm leading-[22px] text-text-secondary">
                The local file-selection workflow will be implemented in the next product
                phase.
              </p>
            </div>
          </div>

          <div className="mt-6 border-t border-border pt-5">
            <EngineReadiness />
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {[
              ["Supplier file", "Supplier costs"],
              ["Current catalog", "Selling prices"],
            ].map(([title, description]) => (
              <div
                key={title}
                className="flex min-h-36 flex-col justify-between rounded-md border border-dashed border-border-strong bg-background p-5"
              >
                <FileSpreadsheet className="size-5 text-text-muted" aria-hidden="true" />
                <div>
                  <h3 className="text-[15px] leading-[22px] font-semibold text-text-primary">
                    {title}
                  </h3>
                  <p className="mt-1 text-xs leading-[18px] text-text-muted">
                    {description} · CSV, TSV, or XLSX
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 flex flex-col gap-3 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-2 text-xs leading-[18px] text-text-muted">
              <LockKeyhole
                className="mt-0.5 size-4 shrink-0 text-brand"
                aria-hidden="true"
              />
              File processing is intentionally not enabled in this foundation.
            </div>
            <Button type="button" disabled>
              Continue to mapping
            </Button>
          </div>
        </section>

        <p className="mt-5 text-xs leading-[18px] text-text-muted md:hidden">
          For large catalogs, we recommend using Catalog Margin Guard on a desktop
          computer.
        </p>
      </PageContainer>
    </main>
  )
}

export { SetupShell }
