import type { AnalysisConfiguration } from "@/features/setup/analysis-configuration"
import { quoteSqlString } from "@/lib/security/sql-identifiers"

const UNIQUE_SUPPLIER_RELATION = "unique_supplier_identifiers" as const
const UNIQUE_CATALOG_RELATION = "unique_catalog_identifiers" as const
const IDENTIFIER_MATCHES_RELATION = "identifier_matches" as const
const ANALYSIS_RESULTS_RELATION = "analysis_results" as const

const ANALYSIS_RELATION_NAMES = [
  ANALYSIS_RESULTS_RELATION,
  IDENTIFIER_MATCHES_RELATION,
  UNIQUE_CATALOG_RELATION,
  UNIQUE_SUPPLIER_RELATION,
] as const

const DROP_ANALYSIS_RELATIONS_SQL = ANALYSIS_RELATION_NAMES.map(
  (name) => `DROP TABLE IF EXISTS ${name};`,
)

function createPriceForTargetMarginExpression(
  supplierCost = "supplier_cost",
  targetMargin = "effective_target_margin_pct",
) {
  const supplierCostUnits = `CAST(${supplierCost} * CAST(10000 AS DECIMAL(18,0)) AS HUGEINT)`
  const targetMarginUnits = `CAST(${targetMargin} * CAST(10000 AS DECIMAL(18,0)) AS HUGEINT)`
  const denominator = `(CAST(1000000 AS HUGEINT) - ${targetMarginUnits})`

  return `CAST(
    CAST(
      ((${supplierCostUnits} * CAST(10000 AS HUGEINT)) + ${denominator} - CAST(1 AS HUGEINT))
        // ${denominator}
      AS DECIMAL(18,0)
    ) * CAST(0.01 AS DECIMAL(3,2))
    AS DECIMAL(18,2)
  )`
}

function createProductStatusExpression(
  supplierCost = "supplier_cost",
  sellingPrice = "selling_price",
  targetMargin = "effective_target_margin_pct",
) {
  return `CASE
    WHEN ${sellingPrice} < ${supplierCost} THEN 'LOSS'
    WHEN
      CAST(100 AS DECIMAL(7,4)) * (${sellingPrice} - ${supplierCost})
      < ${targetMargin} * ${sellingPrice}
    THEN 'REVIEW'
    ELSE 'OK'
  END`
}

const CREATE_UNIQUE_SUPPLIER_SQL = `CREATE TABLE ${UNIQUE_SUPPLIER_RELATION} AS
SELECT
  normalized_identifier AS match_key,
  source_row_id AS supplier_source_row_id,
  original_identifier AS supplier_original_identifier,
  supplier_cost,
  is_supplier_cost_valid
FROM normalized_supplier
WHERE is_identifier_valid
  AND NOT is_duplicate_identifier;`

const CREATE_UNIQUE_CATALOG_SQL = `CREATE TABLE ${UNIQUE_CATALOG_RELATION} AS
SELECT
  normalized_identifier AS match_key,
  source_row_id AS catalog_source_row_id,
  original_identifier AS catalog_original_identifier,
  selling_price,
  catalog_margin_override,
  is_selling_price_valid,
  is_margin_override_valid
FROM normalized_catalog
WHERE is_identifier_valid
  AND NOT is_duplicate_identifier;`

const CREATE_IDENTIFIER_MATCHES_SQL = `CREATE TABLE ${IDENTIFIER_MATCHES_RELATION} AS
SELECT
  supplier.match_key,
  supplier.supplier_source_row_id,
  catalog.catalog_source_row_id,
  supplier.supplier_original_identifier,
  catalog.catalog_original_identifier,
  supplier.supplier_cost,
  catalog.selling_price,
  catalog.catalog_margin_override,
  supplier.is_supplier_cost_valid,
  catalog.is_selling_price_valid,
  catalog.is_margin_override_valid,
  'MATCHED' AS match_status
FROM ${UNIQUE_SUPPLIER_RELATION} AS supplier
INNER JOIN ${UNIQUE_CATALOG_RELATION} AS catalog
  ON supplier.match_key = catalog.match_key

UNION ALL

SELECT
  supplier.match_key,
  supplier.supplier_source_row_id,
  CAST(NULL AS UBIGINT) AS catalog_source_row_id,
  supplier.supplier_original_identifier,
  CAST(NULL AS VARCHAR) AS catalog_original_identifier,
  supplier.supplier_cost,
  CAST(NULL AS DECIMAL(18,4)) AS selling_price,
  CAST(NULL AS DECIMAL(7,4)) AS catalog_margin_override,
  supplier.is_supplier_cost_valid,
  false AS is_selling_price_valid,
  true AS is_margin_override_valid,
  'SUPPLIER_ONLY' AS match_status
FROM ${UNIQUE_SUPPLIER_RELATION} AS supplier
WHERE NOT EXISTS (
  SELECT 1
  FROM normalized_catalog AS catalog
  WHERE catalog.is_identifier_valid
    AND catalog.normalized_identifier = supplier.match_key
)

UNION ALL

SELECT
  catalog.match_key,
  CAST(NULL AS UBIGINT) AS supplier_source_row_id,
  catalog.catalog_source_row_id,
  CAST(NULL AS VARCHAR) AS supplier_original_identifier,
  catalog.catalog_original_identifier,
  CAST(NULL AS DECIMAL(18,4)) AS supplier_cost,
  catalog.selling_price,
  catalog.catalog_margin_override,
  false AS is_supplier_cost_valid,
  catalog.is_selling_price_valid,
  catalog.is_margin_override_valid,
  'CATALOG_ONLY' AS match_status
FROM ${UNIQUE_CATALOG_RELATION} AS catalog
WHERE NOT EXISTS (
  SELECT 1
  FROM normalized_supplier AS supplier
  WHERE supplier.is_identifier_valid
    AND supplier.normalized_identifier = catalog.match_key
);`

