import { ArrowLeft, CheckCircle2, CircleAlert } from "lucide-react"
import { useEffect, useMemo, useReducer, useState, useSyncExternalStore } from "react"

import { getBoundedPreviewLimit } from "@/app/access-policy"
import { PageContainer } from "@/components/shared/page-container"
import { PrivacyNotice } from "@/components/shared/privacy-notice"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AnalysisProgress } from "@/features/analysis/analysis-progress"
import {
  clearMarginAnalysis,
  clearNormalizedInputs,
  marginAnalysisService,
  runMarginAnalysis,
} from "@/features/analysis"
import type {
  MarginAnalysisFailure,
  MarginAnalysisSuccess,
} from "@/features/analysis/margin-analysis-types"
import { useAccessCapabilities } from "@/features/auth/auth-context"
import { FileInspectionPanel } from "@/features/file-inspection/file-inspection-panel"
import { fileInspectionService } from "@/features/file-inspection/file-inspection-service"
import { useFileInspection } from "@/features/file-inspection/use-file-inspection"
import { FilePicker } from "@/features/file-selection/file-picker"
import { ResultsPage } from "@/features/results/results-page"
import { resultsQueryService } from "@/features/results/results-query-service"
import type { MarginResultRow } from "@/features/results/results-query-types"
import {
  analysisSetupReducer,
  createDefaultAnalysisSetupDraft,
  validateAnalysisConfiguration,
} from "@/features/setup/analysis-configuration"
import { ColumnMappingSection } from "@/features/setup/column-mapping-section"
import { EngineReadiness } from "@/features/setup/engine-readiness"
import { MarginSettingsSection } from "@/features/setup/margin-settings-section"
import { SetupReadinessSummary } from "@/features/setup/setup-readiness-summary"
import { duckDBEngine } from "@/lib/duckdb"

type SetupShellProps = {
  onBack: () => void
}

