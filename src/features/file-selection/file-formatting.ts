function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  const units = ["KB", "MB", "GB"] as const
  let value = bytes / 1024
  let unit: (typeof units)[number] = units[0]

  for (let index = 1; index < units.length && value >= 1024; index += 1) {
    value /= 1024
    unit = units[index] ?? unit
  }

  return `${value >= 100 ? value.toFixed(0) : value.toFixed(1)} ${unit}`
}

export { formatFileSize }
