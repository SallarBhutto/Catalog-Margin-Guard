import { FILE_INSPECTION } from "@/app/config"
import type { AnalysisConfiguration } from "@/features/setup/analysis-configuration"
import type { RegisteredInputSource } from "@/features/file-inspection/file-inspection-service"
import { quoteDiscoveredColumn, quoteSqlString } from "@/lib/security/sql-identifiers"

const NORMALIZED_SUPPLIER_RELATION = "normalized_supplier" as const
const NORMALIZED_CATALOG_RELATION = "normalized_catalog" as const

const US_NUMBER_PATTERN =
  "^[+-]?(?:[0-9]+(?:\\.[0-9]+)?|[0-9]{1,3}(?:,[0-9]{3})+(?:\\.[0-9]+)?)$"
const EU_NUMBER_PATTERN =
  "^[+-]?(?:[0-9]+(?:,[0-9]+)?|[0-9]{1,3}(?:\\.[0-9]{3})+(?:,[0-9]+)?)$"
const CURRENCY_CODE_PATTERN = "^(USD|GBP|EUR|CAD|AUD)[[:space:]]*"
const CURRENCY_SYMBOL_PATTERN = "^[$€£][[:space:]]*"

type NormalizationSources = Readonly<{
  supplier: RegisteredInputSource
  catalog: RegisteredInputSource
}>

function createSourceExpression(source: RegisteredInputSource) {
  return `read_csv(${quoteSqlString(source.internalName)}, delim = ${quoteSqlString(source.delimiter)}, header = true, auto_detect = true, all_varchar = true, sample_size = ${FILE_INSPECTION.sniffSampleSize}, strict_mode = true, ignore_errors = false)`
}

function createNormalizedIdentifierExpression(
  rawExpression: string,
  caseInsensitive: boolean,
) {
  const trimmed = `trim(${rawExpression})`
  const normalized = caseInsensitive ? `upper(${trimmed})` : trimmed
  return `CASE WHEN ${rawExpression} IS NULL OR ${trimmed} = '' THEN CAST(NULL AS VARCHAR) ELSE ${normalized} END`
}

function stripCurrencyDecoration(rawExpression: string) {
  const trimmed = `trim(coalesce(${rawExpression}, ''))`
  const withoutCode = `regexp_replace(${trimmed}, ${quoteSqlString(CURRENCY_CODE_PATTERN)}, '', 'i')`
  return `regexp_replace(${withoutCode}, ${quoteSqlString(CURRENCY_SYMBOL_PATTERN)}, '')`
}

function createDecimalParseExpression(
  rawExpression: string,
  numberFormat: AnalysisConfiguration["options"]["numberFormat"],
  decimalType: "DECIMAL(18,4)" | "DECIMAL(7,4)",
  allowCurrency: boolean,
) {
  const cleaned = allowCurrency
    ? stripCurrencyDecoration(rawExpression)
    : `trim(coalesce(${rawExpression}, ''))`
  const pattern = numberFormat === "US" ? US_NUMBER_PATTERN : EU_NUMBER_PATTERN
  const canonical =
    numberFormat === "US"
      ? `replace(${cleaned}, ',', '')`
      : `replace(replace(${cleaned}, '.', ''), ',', '.')`

  return `CASE WHEN regexp_full_match(${cleaned}, ${quoteSqlString(pattern)}) THEN try_cast(${canonical} AS ${decimalType}) ELSE CAST(NULL AS ${decimalType}) END`
}

function createSupplierNormalizationSql(
  configuration: AnalysisConfiguration,
  source: RegisteredInputSource,
) {
  const identifier = quoteDiscoveredColumn(
    configuration.mapping.supplierIdentifier,
    source.columns,
  )
  const supplierCost = quoteDiscoveredColumn(
    configuration.mapping.supplierCost,
    source.columns,
  )
  const sourceExpression = createSourceExpression(source)
  const normalizedIdentifier = createNormalizedIdentifierExpression(
    "original_identifier",
    configuration.options.caseInsensitive,
  )
  const parsedCost = createDecimalParseExpression(
    "raw_supplier_cost",
    configuration.options.numberFormat,
    "DECIMAL(18,4)",
    true,
  )

  return `CREATE TABLE ${NORMALIZED_SUPPLIER_RELATION} AS
WITH source_rows AS (
  SELECT
    CAST(row_number() OVER () AS UBIGINT) AS source_row_id,
    CAST(${identifier} AS VARCHAR) AS original_identifier,
    CAST(${supplierCost} AS VARCHAR) AS raw_supplier_cost
  FROM ${sourceExpression}
), normalized AS (
  SELECT *, ${normalizedIdentifier} AS normalized_identifier
  FROM source_rows
), parsed AS (
  SELECT *, ${parsedCost} AS supplier_cost
  FROM normalized
), duplicate_counts AS (
  SELECT *, count(*) OVER (PARTITION BY normalized_identifier) AS normalized_identifier_count
  FROM parsed
)
SELECT
  source_row_id,
  original_identifier,
  normalized_identifier,
  raw_supplier_cost,
  supplier_cost,
  normalized_identifier IS NOT NULL AS is_identifier_valid,
  supplier_cost IS NOT NULL AND supplier_cost >= CAST(0 AS DECIMAL(18,4)) AS is_supplier_cost_valid,
  normalized_identifier IS NOT NULL AND normalized_identifier_count > 1 AS is_duplicate_identifier
FROM duplicate_counts;`
}

