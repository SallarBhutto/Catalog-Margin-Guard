import { FILE_LIMITS } from "@/app/config"
import { FileInspectionError } from "@/features/file-inspection/file-inspection-error"
import type {
  DelimitedFileFormat,
  FileMetadata,
  FileRole,
} from "@/features/file-inspection/file-inspection-types"

const FORMAT_BY_EXTENSION: Readonly<Record<string, DelimitedFileFormat>> = {
  csv: "CSV",
  tsv: "TSV",
}

function getFileExtension(name: string) {
  const match = /\.([^.]+)$/.exec(name.trim())
  return match?.[1]?.toLowerCase() ?? ""
}

function getDelimitedFileFormat(name: string): DelimitedFileFormat {
  const format = FORMAT_BY_EXTENSION[getFileExtension(name)]
  if (!format) throw new FileInspectionError("UNSUPPORTED_FILE_FORMAT")
  return format
}

function validateDelimitedFile(file: Pick<File, "name" | "size">): FileMetadata {
  const format = getDelimitedFileFormat(file.name)
  if (file.size === 0) throw new FileInspectionError("FILE_EMPTY")

  return { name: file.name, size: file.size, format }
}

function createInternalFilename(role: FileRole, format: DelimitedFileFormat) {
  const extension = format.toLowerCase()
  return `${role}-input.${extension}`
}

function getFileWarning(size: number): "LARGE_FILE" | null {
  return size > FILE_LIMITS.csvWarningBytes ? "LARGE_FILE" : null
}

export {
  createInternalFilename,
  getDelimitedFileFormat,
  getFileExtension,
  getFileWarning,
  validateDelimitedFile,
}
