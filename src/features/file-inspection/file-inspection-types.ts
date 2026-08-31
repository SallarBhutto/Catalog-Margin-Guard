type FileRole = "supplier" | "catalog"
type DelimitedFileFormat = "CSV" | "TSV"
type FileInspectionStatus = "idle" | "inspecting" | "ready" | "warning" | "error"

type FileMetadata = Readonly<{
  name: string
  size: number
  format: DelimitedFileFormat
}>

type DiscoveredColumn = Readonly<{
  name: string
  sourceIndex: number
}>

type PreviewRow = Readonly<Record<string, string | null>>

type SupplierColumnSuggestions = Readonly<{
  productIdentifier?: string
  supplierCost?: string
}>

type CatalogColumnSuggestions = Readonly<{
  productIdentifier?: string
  sellingPrice?: string
  marginOverride?: string
}>

type ColumnSuggestions = SupplierColumnSuggestions | CatalogColumnSuggestions

type FileInspectionResult = Readonly<{
  metadata: FileMetadata
  internalName: string
  delimiter: string
  columns: readonly DiscoveredColumn[]
  preview: readonly PreviewRow[]
  suggestions: ColumnSuggestions
  warning: "LARGE_FILE" | null
}>

export type {
  CatalogColumnSuggestions,
  ColumnSuggestions,
  DelimitedFileFormat,
  DiscoveredColumn,
  FileInspectionResult,
  FileInspectionStatus,
  FileMetadata,
  FileRole,
  PreviewRow,
  SupplierColumnSuggestions,
}
