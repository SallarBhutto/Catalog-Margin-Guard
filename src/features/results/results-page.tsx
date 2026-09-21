import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  LockKeyhole,
  RotateCcw,
} from "lucide-react"
import { useState } from "react"

import { PageContainer } from "@/components/shared/page-container"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type {
  MarginAnalysisMetadata,
  MarginAnalysisSuccess,
} from "@/features/analysis/margin-analysis-types"
import { useAuthState } from "@/features/auth/auth-context"
import {
  ExportReportsSection,
  type ReportExporter,
} from "@/features/exports/export-reports-section"
import {
  AuthenticatedResultsBrowser,
  type ResultsPageQueryService,
} from "@/features/results/authenticated-results-browser"
import type { ManualOverrideMutationService } from "@/features/results/manual-override-dialog"
import { formatCount, formatPercent } from "@/features/results/results-formatting"
import type {
  DisplayCurrency,
  NumberFormat,
} from "@/features/setup/analysis-configuration"
import { cn } from "@/lib/utils"

type ResultsPageProps = Readonly<{
  result: MarginAnalysisSuccess
  currency: DisplayCurrency
  numberFormat: NumberFormat
  onStartNewScan: () => Promise<void>
  fullResultsService?: ResultsPageQueryService
  overrideService?: ManualOverrideMutationService
  exportService?: ReportExporter
  onMetadataChanged?: (metadata: MarginAnalysisMetadata) => void
}>

function SummarySurface({
  result,
  numberFormat,
}: Pick<ResultsPageProps, "result" | "numberFormat">) {
  const { summary } = result.metadata
  const metrics = [
    {
      label: "Selling below cost",
      status: "LOSS",
      value: formatCount(summary.productsAtLoss, numberFormat),
      className: "text-loss-strong",
    },
    {
      label: "Need review",
      status: "REVIEW",
      value: formatCount(summary.productsNeedingReview, numberFormat),
      className: "text-review-strong",
    },
    {
      label: "Meeting target",
      status: "OK",
      value: formatCount(summary.productsMeetingTarget, numberFormat),
      className: "text-ok-strong",
    },
    {
      label: "Average gross margin",
      status: null,
      value: formatPercent(summary.averageGrossMarginPct, numberFormat),
      className: "text-text-primary",
    },
  ] as const

  return (
    <section
      className="overflow-hidden rounded-lg border border-border bg-surface"
      aria-labelledby="summary-heading"
    >
      <h2 id="summary-heading" className="sr-only">
        Analysis summary
      </h2>
      <div className="grid grid-cols-2 divide-x divide-y divide-border md:grid-cols-4 md:divide-y-0">
        {metrics.map((metric) => (
          <div key={metric.label} className="min-w-0 p-4 sm:p-5">
            <p
              className={cn(
                "text-2xl leading-8 font-bold tabular-nums",
                metric.className,
              )}
            >
              {metric.value}
            </p>
            <p className="mt-1 text-[13px] leading-[18px] font-medium text-text-secondary">
              {metric.label}
            </p>
            {metric.status && (
              <p className={cn("mt-2 text-xs font-semibold", metric.className)}>
                {metric.status}
              </p>
            )}
          </div>
        ))}
      </div>
      <div className="grid gap-2 border-t border-border bg-surface-subtle px-4 py-3 text-xs text-text-secondary sm:grid-cols-2 sm:px-5">
        <p>
          <span className="font-semibold tabular-nums text-text-primary">
            {formatCount(summary.productsUsingStoreDefaultTarget, numberFormat)}
          </span>{" "}
          using store default
        </p>
        <p>
          <span className="font-semibold tabular-nums text-text-primary">
            {formatCount(summary.productsUsingProductSpecificTarget, numberFormat)}
          </span>{" "}
          using product-specific target
        </p>
      </div>
    </section>
  )
}