function createAnalysisResultsSql(configuration: AnalysisConfiguration) {
  const storeDefaultMargin = `CAST(${quoteSqlString(
    String(configuration.options.storeDefaultMargin),
  )} AS DECIMAL(7,4))`

  return `CREATE TABLE ${ANALYSIS_RESULTS_RELATION} AS
WITH analyzable_matches AS (
  SELECT
    match_key,
    supplier_source_row_id,
    catalog_source_row_id,
    catalog_original_identifier AS display_identifier,
    supplier_cost,
    selling_price,
    catalog_margin_override AS catalog_override_margin_pct,
    ${storeDefaultMargin} AS store_default_margin_pct,
    CASE
      WHEN catalog_margin_override IS NOT NULL THEN catalog_margin_override
      ELSE ${storeDefaultMargin}
    END AS effective_target_margin_pct,
    CASE
      WHEN catalog_margin_override IS NOT NULL THEN 'CATALOG_OVERRIDE'
      ELSE 'STORE_DEFAULT'
    END AS target_source
  FROM ${IDENTIFIER_MATCHES_RELATION}
  WHERE match_status = 'MATCHED'
    AND is_supplier_cost_valid
    AND is_selling_price_valid
), financials AS (
  SELECT
    *,
    CAST(selling_price - supplier_cost AS DECIMAL(18,4)) AS gross_profit,
    CAST(supplier_cost * CAST(10000 AS DECIMAL(18,0)) AS HUGEINT) AS supplier_cost_units,
    CAST(selling_price * CAST(10000 AS DECIMAL(18,0)) AS HUGEINT) AS selling_price_units,
    CAST((selling_price - supplier_cost) * CAST(10000 AS DECIMAL(18,0)) AS HUGEINT) AS gross_profit_units,
    CAST(effective_target_margin_pct * CAST(10000 AS DECIMAL(18,0)) AS HUGEINT) AS target_margin_units
  FROM analyzable_matches
), scaled AS (
  SELECT
    *,
    (gross_profit_units * CAST(100000000000000 AS HUGEINT)) // selling_price_units AS gross_margin_scaled,
    CAST(1000000 AS HUGEINT) - target_margin_units AS target_denominator_units
  FROM financials
)
SELECT
  match_key,
  display_identifier,
  supplier_source_row_id,
  catalog_source_row_id,
  supplier_cost,
  selling_price,
  gross_profit,
  CAST(
    CAST(gross_margin_scaled AS DECIMAL(38,0))
      * CAST(0.000000000001 AS DECIMAL(13,12))
    AS DECIMAL(38,12)
  ) AS gross_margin_pct,
  store_default_margin_pct,
  catalog_override_margin_pct,
  CAST(NULL AS DECIMAL(7,4)) AS manual_override_margin_pct,
  effective_target_margin_pct,
  target_source,
  ${createPriceForTargetMarginExpression()} AS price_for_target_margin,
  ${createProductStatusExpression()} AS status
FROM scaled;`
}

