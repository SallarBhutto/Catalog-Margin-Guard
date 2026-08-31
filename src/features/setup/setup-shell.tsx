import { ArrowLeft, CheckCircle2 } from "lucide-react"

import { PageContainer } from "@/components/shared/page-container"
import { PrivacyNotice } from "@/components/shared/privacy-notice"
import { FileInspectionPanel } from "@/features/file-inspection/file-inspection-panel"
import { fileInspectionService } from "@/features/file-inspection/file-inspection-service"
import { useFileInspection } from "@/features/file-inspection/use-file-inspection"
import { FilePicker } from "@/features/file-selection/file-picker"
import { EngineReadiness } from "@/features/setup/engine-readiness"
import { duckDBEngine } from "@/lib/duckdb"

type SetupShellProps = {
  onBack: () => void
}

function SetupShell({ onBack }: SetupShellProps) {
  const supplier = useFileInspection("supplier")
  const catalog = useFileInspection("catalog")

  const leaveWorkflow = async () => {
    await fileInspectionService.releaseAll()
    await duckDBEngine.dispose()
    onBack()
  }

  const supplierResult =
    supplier.state.status === "ready" || supplier.state.status === "warning"
      ? supplier.state.result
      : null
  const catalogResult =
    catalog.state.status === "ready" || catalog.state.status === "warning"
      ? catalog.state.result
      : null
  const bothFilesReady = Boolean(supplierResult && catalogResult)

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
                Select your supplier cost file and current catalog. Each file is inspected
                locally before the next column-mapping step.
              </p>
            </div>
          </div>

          <div className="mt-6 border-t border-border pt-5">
            <EngineReadiness />
          </div>

          <div className="mt-6 grid gap-5 lg:grid-cols-2">
            <FilePicker
              role="supplier"
              title="Supplier file"
              prompt="Choose Supplier File"
              state={supplier.state}
              onChoose={(file) => void supplier.chooseFile(file)}
            />
            <FilePicker
              role="catalog"
              title="Current catalog"
              prompt="Choose Catalog File"
              state={catalog.state}
              onChoose={(file) => void catalog.chooseFile(file)}
            />
          </div>

          {bothFilesReady && (
            <div
              className="mt-6 flex items-start gap-3 border-t border-border pt-5 text-[13px] leading-[18px] text-text-secondary"
              role="status"
            >
              <CheckCircle2 className="size-4 shrink-0 text-ok" aria-hidden="true" />
              <p>
                <span className="font-semibold text-text-primary">
                  Both files are ready.
                </span>{" "}
                Their detected columns can be used in the next column-mapping phase.
              </p>
            </div>
          )}
        </section>

        {(supplierResult || catalogResult) && (
          <section className="mt-6 space-y-5" aria-label="Inspected files">
            {supplierResult && (
              <FileInspectionPanel role="supplier" result={supplierResult} />
            )}
            {catalogResult && (
              <FileInspectionPanel role="catalog" result={catalogResult} />
            )}
          </section>
        )}

        <p className="mt-5 text-xs leading-[18px] text-text-muted md:hidden">
          For large catalogs, we recommend using Catalog Margin Guard on a desktop
          computer.
        </p>
      </PageContainer>
    </main>
  )
}

export { SetupShell }