function MarginExposureSection({
  result,
  numberFormat,
}: Pick<ResultsPageProps, "result" | "numberFormat">) {
  const { exposure } = result.metadata
  const buckets = [
    { label: "Below 0%", count: exposure.belowZero, loss: true },
    { label: "0–5%", count: exposure.zeroToFive, loss: false },
    { label: "5–10%", count: exposure.fiveToTen, loss: false },
    { label: "10–15%", count: exposure.tenToFifteen, loss: false },
    { label: "15–20%", count: exposure.fifteenToTwenty, loss: false },
    { label: "20–30%", count: exposure.twentyToThirty, loss: false },
    { label: "30%+", count: exposure.thirtyAndAbove, loss: false },
  ] as const
  const maximum = Math.max(...buckets.map((bucket) => bucket.count), 1)

  return (
    <section aria-labelledby="margin-exposure-heading">
      <div>
        <h2
          id="margin-exposure-heading"
          className="text-lg leading-7 font-semibold text-text-primary"
        >
          Margin exposure
        </h2>
        <p className="mt-1 text-sm leading-[22px] text-text-secondary">
          Gross-margin distribution across every successfully analyzed product.
        </p>
      </div>
      <div className="mt-4 rounded-lg border border-border bg-surface px-4 py-3 sm:px-5">
        <ul className="divide-y divide-border">
          {buckets.map((bucket) => (
            <li
              key={bucket.label}
              className="grid grid-cols-[5rem_minmax(5rem,1fr)_auto] items-center gap-3 py-2.5 sm:grid-cols-[6rem_minmax(8rem,1fr)_4rem]"
            >
              <span className="text-[13px] font-medium text-text-secondary">
                {bucket.label}
              </span>
              <span
                className="h-2 overflow-hidden rounded-sm bg-surface-subtle"
                aria-hidden="true"
              >
                <span
                  className={cn(
                    "block h-full rounded-sm",
                    bucket.loss ? "bg-loss" : "bg-brand",
                  )}
                  style={{ width: `${(bucket.count / maximum) * 100}%` }}
                />
              </span>
              <span className="text-right text-[13px] font-semibold tabular-nums text-text-primary">
                {formatCount(bucket.count, numberFormat)}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

const REDACTED_ROW_WIDTHS = [
  ["w-24", "w-16", "w-16", "w-14", "w-14", "w-16", "w-16"],
  ["w-20", "w-14", "w-16", "w-16", "w-12", "w-14", "w-14"],
  ["w-28", "w-16", "w-14", "w-14", "w-16", "w-16", "w-16"],
  ["w-16", "w-14", "w-16", "w-16", "w-14", "w-14", "w-14"],
  ["w-24", "w-16", "w-14", "w-14", "w-16", "w-16", "w-16"],
] as const

function LockedHighestRiskTable({
  isAuthLoading,
  onReveal,
}: Readonly<{
  isAuthLoading: boolean
  onReveal: () => void
}>) {
  return (
    <div
      className="relative mt-4 min-h-96 overflow-hidden rounded-lg border border-border bg-surface"
      data-testid="locked-results"
    >
      <div className="overflow-x-auto">
        <Table
          className="min-w-[58rem]"
          aria-label="Detailed product results available after free sign-in"
        >
          <TableHeader>
            <TableRow className="hover:bg-surface-subtle">
              <TableHead>SKU</TableHead>
              <TableHead className="text-right">Supplier Cost</TableHead>
              <TableHead className="text-right">Selling Price</TableHead>
              <TableHead className="text-right">Gross Margin</TableHead>
              <TableHead className="text-right">Target Margin</TableHead>
              <TableHead
                className="text-right"
                title="Price for Target Margin"
                aria-label="Price for Target Margin"
              >
                Price for Target
                <span className="sr-only"> Margin</span>
              </TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody aria-hidden="true">
            {REDACTED_ROW_WIDTHS.map((widths, rowIndex) => (
              <TableRow key={rowIndex} data-testid="redacted-result-row">
                {widths.map((width, cellIndex) => (
                  <TableCell key={cellIndex}>
                    <span
                      className={cn(
                        "block h-2.5 rounded-sm bg-border-strong/70",
                        width,
                        cellIndex > 0 && cellIndex < 6 && "ml-auto",
                        cellIndex === 6 && "h-5 rounded-full bg-surface-subtle",
                      )}
                    />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div
        className="pointer-events-none absolute inset-x-0 top-12 bottom-0 bg-surface/60"
        aria-hidden="true"
      />
      <div className="absolute inset-x-3 top-20 bottom-5 flex items-center justify-center sm:inset-x-6">
        <div className="w-full max-w-lg rounded-md border border-border bg-surface px-5 py-5 text-center shadow-sm sm:px-7 sm:py-6">
          <div className="flex items-center justify-center gap-2">
            <LockKeyhole className="size-4 text-brand" aria-hidden="true" />
            <h3 className="text-[15px] leading-[22px] font-semibold text-text-primary">
              Your detailed results are ready
            </h3>
          </div>
          <p className="mx-auto mt-2 max-w-md text-sm leading-[22px] text-text-secondary">
            Your full catalog has already been analyzed locally. Sign in free to reveal
            your highest-risk products and explore the complete report.
          </p>
          <Button
            type="button"
            size="large"
            className="mt-4 w-full sm:w-auto"
            onClick={onReveal}
            disabled={isAuthLoading}
          >
            Reveal My Results — Free
          </Button>
          {isAuthLoading && (
            <p className="mt-2 text-xs text-text-muted" role="status">
              Checking sign-in status…
            </p>
          )}
          <div className="mt-3 text-xs leading-[18px] text-text-muted">
            <p>No payment or credit card required.</p>
            <p>Files stay on your computer.</p>
          </div>
        </div>
      </div>
    </div>
  )
}

function DataQualitySection({
  result,
  numberFormat,
  defaultOpen,
}: Pick<ResultsPageProps, "result" | "numberFormat"> & { defaultOpen: boolean }) {
  const { dataQuality } = result.metadata
  const metrics = [
    ["Supplier rows", dataQuality.supplierRows],
    ["Catalog rows", dataQuality.catalogRows],
    ["Matched products", dataQuality.matchedProducts],
    ["Supplier-only products", dataQuality.supplierOnlyProducts],
    ["Catalog-only products", dataQuality.catalogOnlyProducts],
    ["Duplicate supplier identifiers", dataQuality.supplierDuplicateIdentifiers],
    ["Duplicate catalog identifiers", dataQuality.catalogDuplicateIdentifiers],
    ["Invalid supplier costs", dataQuality.invalidSupplierCosts],
    ["Invalid selling prices", dataQuality.invalidSellingPrices],
    ["Invalid margin overrides", dataQuality.invalidMarginOverrides],
  ] as const

  return (
    <details
      className="group rounded-lg border border-border bg-surface"
      open={defaultOpen}
      data-testid="data-quality"
    >
      <summary className="flex min-h-14 list-none items-center justify-between gap-4 rounded-lg px-4 py-3 outline-none marker:content-none hover:bg-surface-hover focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 sm:px-5 [&::-webkit-details-marker]:hidden">
        <span>
          <span className="block text-[15px] font-semibold text-text-primary">
            Data quality
          </span>
          <span className="mt-0.5 block text-xs leading-[18px] text-text-muted">
            {formatCount(dataQuality.matchedProducts, numberFormat)} matched ·{" "}
            {formatCount(dataQuality.supplierDuplicateIdentifiers, numberFormat)} supplier
            duplicates · {formatCount(dataQuality.invalidSupplierCosts, numberFormat)}{" "}
            invalid supplier costs
          </span>
        </span>
        <ChevronDown
          className="size-4 shrink-0 text-text-muted transition-transform group-open:rotate-180"
          aria-hidden="true"
        />
      </summary>
      <dl className="grid border-t border-border px-4 py-2 sm:grid-cols-2 sm:px-5">
        {metrics.map(([label, count]) => (
          <div
            key={label}
            className="flex items-center justify-between gap-4 border-b border-border py-2.5 last:border-b-0 sm:odd:mr-6"
          >
            <dt className="text-[13px] text-text-secondary">{label}</dt>
            <dd className="text-[13px] font-semibold tabular-nums text-text-primary">
              {formatCount(count, numberFormat)}
            </dd>
          </div>
        ))}
      </dl>
    </details>
  )
}

function ResultsPage({
  result,
  currency,
  numberFormat,
  onStartNewScan,
  fullResultsService,
  overrideService,
  exportService,
  onMetadataChanged,
}: ResultsPageProps) {
  const { status: authStatus, capabilities, requestSignIn } = useAuthState()
  const [confirmNewScan, setConfirmNewScan] = useState(false)
  const [isResetting, setIsResetting] = useState(false)
  const { summary } = result.metadata
  const needsAttention = summary.productsAtLoss + summary.productsNeedingReview
  const hasNoAnalyzableProducts = summary.productsAnalyzed === 0
  const hasNoAttention = needsAttention === 0 && !hasNoAnalyzableProducts

  const startNewScan = async () => {
    setIsResetting(true)
    await onStartNewScan()
    setIsResetting(false)
    setConfirmNewScan(false)
  }

  return (
    <main id="main-content" className="min-h-[calc(100svh-4rem)] py-8 sm:py-10">
      <PageContainer width="results">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-[13px] font-semibold text-brand">Analysis complete</p>
            <h1 className="mt-1 text-[28px] leading-9 font-semibold tracking-[-0.02em] text-text-primary">
              Margin analysis
            </h1>
            <p className="mt-2 text-sm leading-[22px] text-text-secondary">
              <span className="font-semibold tabular-nums text-text-primary">
                {formatCount(summary.productsAnalyzed, numberFormat)}
              </span>{" "}
              {summary.productsAnalyzed === 1 ? "product" : "products"} analyzed locally
            </p>
          </div>
          <Button
            type="button"
            variant="secondary"
            onClick={() => setConfirmNewScan(true)}
          >
            <RotateCcw aria-hidden="true" />
            Start New Scan
          </Button>
        </header>

        <div className="mt-6">
          <SummarySurface result={result} numberFormat={numberFormat} />
        </div>

        {hasNoAnalyzableProducts ? (
          <Alert variant="warning" className="mt-6">
            <AlertTriangle aria-hidden="true" />
            <AlertTitle>
              We couldn't calculate margins for any matched products.
            </AlertTitle>
            <AlertDescription>
              Review Data Quality for invalid prices, costs, identifiers, or duplicate
              product IDs.
            </AlertDescription>
          </Alert>
        ) : (
          <div className="mt-8">
            <MarginExposureSection result={result} numberFormat={numberFormat} />
          </div>
        )}

        {hasNoAttention && (
          <Alert className="mt-8 border-ok-border bg-ok-soft" role="status">
            <CheckCircle2 className="text-ok" aria-hidden="true" />
            <AlertTitle>No products currently need margin review.</AlertTitle>
            <AlertDescription>
              All successfully analyzed products meet or exceed their configured target
              margin.
            </AlertDescription>
          </Alert>
        )}

        {capabilities.canViewFullResults && !hasNoAnalyzableProducts ? (
          <AuthenticatedResultsBrowser
            capabilities={capabilities}
            currency={currency}
            numberFormat={numberFormat}
            service={fullResultsService}
            overrideService={overrideService}
            onMetadataChanged={onMetadataChanged}
          />
        ) : needsAttention > 0 ? (
          <section className="mt-8" aria-labelledby="highest-risk-heading">
            <h2
              id="highest-risk-heading"
              className="text-lg leading-7 font-semibold text-text-primary"
            >
              Highest Risk Products
            </h2>
            <p className="mt-1 text-sm leading-[22px] text-text-secondary">
              {formatCount(needsAttention, numberFormat)}{" "}
              {needsAttention === 1 ? "product needs" : "products need"} attention. Reveal
              the products with the highest margin risk.
            </p>
            <LockedHighestRiskTable
              isAuthLoading={authStatus === "loading"}
              onReveal={requestSignIn}
            />
          </section>
        ) : null}

        {capabilities.canViewFullResults && !hasNoAnalyzableProducts && (
          <ExportReportsSection
            capabilities={capabilities}
            productsAnalyzed={summary.productsAnalyzed}
            productsNeedingAttention={needsAttention}
            numberFormat={numberFormat}
            service={exportService}
          />
        )}

        <div className="mt-8">
          <DataQualitySection
            result={result}
            numberFormat={numberFormat}
            defaultOpen={hasNoAnalyzableProducts}
          />
        </div>

        <p className="mt-5 text-xs leading-[18px] text-text-muted md:hidden">
          For large catalogs, we recommend using Catalog Margin Guard on a desktop
          computer.
        </p>
      </PageContainer>

      <Dialog open={confirmNewScan} onOpenChange={setConfirmNewScan}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Start a new scan?</DialogTitle>
            <DialogDescription>
              Your current analysis and session-only target overrides will be cleared.
              Your account will remain signed in.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setConfirmNewScan(false)}
              disabled={isResetting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => void startNewScan()}
              disabled={isResetting}
            >
              {isResetting ? "Clearing…" : "Start New Scan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  )
}

export { ResultsPage }
