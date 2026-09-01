import { Search, X } from "lucide-react"
import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react"

import type { AccessCapabilities } from "@/app/access-policy"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  formatCount,
  formatMoney,
  formatPercent,
} from "@/features/results/results-formatting"
import { resultsQueryService } from "@/features/results/results-query-service"
import {
  DEFAULT_RESULT_PAGE_SIZE,
  RESULT_PAGE_SIZES,
  type ResultPageSize,
  type ResultSort,
  type ResultStatusFilter,
  type ResultsPage,
  type ResultsQuery,
  type ResultTargetSourceFilter,
} from "@/features/results/results-query-types"
import { StatusBadge } from "@/features/results/status-badge"
import type {
  DisplayCurrency,
  NumberFormat,
} from "@/features/setup/analysis-configuration"
import { cn } from "@/lib/utils"

const DEFAULT_QUERY: ResultsQuery = {
  status: "ALL",
  targetSource: "ALL",
  sort: "RISK_HIGHEST",
  page: 1,
  pageSize: DEFAULT_RESULT_PAGE_SIZE,
}

const STATUS_OPTIONS: readonly Readonly<{
  value: ResultStatusFilter
  label: string
}>[] = [
  { value: "ALL", label: "All" },
  { value: "LOSS", label: "Loss" },
  { value: "REVIEW", label: "Needs Review" },
  { value: "OK", label: "Meeting Target" },
]

const TARGET_SOURCE_OPTIONS: readonly Readonly<{
  value: ResultTargetSourceFilter
  label: string
}>[] = [
  { value: "ALL", label: "All" },
  { value: "STORE_DEFAULT", label: "Store Default" },
  { value: "CATALOG_OVERRIDE", label: "Product Override" },
]

const SORT_OPTIONS: readonly Readonly<{ value: ResultSort; label: string }>[] = [
  { value: "RISK_HIGHEST", label: "Risk: Highest first" },
  { value: "MARGIN_LOWEST", label: "Margin: Lowest first" },
  { value: "MARGIN_HIGHEST", label: "Margin: Highest first" },
  { value: "IDENTIFIER_ASC", label: "Identifier: A–Z" },
  { value: "IDENTIFIER_DESC", label: "Identifier: Z–A" },
  { value: "SUPPLIER_COST_ASC", label: "Supplier Cost: Low–High" },
  { value: "SUPPLIER_COST_DESC", label: "Supplier Cost: High–Low" },
  { value: "SELLING_PRICE_ASC", label: "Selling Price: Low–High" },
  { value: "SELLING_PRICE_DESC", label: "Selling Price: High–Low" },
  { value: "TARGET_MARGIN_ASC", label: "Target Margin: Low–High" },
  { value: "TARGET_MARGIN_DESC", label: "Target Margin: High–Low" },
  { value: "PRICE_FOR_TARGET_ASC", label: "Price for Target: Low–High" },
  { value: "PRICE_FOR_TARGET_DESC", label: "Price for Target: High–Low" },
]

type ResultsPageQueryService = Pick<typeof resultsQueryService, "getResultsPage">

type AuthenticatedResultsBrowserProps = Readonly<{
  capabilities: Pick<
    AccessCapabilities,
    "canPaginateFullResults" | "canSearchFullResults" | "canViewFullResults"
  >
  currency: DisplayCurrency
  numberFormat: NumberFormat
  service?: ResultsPageQueryService
}>

function targetSourceLabel(source: "STORE_DEFAULT" | "CATALOG_OVERRIDE") {
  return source === "STORE_DEFAULT" ? "Store Default" : "Product Override"
}

