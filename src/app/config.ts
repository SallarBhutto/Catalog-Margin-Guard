export const FILE_LIMITS = {
  csvWarningBytes: 500 * 1024 * 1024,
} as const

export const FILE_INSPECTION = {
  previewRowLimit: 10,
  sniffSampleSize: 20_480,
  prefixValidationBytes: 64 * 1024,
} as const
