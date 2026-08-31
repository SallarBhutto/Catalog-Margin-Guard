import { AlertTriangle, CheckCircle2, Columns3 } from "lucide-react"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type {
  CatalogColumnSuggestions,
  FileInspectionResult,
  FileRole,
  SupplierColumnSuggestions,
} from "@/features/file-inspection/file-inspection-types"
import { formatFileSize } from "@/features/file-selection/file-formatting"

type FileInspectionPanelProps = {
  role: FileRole
  result: FileInspectionResult
}

function getDelimiterLabel(delimiter: string) {
  const labels: Readonly<Record<string, string>> = {
    "\t": "Tab",
    ",": "Comma",
    ";": "Semicolon",
    "|": "Pipe",
  }
  return labels[delimiter] ?? "Detected"
}

function getSuggestionEntries(
  role: FileRole,
  suggestions: FileInspectionResult["suggestions"],
): readonly (readonly [string, string | undefined])[] {
  if (role === "supplier") {
    const supplier = suggestions as SupplierColumnSuggestions
    return [
      ["Product identifier", supplier.productIdentifier],
      ["Supplier cost", supplier.supplierCost],
    ] as const
  }

  const catalog = suggestions as CatalogColumnSuggestions
  return [
    ["Product identifier", catalog.productIdentifier],
    ["Selling price", catalog.sellingPrice],
    ["Margin override", catalog.marginOverride],
  ] as const
}

function FileInspectionPanel({ role, result }: FileInspectionPanelProps) {
  const suggestions = getSuggestionEntries(role, result.suggestions).filter(
    (entry): entry is readonly [string, string] => entry[1] !== undefined,
  )
  const headingId = `${role}-inspection-heading`

  return (
    <article
      className="overflow-hidden rounded-lg border border-border bg-surface"
      aria-labelledby={headingId}
      data-testid={`${role}-inspection`}
    >
      <div className="flex flex-col gap-4 border-b border-border p-5 sm:flex-row sm:items-start sm:justify-between sm:p-6">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="size-4 shrink-0 text-ok" aria-hidden="true" />
            <h3
              id={headingId}
              className="truncate text-[15px] font-semibold text-text-primary"
            >
              {result.metadata.name}
            </h3>
          </div>
          <p className="mt-1 pl-6 text-xs tabular-nums text-text-muted">
            {formatFileSize(result.metadata.size)} · {result.metadata.format} ·{" "}
            {getDelimiterLabel(result.delimiter)} delimiter
          </p>
        </div>
        <p className="shrink-0 text-xs text-text-muted">
          {result.columns.length} {result.columns.length === 1 ? "column" : "columns"}{" "}
          detected
        </p>
      </div>

      {result.warning === "LARGE_FILE" && (
        <div
          className="flex gap-3 border-b border-review-border bg-review-soft px-5 py-4 sm:px-6"
          role="status"
        >
          <AlertTriangle
            className="mt-0.5 size-4 shrink-0 text-review"
            aria-hidden="true"
          />
          <div>
            <p className="text-[13px] font-semibold text-review-strong">
              Large file detected
            </p>
            <p className="mt-1 text-xs leading-[18px] text-text-secondary">
              Inspection is available, but later analysis may use significant browser
              memory. For best results, use a desktop computer and close memory-heavy
              tabs.
            </p>
          </div>
        </div>
      )}

      <div className="grid gap-5 border-b border-border p-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_minmax(250px,0.42fr)]">
        <div>
          <div className="flex items-center gap-2">
            <Columns3 className="size-4 text-brand" aria-hidden="true" />
            <h4 className="text-[13px] font-semibold text-text-primary">
              Detected columns
            </h4>
          </div>
          <p className="mt-2 break-words text-xs leading-5 text-text-secondary">
            {result.columns.map((column) => column.name).join(" · ")}
          </p>
        </div>

        <div>
          <h4 className="text-[13px] font-semibold text-text-primary">Likely matches</h4>
          {suggestions.length > 0 ? (
            <dl className="mt-2 grid gap-1.5 text-xs leading-[18px]">
              {suggestions.map(([label, column]) => (
                <div key={label} className="flex justify-between gap-4">
                  <dt className="text-text-muted">{label}</dt>
                  <dd className="truncate font-medium text-text-primary" title={column}>
                    {column}
                  </dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="mt-2 text-xs leading-[18px] text-text-muted">
              No unambiguous header matches found. You can choose columns in the next
              phase.
            </p>
          )}
        </div>
      </div>

      <div className="p-5 sm:p-6">
        <div className="mb-3">
          <h4 className="text-[13px] font-semibold text-text-primary">File preview</h4>
          <p className="mt-1 text-xs text-text-muted">Showing a sample from this file.</p>
        </div>
        <div className="rounded-md border border-border">
          <Table aria-label={`${result.metadata.name} file preview`}>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                {result.columns.map((column) => (
                  <TableHead
                    key={column.sourceIndex}
                    className="min-w-36 whitespace-nowrap"
                  >
                    {column.name}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.preview.length > 0 ? (
                result.preview.map((row, rowIndex) => (
                  <TableRow key={rowIndex}>
                    {result.columns.map((column) => (
                      <TableCell
                        key={column.sourceIndex}
                        className="max-w-64 truncate whitespace-nowrap text-[13px] text-text-secondary"
                        title={row[column.name] ?? ""}
                      >
                        {row[column.name] ?? (
                          <span className="text-text-disabled">—</span>
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={result.columns.length}
                    className="h-20 text-center text-xs text-text-muted"
                  >
                    The file has headers but no data rows to preview.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </article>
  )
}

export { FileInspectionPanel }