function AuthenticatedResultsBrowser({
  capabilities,
  currency,
  numberFormat,
  service = resultsQueryService,
}: AuthenticatedResultsBrowserProps) {
  const [searchInput, setSearchInput] = useState("")
  const [query, setQuery] = useState<ResultsQuery>(DEFAULT_QUERY)
  const [pageData, setPageData] = useState<ResultsPage | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const requestGeneration = useRef(0)

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      const search = searchInput.trim()
      const nextSearch = search || undefined
      if (query.search === nextSearch) return
      setIsLoading(true)
      setError(null)
      setQuery((current) => ({ ...current, search: nextSearch, page: 1 }))
    }, 300)
    return () => window.clearTimeout(timeout)
  }, [query.search, searchInput])

  useEffect(() => {
    if (!capabilities.canViewFullResults) return

    const generation = ++requestGeneration.current
    void service
      .getResultsPage(query)
      .then((result) => {
        if (generation !== requestGeneration.current) return
        setPageData(result)
        if (result.page !== query.page) {
          setQuery((current) => ({ ...current, page: result.page }))
        }
      })
      .catch(() => {
        if (generation !== requestGeneration.current) return
        setError("We couldn't load these results. Try the query again.")
      })
      .finally(() => {
        if (generation === requestGeneration.current) setIsLoading(false)
      })

    return () => {
      requestGeneration.current += 1
    }
  }, [capabilities.canViewFullResults, query, service])

  const hasActiveFilters = Boolean(
    searchInput || query.status !== "ALL" || query.targetSource !== "ALL",
  )
  const totalPages = Math.max(1, Math.ceil((pageData?.totalRows ?? 0) / query.pageSize))
  const range = useMemo(() => {
    if (!pageData?.totalRows || pageData.rows.length === 0) return { start: 0, end: 0 }
    const start = (pageData.page - 1) * pageData.pageSize + 1
    return { start, end: start + pageData.rows.length - 1 }
  }, [pageData])

  const updateQuery = (change: Partial<ResultsQuery>) => {
    setIsLoading(true)
    setError(null)
    setQuery((current) => ({ ...current, ...change, page: 1 }))
  }

  const clearFilters = () => {
    setIsLoading(true)
    setError(null)
    setSearchInput("")
    setQuery((current) => ({
      ...DEFAULT_QUERY,
      pageSize: current.pageSize,
    }))
  }

  const onSearchChange = (event: ChangeEvent<HTMLInputElement>) => {
    setSearchInput(event.target.value)
  }

  return (
    <section className="mt-8" aria-labelledby="products-heading">
      <div>
        <h2
          id="products-heading"
          className="text-lg leading-7 font-semibold text-text-primary"
        >
          Products
        </h2>
        <p className="mt-1 text-sm leading-[22px] text-text-secondary">
          Browse every successfully analyzed product. Summary metrics above remain for the
          complete analysis.
        </p>
      </div>

      <div className="mt-4 space-y-4 rounded-lg border border-border bg-surface p-4 sm:p-5">
        {capabilities.canSearchFullResults && (
          <div className="relative max-w-xl">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-text-muted"
              aria-hidden="true"
            />
            <Input
              type="search"
              value={searchInput}
              onChange={onSearchChange}
              placeholder="Search identifier"
              aria-label="Search product identifier"
              className="pr-10 pl-9"
            />
            {searchInput && (
              <button
                type="button"
                onClick={() => setSearchInput("")}
                className="absolute top-1/2 right-1 flex size-8 -translate-y-1/2 items-center justify-center rounded-sm text-text-muted outline-none hover:bg-surface-subtle hover:text-text-primary focus-visible:ring-2 focus-visible:ring-brand"
                aria-label="Clear identifier search"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            )}
          </div>
        )}

        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <fieldset className="min-w-0">
            <legend className="mb-2 text-xs font-medium text-text-secondary">
              Status
            </legend>
            <div className="flex flex-wrap gap-2">
              {STATUS_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={query.status === option.value}
                  onClick={() => updateQuery({ status: option.value })}
                  className={cn(
                    "min-h-10 rounded-md border px-3 text-[13px] font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2",
                    query.status === option.value
                      ? "border-brand bg-brand-soft text-brand-active"
                      : "border-border-strong bg-surface text-text-secondary hover:bg-surface-hover hover:text-text-primary",
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </fieldset>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[11rem_15rem_auto]">
            <label className="block text-xs font-medium text-text-secondary">
              Target source
              <Select
                value={query.targetSource}
                onValueChange={(value) =>
                  updateQuery({ targetSource: value as ResultTargetSourceFilter })
                }
              >
                <SelectTrigger className="mt-2" aria-label="Target source">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TARGET_SOURCE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>

            <label className="block text-xs font-medium text-text-secondary">
              Sort
              <Select
                value={query.sort}
                onValueChange={(value) => updateQuery({ sort: value as ResultSort })}
              >
                <SelectTrigger className="mt-2" aria-label="Sort results">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SORT_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>

            {capabilities.canPaginateFullResults && (
              <label className="block text-xs font-medium text-text-secondary sm:col-span-2 xl:col-span-1">
                Rows per page
                <Select
                  value={String(query.pageSize)}
                  onValueChange={(value) =>
                    updateQuery({ pageSize: Number(value) as ResultPageSize })
                  }
                >
                  <SelectTrigger className="mt-2 xl:w-32" aria-label="Rows per page">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {RESULT_PAGE_SIZES.map((size) => (
                      <SelectItem key={size} value={String(size)}>
                        {size}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>
            )}
          </div>
        </div>
      </div>

      <div
        className="relative mt-4 overflow-hidden rounded-lg border border-border bg-surface"
        aria-busy={isLoading}
      >
        {isLoading && pageData && (
          <div
            className="absolute inset-x-0 top-0 z-20 h-0.5 overflow-hidden bg-brand-soft"
            role="status"
            aria-label="Loading results"
          >
            <span className="block h-full w-1/3 animate-pulse bg-brand motion-reduce:animate-none" />
          </div>
        )}

        {!pageData && isLoading ? (
          <div
            className="flex min-h-48 items-center justify-center px-4 text-sm text-text-secondary"
            role="status"
          >
            Loading results…
          </div>
        ) : error ? (
          <div className="flex min-h-48 flex-col items-center justify-center gap-3 px-4 text-center">
            <p className="text-sm font-medium text-text-primary">{error}</p>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setIsLoading(true)
                setError(null)
                setQuery((current) => ({ ...current }))
              }}
            >
              Try again
            </Button>
          </div>
        ) : pageData?.rows.length === 0 ? (
          <div className="flex min-h-48 flex-col items-center justify-center gap-3 px-4 text-center">
            <div>
              <p className="text-sm font-semibold text-text-primary">
                No products match these filters.
              </p>
              <p className="mt-1 text-sm text-text-secondary">
                Adjust the search or filters to see more products.
              </p>
            </div>
            {hasActiveFilters && (
              <Button type="button" variant="secondary" onClick={clearFilters}>
                Clear filters
              </Button>
            )}
          </div>
        ) : (
          <Table className="min-w-[68rem]" aria-label="Complete product results">
            <TableHeader className="sticky top-0 z-10">
              <TableRow className="hover:bg-surface-subtle">
                <TableHead>SKU</TableHead>
                <TableHead className="text-right">Supplier Cost</TableHead>
                <TableHead className="text-right">Selling Price</TableHead>
                <TableHead className="text-right">Gross Margin</TableHead>
                <TableHead className="text-right">Target Margin</TableHead>
                <TableHead>Target Source</TableHead>
                <TableHead className="text-right" title="Price for Target Margin">
                  Price for Target<span className="sr-only"> Margin</span>
                </TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className={cn(isLoading && "opacity-60")}>
              {pageData?.rows.map((row, index) => (
                <TableRow key={`${row.identifier}-${index}`}>
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
                  <TableCell className="text-text-secondary">
                    {targetSourceLabel(row.targetSource)}
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
        )}
      </div>

      {pageData && capabilities.canPaginateFullResults && (
        <div className="mt-4 flex flex-col gap-3 text-sm text-text-secondary sm:flex-row sm:items-center sm:justify-between">
          <p className="tabular-nums" aria-live="polite">
            Showing {formatCount(range.start, numberFormat)}–
            {formatCount(range.end, numberFormat)} of{" "}
            {formatCount(pageData.totalRows, numberFormat)}
          </p>
          <div className="flex items-center justify-between gap-3 sm:justify-end">
            <Button
              type="button"
              variant="secondary"
              size="small"
              disabled={query.page <= 1 || isLoading}
              onClick={() => {
                setIsLoading(true)
                setError(null)
                setQuery((current) => ({ ...current, page: current.page - 1 }))
              }}
            >
              Previous
            </Button>
            <span className="min-w-24 text-center text-xs tabular-nums text-text-muted">
              Page {pageData.page} of {totalPages}
            </span>
            <Button
              type="button"
              variant="secondary"
              size="small"
              disabled={query.page >= totalPages || isLoading}
              onClick={() => {
                setIsLoading(true)
                setError(null)
                setQuery((current) => ({ ...current, page: current.page + 1 }))
              }}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </section>
  )
}

export { AuthenticatedResultsBrowser }
export type { ResultsPageQueryService }
