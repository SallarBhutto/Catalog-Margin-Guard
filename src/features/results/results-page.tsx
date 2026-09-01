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
import type { MarginAnalysisSuccess } from "@/features/analysis/margin-analysis-types"
import { useAuthState } from "@/features/auth/auth-context"
import {
  AuthenticatedResultsBrowser,
  type ResultsPageQueryService,
} from "@/features/results/authenticated-results-browser"
import {
  formatCount,
  formatMoney,
  formatPercent,
} from "@/features/results/results-formatting"
import type { MarginResultRow } from "@/features/results/results-query-types"
import { StatusBadge } from "@/features/results/status-badge"
import type {
  DisplayCurrency,
  NumberFormat,
} from "@/features/setup/analysis-configuration"
import { cn } from "@/lib/utils"

type ResultsPageProps = Readonly<{
  result: MarginAnalysisSuccess
  previewRows: readonly MarginResultRow[]
  currency: DisplayCurrency
  numberFormat: NumberFormat
  onStartNewScan: () => Promise<void>
  fullResultsService?: ResultsPageQueryService
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

function HighestRiskTable({
  rows,
  currency,
  numberFormat,
}: Readonly<{
  rows: readonly MarginResultRow[]
  currency: DisplayCurrency
  numberFormat: NumberFormat
}>) {
  return (
    <div className="mt-4 overflow-hidden rounded-lg border border-border bg-surface">
      <Table className="min-w-[58rem]" aria-label="Highest risk products">
        <TableHeader>
          <TableRow className="hover:bg-surface-subtle">
            <TableHead>SKU</TableHead>
            <TableHead className="text-right">Supplier Cost</TableHead>
            <TableHead className="text-right">Selling Price</TableHead>
            <TableHead className="text-right">Gross Margin</TableHead>
            <TableHead className="text-right">Target Margin</TableHead>
            <TableHead className="text-right" title="Price for Target Margin">
              Price for Target
              <span className="sr-only"> Margin</span>
            </TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.identifier}>
              <TableCell
                className="max-w-64 truncate font-medium text-text-primary"
                title={row.identifier}
              >
                {row.identifier}
              </TableCell>
              <TableCell className="text-right tabular-nums text-text-secondary">
                {formatMoney(row.supplierCost, currency, numberFormat)}
              </TableCell>
              <TableCell className="text-right tabular-nums text-text-secondary">
                {formatMoney(row.sellingPrice, currency, numberFormat)}
              </TableCell>
              <TableCell
                className={cn(
                  "text-right font-medium tabular-nums",
                  row.status === "LOSS"
                    ? "text-loss-strong"
                    : row.status === "REVIEW"
                      ? "text-review-strong"
                      : "text-text-primary",
                )}
              >
                {formatPercent(row.grossMarginPercent, numberFormat)}
              </TableCell>
              <TableCell className="text-right tabular-nums text-text-secondary">
                {formatPercent(row.targetMarginPercent, numberFormat)}
              </TableCell>
              <TableCell className="text-right tabular-nums text-text-primary">
                {formatMoney(row.priceForTargetMargin, currency, numberFormat)}
              </TableCell>
              <TableCell>
                <StatusBadge status={row.status} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
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
  previewRows,
  currency,
  numberFormat,
  onStartNewScan,
  fullResultsService,
}: ResultsPageProps) {
  const { status: authStatus, capabilities, requestSignIn } = useAuthState()
  const [confirmNewScan, setConfirmNewScan] = useState(false)
  const [isResetting, setIsResetting] = useState(false)
  const { summary } = result.metadata
  const needsAttention = summary.productsAtLoss + summary.productsNeedingReview
  const hiddenAttention = Math.max(0, needsAttention - previewRows.length)
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
              Products needing attention, ordered by risk and lowest gross margin.
            </p>
            <HighestRiskTable
              rows={previewRows}
              currency={currency}
              numberFormat={numberFormat}
            />

            {hiddenAttention > 0 && (
              <div className="mt-5 rounded-lg border border-brand-soft-border bg-brand-soft p-5 sm:flex sm:items-center sm:justify-between sm:gap-8 sm:p-6">
                <div>
                  <p className="text-[15px] font-semibold text-text-primary">
                    Showing {formatCount(previewRows.length, numberFormat)} of{" "}
                    {formatCount(needsAttention, numberFormat)} products needing
                    attention.
                  </p>
                  <p className="mt-1 text-sm leading-[22px] text-text-secondary">
                    {formatCount(hiddenAttention, numberFormat)} more products are hidden.
                  </p>
                  <p className="mt-3 flex items-center gap-2 text-xs text-text-secondary">
                    <LockKeyhole className="size-4 text-brand" aria-hidden="true" />
                    Signing in does not upload your catalog.
                  </p>
                </div>
                <div className="mt-5 shrink-0 sm:mt-0">
                  {authStatus === "anonymous" ? (
                    <>
                      <Button type="button" size="large" onClick={requestSignIn}>
                        See All Results — Free
                      </Button>
                      <p className="mt-2 text-center text-xs text-text-muted">
                        No credit card required.
                      </p>
                    </>
                  ) : (
                    <p className="text-sm font-medium text-text-secondary" role="status">
                      Checking sign-in status…
                    </p>
                  )}
                </div>
              </div>
            )}
          </section>
        ) : null}

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
              Your current analysis will be cleared. Your account will remain signed in.
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
