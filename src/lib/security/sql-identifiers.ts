function quoteSqlIdentifier(identifier: string): string {
  return `"${identifier.replaceAll('"', '""')}"`
}

function quoteDiscoveredColumn(identifier: string, discoveredColumns: readonly string[]) {
  if (!discoveredColumns.includes(identifier)) {
    throw new Error("Column is not present in the discovered schema")
  }

  return quoteSqlIdentifier(identifier)
}

function quoteSqlString(value: string): string {
  return `'${value.replaceAll("'", "''")}'`
}

export { quoteDiscoveredColumn, quoteSqlIdentifier, quoteSqlString }
