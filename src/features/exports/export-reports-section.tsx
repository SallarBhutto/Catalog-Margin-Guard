import { Download } from "lucide-react"
import { useEffect, useRef, useState } from "react"

import type { AccessCapabilities } from "@/app/access-policy"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import {
  ReportExportError,
  reportExportService,
} from "@/features/exports/report-export-service"
import type { ReportKind } from "@/features/exports/report-export-sql"
import { formatCount } from "@/features/results/results-formatting"
import type { NumberFormat } from "@/features/setup/analysis-configuration"

type ReportExporter = Pick<typeof reportExportService, "cancelActive" | "exportReport">

type ExportReportsSectionProps = Readonly<{
  capabilities: Pick<AccessCapabilities, "canExportResults">
  productsAnalyzed: number
  productsNeedingAttention: number
  numberFormat: NumberFormat
  service?: ReportExporter
}>

type Notice = Readonly<{ tone: "status" | "alert"; message: string }>

const REPORT_LABELS: Readonly<Record<ReportKind, string>> = {
  PRODUCTS_TO_REVIEW: "Products To Review",
  FULL_MARGIN_REPORT: "Full Margin Report",
}

function ExportReportsSection({
  capabilities,
  productsAnalyzed,
  productsNeedingAttention,
  numberFormat,
  service = reportExportService,
}: ExportReportsSectionProps) {
  const [activity, setActivity] = useState<{ kind: ReportKind; rows: number } | null>(
    null,
  )
  const [notice, setNotice] = useState<Notice | null>(null)
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    return () => {
      // Sign-out or a new scan removes these controls; a report still being prepared for
      // the previous state must not download afterwards.
      mounted.current = false
      service.cancelActive()
    }
  }, [service])

  if (!capabilities.canExportResults) return null

  const expectedRows: Readonly<Record<ReportKind, number>> = {
    PRODUCTS_TO_REVIEW: productsNeedingAttention,
    FULL_MARGIN_REPORT: productsAnalyzed,
  }
  const hasNothingToReview = productsNeedingAttention === 0

  const exportReport = async (kind: ReportKind) => {
    if (activity) return
    setNotice(null)
    setActivity({ kind, rows: 0 })

    try {
      const outcome = await service.exportReport(kind, capabilities, {
        onProgress: (rows) => {
          if (mounted.current) setActivity({ kind, rows })
        },
      })
      if (!mounted.current) return

      if (outcome.status === "DOWNLOADED") {
        setNotice({
          tone: "status",
          message: `Downloaded ${outcome.filename} with ${formatCount(outcome.rows, numberFormat)} ${outcome.rows === 1 ? "product" : "products"}.`,
        })
      } else if (outcome.status === "EMPTY") {
        setNotice({
          tone: "status",
          message: `${REPORT_LABELS[kind]} has no products to include, so no file was created.`,
        })
      } else {
        setNotice({ tone: "status", message: "Report cancelled. No file was created." })
      }
    } catch (error) {
      if (!mounted.current) return
      setNotice({
        tone: "alert",
        message:
          error instanceof ReportExportError
            ? error.userMessage
            : "We couldn't prepare this report. Your analysis is unchanged. Try again.",
      })
    } finally {
      if (mounted.current) setActivity(null)
    }
  }

  return (
    <section
      className="mt-8 rounded-lg border border-border bg-surface p-4 sm:p-5"
      aria-labelledby="export-reports-heading"
      data-testid="export-reports"
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between lg:gap-8">
        <div className="max-w-copy">
          <h2
            id="export-reports-heading"
            className="text-[15px] leading-[22px] font-semibold text-text-primary"
          >
            Download reports
          </h2>
          <p className="mt-1 text-[13px] leading-[18px] text-text-secondary">
            Reports cover the complete analysis with your current targets, not only the
            page, search, or filters shown above. Files are created in your browser and
            stay on your computer.
          </p>
        </div>

        <div className="flex shrink-0 flex-col gap-3 sm:flex-row">
          {(["PRODUCTS_TO_REVIEW", "FULL_MARGIN_REPORT"] as const).map((kind) => {
            const isActive = activity?.kind === kind
            const isUnavailable = kind === "PRODUCTS_TO_REVIEW" && hasNothingToReview

            return (
              <Button
                key={kind}
                type="button"
                variant="secondary"
                className="w-full sm:w-auto"
                disabled={Boolean(activity) || isUnavailable}
                aria-describedby={isUnavailable ? "export-nothing-to-review" : undefined}
                onClick={() => void exportReport(kind)}
              >
                {isActive ? (
                  <Spinner aria-hidden="true" />
                ) : (
                  <Download aria-hidden="true" />
                )}
                {REPORT_LABELS[kind]}
              </Button>
            )
          })}
        </div>
      </div>

      {hasNothingToReview && (
        <p
          id="export-nothing-to-review"
          className="mt-3 text-xs leading-[18px] text-text-muted"
        >
          No products currently need review, so Products To Review has nothing to include.
        </p>
      )}

      {activity && (
        <div
          className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] leading-[18px] text-text-secondary"
          data-testid="export-progress"
        >
          <p role="status" className="tabular-nums">
            Preparing {REPORT_LABELS[activity.kind]}…{" "}
            {formatCount(activity.rows, numberFormat)} of{" "}
            {formatCount(expectedRows[activity.kind], numberFormat)} products
          </p>
          <Button
            type="button"
            variant="ghost"
            size="small"
            onClick={() => service.cancelActive()}
          >
            Cancel
          </Button>
        </div>
      )}

      {!activity && notice && (
        <p
          role={notice.tone}
          className={
            notice.tone === "alert"
              ? "mt-3 text-[13px] leading-[18px] font-medium text-loss-strong"
              : "mt-3 text-[13px] leading-[18px] text-text-secondary"
          }
          data-testid="export-notice"
        >
          {notice.message}
        </p>
      )}
    </section>
  )
}

export { ExportReportsSection }
export type { ReportExporter }