function SetupShell({ onBack }: SetupShellProps) {
  const supplier = useFileInspection("supplier")
  const catalog = useFileInspection("catalog")
  const capabilities = useAccessCapabilities()
  const analysisSnapshot = useSyncExternalStore(
    marginAnalysisService.subscribe,
    marginAnalysisService.getSnapshot,
    marginAnalysisService.getSnapshot,
  )
  const [setupDraft, dispatch] = useReducer(
    analysisSetupReducer,
    undefined,
    createDefaultAnalysisSetupDraft,
  )
  const [isExecuting, setIsExecuting] = useState(false)
  const [analysisError, setAnalysisError] = useState<
    MarginAnalysisFailure["error"] | null
  >(null)
  const [completedAnalysis, setCompletedAnalysis] = useState<{
    result: MarginAnalysisSuccess
    previewRows: readonly MarginResultRow[]
  } | null>(null)

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
  const supplierColumns = useMemo(
    () => supplierResult?.columns.map((column) => column.name) ?? [],
    [supplierResult],
  )
  const catalogColumns = useMemo(
    () => catalogResult?.columns.map((column) => column.name) ?? [],
    [catalogResult],
  )

  useEffect(() => {
    if (!supplierResult) return
    dispatch({
      type: "supplier-inspected",
      suggestions: supplierResult.suggestions,
    })
  }, [supplierResult])

  useEffect(() => {
    if (!catalogResult) return
    dispatch({
      type: "catalog-inspected",
      suggestions: catalogResult.suggestions,
    })
  }, [catalogResult])

  const validation = useMemo(
    () =>
      validateAnalysisConfiguration(setupDraft, {
        supplier: { ready: Boolean(supplierResult), columns: supplierColumns },
        catalog: { ready: Boolean(catalogResult), columns: catalogColumns },
      }),
    [catalogColumns, catalogResult, setupDraft, supplierColumns, supplierResult],
  )

  const chooseSupplierFile = (file: File) => {
    dispatch({ type: "supplier-file-changed" })
    void supplier.chooseFile(file)
  }

  const chooseCatalogFile = (file: File) => {
    dispatch({ type: "catalog-file-changed" })
    void catalog.chooseFile(file)
  }

  const analyzeCatalog = async () => {
    if (!validation.isReady || !validation.configuration || isExecuting) return

    setAnalysisError(null)
    setCompletedAnalysis(null)
    setIsExecuting(true)

    try {
      const result = await runMarginAnalysis(validation.configuration)
      if (result.status === "ERROR") {
        setAnalysisError(result.error)
        return
      }

      const previewRows = await resultsQueryService.getHighestRiskPreview({
        limit: getBoundedPreviewLimit(capabilities),
        sort: "RISK_HIGHEST",
      })
      setCompletedAnalysis({ result, previewRows })
      window.scrollTo({ top: 0, behavior: "auto" })
    } catch {
      setAnalysisError({
        code: "ANALYSIS_FAILED",
        userMessage:
          "We couldn't prepare the results preview. Your files are still on this computer. Review your setup and try again.",
      })
      await clearMarginAnalysis().catch(() => undefined)
    } finally {
      setIsExecuting(false)
    }
  }

  const startNewScan = async () => {
    setCompletedAnalysis(null)
    setAnalysisError(null)
    dispatch({ type: "reset" })
    await Promise.all([supplier.clearFile(), catalog.clearFile()])
    await Promise.all([clearMarginAnalysis(), clearNormalizedInputs()])
    window.scrollTo({ top: 0, behavior: "auto" })
  }

  if (completedAnalysis && validation.configuration) {
    return (
      <ResultsPage
        result={completedAnalysis.result}
        previewRows={completedAnalysis.previewRows}
        currency={validation.configuration.options.currency}
        numberFormat={validation.configuration.options.numberFormat}
        onStartNewScan={startNewScan}
      />
    )
  }

  if (isExecuting) {
    return (
      <AnalysisProgress
        stage={
          analysisSnapshot.state === "running"
            ? analysisSnapshot.stage
            : "preparing-results"
        }
      />
    )
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
              onChoose={chooseSupplierFile}
            />
            <FilePicker
              role="catalog"
              title="Current catalog"
              prompt="Choose Catalog File"
              state={catalog.state}
              onChoose={chooseCatalogFile}
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
                Confirm the suggested mappings and configure your margin rules below.
              </p>
            </div>
          )}
        </section>

        {supplierResult && catalogResult && (
          <>
            <ColumnMappingSection
              draft={setupDraft}
              validation={validation}
              supplierColumns={supplierColumns}
              catalogColumns={catalogColumns}
              supplierSuggestions={supplierResult.suggestions}
              catalogSuggestions={catalogResult.suggestions}
              dispatch={dispatch}
            />
            <MarginSettingsSection
              draft={setupDraft}
              validation={validation}
              dispatch={dispatch}
            />
            <SetupReadinessSummary
              validation={validation}
              onAnalyze={() => void analyzeCatalog()}
            />
            {analysisError && (
              <Alert variant="destructive" className="mt-5">
                <CircleAlert aria-hidden="true" />
                <AlertTitle>We couldn't complete this analysis.</AlertTitle>
                <AlertDescription>
                  {analysisError.userMessage} Your files are still on this computer.
                </AlertDescription>
              </Alert>
            )}
          </>
        )}

        {(supplierResult || catalogResult) && (
          <section className="mt-8" aria-labelledby="file-review-heading">
            <div className="mb-4">
              <h2
                id="file-review-heading"
                className="text-[15px] font-semibold text-text-primary"
              >
                Review inspected files
              </h2>
              <p className="mt-1 text-xs leading-[18px] text-text-muted">
                Use these compact previews to verify source columns and sample values.
              </p>
            </div>
            <div className="space-y-5">
              {supplierResult && (
                <FileInspectionPanel role="supplier" result={supplierResult} />
              )}
              {catalogResult && (
                <FileInspectionPanel role="catalog" result={catalogResult} />
              )}
            </div>
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