function createCatalogNormalizationSql(
  configuration: AnalysisConfiguration,
  source: RegisteredInputSource,
) {
  const identifier = quoteDiscoveredColumn(
    configuration.mapping.catalogIdentifier,
    source.columns,
  )
  const sellingPrice = quoteDiscoveredColumn(
    configuration.mapping.catalogPrice,
    source.columns,
  )
  const rawOverride = configuration.mapping.catalogMarginOverride
    ? `CAST(${quoteDiscoveredColumn(
        configuration.mapping.catalogMarginOverride,
        source.columns,
      )} AS VARCHAR)`
    : "CAST(NULL AS VARCHAR)"
  const sourceExpression = createSourceExpression(source)
  const normalizedIdentifier = createNormalizedIdentifierExpression(
    "original_identifier",
    configuration.options.caseInsensitive,
  )
  const parsedPrice = createDecimalParseExpression(
    "raw_selling_price",
    configuration.options.numberFormat,
    "DECIMAL(18,4)",
    true,
  )
  const parsedOverride = createDecimalParseExpression(
    "raw_margin_override",
    configuration.options.numberFormat,
    "DECIMAL(7,4)",
    false,
  )

  return `CREATE TABLE ${NORMALIZED_CATALOG_RELATION} AS
WITH source_rows AS (
  SELECT
    CAST(row_number() OVER () AS UBIGINT) AS source_row_id,
    CAST(${identifier} AS VARCHAR) AS original_identifier,
    CAST(${sellingPrice} AS VARCHAR) AS raw_selling_price,
    ${rawOverride} AS raw_margin_override
  FROM ${sourceExpression}
), normalized AS (
  SELECT
    *,
    ${normalizedIdentifier} AS normalized_identifier,
    trim(coalesce(raw_margin_override, '')) <> '' AS has_margin_override
  FROM source_rows
), parsed AS (
  SELECT
    *,
    ${parsedPrice} AS selling_price,
    ${parsedOverride} AS parsed_margin_override
  FROM normalized
), duplicate_counts AS (
  SELECT *, count(*) OVER (PARTITION BY normalized_identifier) AS normalized_identifier_count
  FROM parsed
)
SELECT
  source_row_id,
  original_identifier,
  normalized_identifier,
  raw_selling_price,
  selling_price,
  raw_margin_override,
  CASE
    WHEN has_margin_override
      AND parsed_margin_override BETWEEN CAST(0 AS DECIMAL(7,4)) AND CAST(95 AS DECIMAL(7,4))
    THEN parsed_margin_override
    ELSE CAST(NULL AS DECIMAL(7,4))
  END AS catalog_margin_override,
  normalized_identifier IS NOT NULL AS is_identifier_valid,
  selling_price IS NOT NULL AND selling_price > CAST(0 AS DECIMAL(18,4)) AS is_selling_price_valid,
  NOT has_margin_override OR (
    parsed_margin_override IS NOT NULL
    AND parsed_margin_override BETWEEN CAST(0 AS DECIMAL(7,4)) AND CAST(95 AS DECIMAL(7,4))
  ) AS is_margin_override_valid,
  has_margin_override,
  normalized_identifier IS NOT NULL AND normalized_identifier_count > 1 AS is_duplicate_identifier
FROM duplicate_counts;`
}

const NORMALIZATION_QUALITY_SQL = `SELECT
  (SELECT count(*) FROM ${NORMALIZED_SUPPLIER_RELATION})::UBIGINT AS supplier_rows,
  (SELECT count(*) FROM ${NORMALIZED_CATALOG_RELATION})::UBIGINT AS catalog_rows,
  (SELECT count(DISTINCT normalized_identifier) FILTER (WHERE is_duplicate_identifier) FROM ${NORMALIZED_SUPPLIER_RELATION})::UBIGINT AS supplier_duplicate_identifiers,
  (SELECT count(DISTINCT normalized_identifier) FILTER (WHERE is_duplicate_identifier) FROM ${NORMALIZED_CATALOG_RELATION})::UBIGINT AS catalog_duplicate_identifiers,
  (SELECT count(*) FILTER (WHERE NOT is_supplier_cost_valid) FROM ${NORMALIZED_SUPPLIER_RELATION})::UBIGINT AS invalid_supplier_costs,
  (SELECT count(*) FILTER (WHERE NOT is_selling_price_valid) FROM ${NORMALIZED_CATALOG_RELATION})::UBIGINT AS invalid_selling_prices,
  (SELECT count(*) FILTER (WHERE NOT is_margin_override_valid) FROM ${NORMALIZED_CATALOG_RELATION})::UBIGINT AS invalid_margin_overrides,
  (SELECT count(*) FILTER (WHERE NOT is_identifier_valid) FROM ${NORMALIZED_SUPPLIER_RELATION})::UBIGINT AS invalid_supplier_identifiers,
  (SELECT count(*) FILTER (WHERE NOT is_identifier_valid) FROM ${NORMALIZED_CATALOG_RELATION})::UBIGINT AS invalid_catalog_identifiers;`

function createNormalizationSql(
  configuration: AnalysisConfiguration,
  sources: NormalizationSources,
) {
  return {
    supplier: createSupplierNormalizationSql(configuration, sources.supplier),
    catalog: createCatalogNormalizationSql(configuration, sources.catalog),
    quality: NORMALIZATION_QUALITY_SQL,
  }
}

export {
  NORMALIZATION_QUALITY_SQL,
  NORMALIZED_CATALOG_RELATION,
  NORMALIZED_SUPPLIER_RELATION,
  createCatalogNormalizationSql,
  createDecimalParseExpression,
  createNormalizationSql,
  createNormalizedIdentifierExpression,
  createSupplierNormalizationSql,
}
export type { NormalizationSources }