const ANALYSIS_METADATA_SQL = `SELECT
  (SELECT count(*) FROM ${ANALYSIS_RESULTS_RELATION})::UBIGINT AS products_analyzed,
  (SELECT count(*) FILTER (WHERE status = 'LOSS') FROM ${ANALYSIS_RESULTS_RELATION})::UBIGINT AS products_at_loss,
  (SELECT count(*) FILTER (WHERE status = 'REVIEW') FROM ${ANALYSIS_RESULTS_RELATION})::UBIGINT AS products_needing_review,
  (SELECT count(*) FILTER (WHERE status = 'OK') FROM ${ANALYSIS_RESULTS_RELATION})::UBIGINT AS products_meeting_target,
  (SELECT CAST(CAST(avg(gross_margin_pct) AS DECIMAL(38,12)) AS VARCHAR) FROM ${ANALYSIS_RESULTS_RELATION}) AS average_gross_margin_pct,
  (SELECT count(*) FILTER (WHERE target_source = 'STORE_DEFAULT') FROM ${ANALYSIS_RESULTS_RELATION})::UBIGINT AS products_using_store_default_target,
  (SELECT count(*) FILTER (WHERE target_source IN ('CATALOG_OVERRIDE', 'MANUAL_OVERRIDE')) FROM ${ANALYSIS_RESULTS_RELATION})::UBIGINT AS products_using_product_specific_target,
  (SELECT count(*) FILTER (WHERE gross_margin_pct < CAST(0 AS DECIMAL(38,12))) FROM ${ANALYSIS_RESULTS_RELATION})::UBIGINT AS exposure_below_zero,
  (SELECT count(*) FILTER (WHERE gross_margin_pct >= CAST(0 AS DECIMAL(38,12)) AND gross_margin_pct < CAST(5 AS DECIMAL(38,12))) FROM ${ANALYSIS_RESULTS_RELATION})::UBIGINT AS exposure_zero_to_five,
  (SELECT count(*) FILTER (WHERE gross_margin_pct >= CAST(5 AS DECIMAL(38,12)) AND gross_margin_pct < CAST(10 AS DECIMAL(38,12))) FROM ${ANALYSIS_RESULTS_RELATION})::UBIGINT AS exposure_five_to_ten,
  (SELECT count(*) FILTER (WHERE gross_margin_pct >= CAST(10 AS DECIMAL(38,12)) AND gross_margin_pct < CAST(15 AS DECIMAL(38,12))) FROM ${ANALYSIS_RESULTS_RELATION})::UBIGINT AS exposure_ten_to_fifteen,
  (SELECT count(*) FILTER (WHERE gross_margin_pct >= CAST(15 AS DECIMAL(38,12)) AND gross_margin_pct < CAST(20 AS DECIMAL(38,12))) FROM ${ANALYSIS_RESULTS_RELATION})::UBIGINT AS exposure_fifteen_to_twenty,
  (SELECT count(*) FILTER (WHERE gross_margin_pct >= CAST(20 AS DECIMAL(38,12)) AND gross_margin_pct < CAST(30 AS DECIMAL(38,12))) FROM ${ANALYSIS_RESULTS_RELATION})::UBIGINT AS exposure_twenty_to_thirty,
  (SELECT count(*) FILTER (WHERE gross_margin_pct >= CAST(30 AS DECIMAL(38,12))) FROM ${ANALYSIS_RESULTS_RELATION})::UBIGINT AS exposure_thirty_and_above,
  (SELECT count(*) FROM normalized_supplier)::UBIGINT AS supplier_rows,
  (SELECT count(*) FROM normalized_catalog)::UBIGINT AS catalog_rows,
  (SELECT count(*) FILTER (WHERE match_status = 'MATCHED') FROM ${IDENTIFIER_MATCHES_RELATION})::UBIGINT AS matched_products,
  (SELECT count(*) FILTER (WHERE match_status = 'SUPPLIER_ONLY') FROM ${IDENTIFIER_MATCHES_RELATION})::UBIGINT AS supplier_only_products,
  (SELECT count(*) FILTER (WHERE match_status = 'CATALOG_ONLY') FROM ${IDENTIFIER_MATCHES_RELATION})::UBIGINT AS catalog_only_products,
  (SELECT count(DISTINCT normalized_identifier) FILTER (WHERE is_duplicate_identifier) FROM normalized_supplier)::UBIGINT AS supplier_duplicate_identifiers,
  (SELECT count(DISTINCT normalized_identifier) FILTER (WHERE is_duplicate_identifier) FROM normalized_catalog)::UBIGINT AS catalog_duplicate_identifiers,
  (SELECT count(*) FILTER (WHERE NOT is_supplier_cost_valid) FROM normalized_supplier)::UBIGINT AS invalid_supplier_costs,
  (SELECT count(*) FILTER (WHERE NOT is_selling_price_valid) FROM normalized_catalog)::UBIGINT AS invalid_selling_prices,
  (SELECT count(*) FILTER (WHERE NOT is_margin_override_valid) FROM normalized_catalog)::UBIGINT AS invalid_margin_overrides;`

function createMarginAnalysisSql(configuration: AnalysisConfiguration) {
  return {
    matching: [
      CREATE_UNIQUE_SUPPLIER_SQL,
      CREATE_UNIQUE_CATALOG_SQL,
      CREATE_IDENTIFIER_MATCHES_SQL,
    ],
    analysis: createAnalysisResultsSql(configuration),
    metadata: ANALYSIS_METADATA_SQL,
  }
}

export {
  ANALYSIS_METADATA_SQL,
  ANALYSIS_RELATION_NAMES,
  ANALYSIS_RESULTS_RELATION,
  CREATE_IDENTIFIER_MATCHES_SQL,
  CREATE_UNIQUE_CATALOG_SQL,
  CREATE_UNIQUE_SUPPLIER_SQL,
  DROP_ANALYSIS_RELATIONS_SQL,
  IDENTIFIER_MATCHES_RELATION,
  UNIQUE_CATALOG_RELATION,
  UNIQUE_SUPPLIER_RELATION,
  createAnalysisResultsSql,
  createMarginAnalysisSql,
  createPriceForTargetMarginExpression,
  createProductStatusExpression,
}
